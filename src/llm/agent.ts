/**
 * 1ターンのオーケストレーション。
 *
 *   相手発話 → ガードレール前検知 → 生成 → 出力前フィルタ（自動修正／差し戻し）
 *   → 遷移検証 → 状態マージ
 *
 * LLM は「発話案と状態の読み取り」を出すだけで、
 * フェーズ遷移の可否とヒアリング充足の判定はすべてこのコードが握る。
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { TurnOutputSchema, type TurnOutput } from "./schema.js";
import { buildStateBriefing, buildSystemPrompt } from "./prompt.js";
import { autoFix, checkForbidden, type Violation } from "../domain/forbidden.js";
import { detectGuardrails, GUARDRAILS } from "../domain/guardrails.js";
import { PHASES } from "../domain/phases.js";
import {
  applyExtracted,
  resolveTransition,
  type CallState,
} from "../domain/state.js";
import type { GuardrailId, PhaseId } from "../domain/types.js";
import { DEMO_SCENARIO, type Scenario } from "../demo/scenario.js";

const MODEL = process.env.CALL_AGENT_MODEL ?? "claude-opus-5";
const EFFORT = (process.env.CALL_AGENT_EFFORT ?? "medium") as
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";
const MAX_FILTER_RETRIES = 2;

export interface AgentTurn {
  /** 実際に相手に伝える発話（フィルタ通過済み） */
  utterance: string;
  phase: PhaseId;
  note: string;
  guardrails: GuardrailId[];
  /** 相手に届く前にブロックした違反 */
  blocked: Violation[];
  /** 自動修正を適用した回数 */
  autoFixed: number;
  /** 遷移を却下した場合の理由 */
  overrideReason?: string;
  /** フィルタを通せず定型文にフォールバックしたか */
  usedFallback: boolean;
}

export class CallAgent {
  private client: Anthropic;
  private messages: Anthropic.MessageParam[] = [];
  private system: string;
  private supportsMidConvSystem = true;

  constructor(
    private scenario: Scenario = DEMO_SCENARIO,
    client?: Anthropic,
  ) {
    this.client = client ?? new Anthropic();
    this.system = buildSystemPrompt(scenario);
  }

