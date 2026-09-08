/**
 * モック会話エンジン（API を呼ばない再生モード）。
 *
 * CLI の dry-run と Web フロントエンドの両方がこれを使う。
 * 発話は設計書の定型文・台本の指定台詞から生成するが、
 * **フェーズ遷移の検証とスロット充足の判定は本番と同じ `domain/` のロジックを通す。**
 * したがって「7項目が揃うまで P9 へ進めない」等の担保はモックでもそのまま効く。
 */
import { PHASES } from "../domain/phases.js";
import { HEARING_SLOT_MAP } from "../domain/hearing.js";
import { detectGuardrails } from "../domain/guardrails.js";
import {
  applyExtracted,
  missingContact,
  missingHearing,
  resolveTransition,
  type CallState,
} from "../domain/state.js";
import type { GuardrailId, PhaseId } from "../domain/types.js";
import { DEMO_SCRIPT, type ScriptedLine } from "./customerScript.js";

const CONTACT_QUESTIONS: Record<string, (s: CallState) => string> = {
  メールアドレス: () =>
    "会社概要と Zoom の URL をお送りしたいのですが、メールアドレスを伺えますでしょうか？",
  メールアドレスの復唱確認: (s) => `復唱させていただきます。${s.email} でお間違いないでしょうか？`,
  前日確認の連絡先: () =>
    "前日に確認のご連絡を差し上げたいのですが、お電話番号を伺えますでしょうか？",
  前日連絡の希望時間帯: () => "前日のご連絡は、何時頃が繋がりやすいでしょうか？",
};

/** モック発話。台本が台詞を指定していればそれを、なければフェーズの必須発話を使う。 */
export function mockUtterance(state: CallState, scripted: string | null): string {
  const strip = (m: string) => m.replace(/^（[^）]*）/, "");
  if (scripted) return scripted;
  if (state.phase === "P8") {
    // P8 は「許可取得 → 未取得スロットを1つずつ」の順で進める
    const alreadyInP8 = state.turns.some((t) => t.speaker === "agent" && t.phase === "P8");
    if (!alreadyInP8) return strip(PHASES.P8.mustSay[0] ?? "");
    const nextH = missingHearing(state)[0];
    if (nextH) return HEARING_SLOT_MAP.get(nextH)?.question ?? "";
    const nextC = missingContact(state)[0];
    if (nextC) return CONTACT_QUESTIONS[nextC]?.(state) ?? `${nextC}を伺えますでしょうか？`;
  }
  return PHASES[state.phase].mustSay.map(strip).join(" ");
}

export interface MockStep {
  /** AI の発話 */
  agent: { text: string; phase: PhaseId };
  /** 相手の発話（agentSilent の行は複数まとまる） */
  customer: { role: string; text: string; guardrails: GuardrailId[] }[];
  /** 遷移を却下した場合の理由 */
  overrideReason?: string;
  /** この step で通話が終わったか */
  ended: boolean;
}

/**
 * 台本を1ターンずつ再生する。
 * 1 step = 「遷移の適用 → AI が話す → 相手が話す」。
 */
export class MockCallEngine {
  private scriptIndex = 0;
  private pendingAdvance: PhaseId | null = null;
  private pendingAgentSays: string | null = null;

  constructor(
    private state: CallState,
    private script: ScriptedLine[] = DEMO_SCRIPT,
  ) {}

  get finished(): boolean {
    return this.state.ended || this.state.turns.length >= 80;
  }

  /** 台本の進捗（0〜1）。 */
  get progress(): number {
    return this.script.length === 0 ? 1 : this.scriptIndex / this.script.length;
  }

  step(): MockStep | null {
    if (this.finished) return null;
    const state = this.state;
    let overrideReason: string | undefined;

    // 1) 台本が指定した遷移を「発話する前に」適用する（検証は本番と同じ）
    if (this.pendingAdvance) {
      const t = resolveTransition(state, this.pendingAdvance, [], []);
      overrideReason = t.overrideReason;
      state.phase = t.phase;
      this.pendingAdvance = null;
      if (state.phase === "END") {
        state.ended = true;
        return { agent: { text: "", phase: "END" }, customer: [], overrideReason, ended: true };
      }
    }

    // 2) AI が話す
    const phase = state.phase;
    const text = mockUtterance(state, this.pendingAgentSays);
    applyExtracted(state, {
      calendar_requested: /カレンダー/.test(text),
      law_change_hook_used: /(法改正|62,?000円)/.test(text),
    });
    state.turns.push({ index: state.turns.length, speaker: "agent", text, phase });

    // 3) 相手が話す（agentSilent の行は AI を挟まず続けて読む）
    const customer: MockStep["customer"] = [];
    this.pendingAgentSays = null;
    for (;;) {
      const line = this.script[this.scriptIndex];
      if (!line) break;
      this.scriptIndex++;
      if (line.provides) applyExtracted(state, line.provides);
      const guardrails = detectGuardrails(line.text);
      for (const g of guardrails) {
        if (!state.firedGuardrails.includes(g)) state.firedGuardrails.push(g);
      }
      state.turns.push({
        index: state.turns.length,
        speaker: "customer",
        text: line.text,
        phase: state.phase,
        guardrails,
      });
      customer.push({ role: line.role, text: line.text, guardrails });
      if (line.advanceTo) this.pendingAdvance = line.advanceTo;
      if (line.agentSays) this.pendingAgentSays = line.agentSays;
      if (!line.agentSilent) break;
    }

    // 台本を読み切ったら終了
    if (customer.length === 0 && !this.pendingAdvance) state.ended = true;

    return { agent: { text, phase }, customer, overrideReason, ended: state.ended };
  }
}