  /**
   * 相手の発話（初回は「（架電開始）」等のト書き）を受けて、次のAI発話を1つ返す。
   * state は破壊的に更新される。
   */
  async respond(state: CallState, customerUtterance: string): Promise<AgentTurn> {
    const detected = detectGuardrails(customerUtterance);
    for (const g of detected) {
      if (!state.firedGuardrails.includes(g)) state.firedGuardrails.push(g);
    }

    this.messages.push({ role: "user", content: customerUtterance });

    const corrections: string[] = [];
    let blocked: Violation[] = [];
    let autoFixed = 0;
    let output: TurnOutput | null = null;
    let utterance = "";
    let usedFallback = false;

    for (let attempt = 0; attempt <= MAX_FILTER_RETRIES; attempt++) {
      output = await this.generate(state, detected, corrections);
      const fixed = autoFix(output.utterance);
      if (fixed.applied.length > 0) autoFixed += fixed.applied.length;

      const violations = checkForbidden(fixed.text);
      if (violations.length === 0) {
        utterance = fixed.text;
        // 自動修正で消えた違反も「ブロックした違反」として記録する
        const preFix = checkForbidden(output.utterance).filter((v) => v.fixable);
        blocked = [...blocked, ...preFix];
        break;
      }

      blocked = [...blocked, ...violations];
      corrections.push(
        ...violations.map(
          (v) =>
            `禁止表現「${v.matched}」（${v.label}）を使いました。${
              v.alternative
                ? `代わりに「${v.alternative}」と言い換えてください。`
                : "この内容自体を発話から完全に削除してください。"
            }`,
        ),
      );

      if (attempt === MAX_FILTER_RETRIES) {
        // 3回試して通らなければ、設計書の定型文にフォールバックする。
        // 「相手に禁止表現が届く」ことだけは絶対に許さない。
        utterance = this.fallbackUtterance(state.phase);
        usedFallback = true;
      }
    }

    if (!output) throw new Error("生成に失敗しました");

    state.blockedViolationCount += blocked.length;

    // --- 状態のマージ（LLM の読み取り + 発話からの決定論的検知） ---
    applyExtracted(state, {
      ...output.extracted,
      calendar_requested:
        output.extracted.calendar_requested || /カレンダー/.test(utterance),
      law_change_hook_used:
        output.extracted.law_change_hook_used ||
        /(法改正|62,?000円|6万2)/.test(utterance),
    });
    if (output.signals.is_decision_maker !== "unknown") {
      state.isDecisionMaker = output.signals.is_decision_maker;
    }

    // --- 遷移の検証 ---
    const forbidEnd = (Object.keys(GUARDRAILS) as GuardrailId[]).filter(
      (id) => GUARDRAILS[id].forbidEnd,
    );
    const proposed = usedFallback ? state.phase : (output.next_phase as PhaseId);
    const t = resolveTransition(state, proposed, detected, forbidEnd);

    state.turns.push({
      index: state.turns.length,
      speaker: "customer",
      text: customerUtterance,
      phase: state.phase,
      guardrails: detected,
    });
    state.turns.push({
      index: state.turns.length,
      speaker: "agent",
      text: utterance,
      phase: state.phase,
      blockedViolations: blocked.length > 0 ? blocked : undefined,
      note: output.note,
    });

    state.phase = t.phase;
    if (t.phase === "END") state.ended = true;

    this.messages.push({ role: "assistant", content: utterance });

    return {
      utterance,
      phase: t.phase,
      note: output.note,
      guardrails: detected,
      blocked,
      autoFixed,
      overrideReason: t.overrideReason,
      usedFallback,
    };
  }

  private async generate(
    state: CallState,
    detected: GuardrailId[],
    corrections: string[],
  ): Promise<TurnOutput> {
    const briefing = buildStateBriefing({ state, detectedGuardrails: detected, corrections });

    const withBriefing = (): Anthropic.MessageParam[] =>
      this.supportsMidConvSystem
        ? [...this.messages, { role: "system", content: briefing } as Anthropic.MessageParam]
        : [...this.messages, { role: "user", content: `[システム指示]\n${briefing}` }];

    try {
      return await this.call(withBriefing());
    } catch (error) {
      // mid-conversation system message 非対応モデルへのフォールバック
      if (
        error instanceof Anthropic.BadRequestError &&
        /role 'system'|role "system"/.test(error.message) &&
        this.supportsMidConvSystem
      ) {
        this.supportsMidConvSystem = false;
        return await this.call(withBriefing());
      }
      throw error;
    }
  }

  private async call(messages: Anthropic.MessageParam[]): Promise<TurnOutput> {
    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      // 会話設計は毎ターン不変なのでキャッシュさせる
      system: [
        { type: "text", text: this.system, cache_control: { type: "ephemeral" } },
      ],
      thinking: { type: "adaptive" },
      output_config: {
        effort: EFFORT,
        format: zodOutputFormat(TurnOutputSchema),
      },
      messages,
    });

    if (response.stop_reason === "refusal") {
      throw new Error(
        `モデルが生成を拒否しました: ${response.stop_details?.explanation ?? "理由不明"}`,
      );
    }
    const parsed = response.parsed_output;
    if (!parsed) throw new Error("構造化出力のパースに失敗しました");
    return parsed as TurnOutput;
  }

  /** フィルタを通せなかった場合の安全な定型文（設計書の必須発話そのもの）。 */
  private fallbackUtterance(phase: PhaseId): string {
    const must = PHASES[phase].mustSay.map((s) => s.replace(/^（[^）]*）/, ""));
    if (must.length > 0) return must.join("");
    return `恐れ入ります、${this.scenario.agentOrg}の${this.scenario.agentName}でございます。`;
  }
}
