/**
 * デモ実行 CLI。
 *
 *   npm run demo      台本モード（客役の返答を固定して自動再生）
 *   npm run manual    手動モード（客役の返答を自分で打つ）
 *   npm run dryrun    API を呼ばずに設計書の定型文だけで通す練習モード
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { CallAgent } from "../llm/agent.js";
import { DEMO_SCRIPT, type ScriptedLine } from "../demo/customerScript.js";
import { DEMO_SCENARIO } from "../demo/scenario.js";
import { PHASES } from "../domain/phases.js";
import {
  applyExtracted,
  createCallState,
  missingContact,
  missingHearing,
  resolveTransition,
  type CallState,
} from "../domain/state.js";
import { detectGuardrails } from "../domain/guardrails.js";
import { renderConsoleSummary, renderReport } from "../report/report.js";
import { HEARING_SLOT_MAP } from "../domain/hearing.js";
import type { PhaseId } from "../domain/types.js";

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  agent: (s: string) => `\x1b[36m${s}\x1b[0m`,
  customer: (s: string) => `\x1b[33m${s}\x1b[0m`,
  warn: (s: string) => `\x1b[31m${s}\x1b[0m`,
  ok: (s: string) => `\x1b[32m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

interface Args {
  mode: "scripted" | "manual";
  dryRun: boolean;
  auto: boolean;
}

function parseArgs(argv: string[]): Args {
  const mode = argv.includes("--mode")
    ? (argv[argv.indexOf("--mode") + 1] as Args["mode"])
    : "scripted";
  return {
    mode: mode === "manual" ? "manual" : "scripted",
    dryRun: argv.includes("--dry-run"),
    auto: argv.includes("--auto"),
  };
}

function printPhase(state: CallState): void {
  const p = PHASES[state.phase];
  console.log(C.dim(`\n──── [${p.id}] ${p.label} ─ ${p.goal} ────`));
}

function printAgent(text: string, note: string): void {
  console.log(`${C.agent(C.bold("AI  ▶"))} ${text}`);
  if (note) console.log(C.dim(`      意図: ${note}`));
}

function printCustomer(role: string, text: string): void {
  console.log(`${C.customer(C.bold(`${role} ▶`))} ${text}`);
}


const CONTACT_QUESTIONS: Record<string, (s: CallState) => string> = {
  メールアドレス: () =>
    "会社概要と Zoom の URL をお送りしたいのですが、メールアドレスを伺えますでしょうか？",
  メールアドレスの復唱確認: (s) => `復唱させていただきます。${s.email} でお間違いないでしょうか？`,
  前日確認の連絡先: () =>
    "前日に確認のご連絡を差し上げたいのですが、お電話番号を伺えますでしょうか？",
  前日連絡の希望時間帯: () => "前日のご連絡は、何時頃が繋がりやすいでしょうか？",
};

/** dry-run 用の発話。台本が台詞を指定していればそれを、なければフェーズの必須発話を使う。 */
function dryRunUtterance(state: CallState, scripted: string | null): string {
  const strip = (m: string) => m.replace(/^（[^）]*）/, "");
  if (scripted) return scripted;
  if (state.phase === "P8") {
    const alreadyInP8 = state.turns.some((t) => t.speaker === "agent" && t.phase === "P8");
    if (!alreadyInP8) return strip(PHASES.P8.mustSay[0] ?? "");
    const nextH = missingHearing(state)[0];
    if (nextH) return HEARING_SLOT_MAP.get(nextH)?.question ?? "";
    const nextC = missingContact(state)[0];
    if (nextC) return CONTACT_QUESTIONS[nextC]?.(state) ?? `${nextC}を伺えますでしょうか？`;
  }
  return PHASES[state.phase].mustSay.map(strip).join(" ");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const state = createCallState();
  const started = Date.now();

  console.log(C.bold("\n=== BPSR 企業型DC アポ獲得 AI架電エージェント（プレデモ v1.0）==="));
  console.log(C.dim(`架電先: ${DEMO_SCENARIO.companyName} / 相手: ${DEMO_SCENARIO.contactTitle} ${DEMO_SCENARIO.contactName}様`));
  console.log(C.dim(`モード: ${args.mode}${args.dryRun ? " + dry-run（API 呼び出しなし）" : ""}`));

  if (!args.dryRun && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.log(
      C.warn(
        "\n認証情報が見つかりません。ANTHROPIC_API_KEY を設定するか `ant auth login` を実行してください。",
      ),
    );
    console.log(C.dim("API を使わずに流れだけ確認するには: npm run dryrun -- --auto\n"));
  }

  const agent = args.dryRun ? null : new CallAgent(DEMO_SCENARIO);
  const rl =
    args.mode === "manual" || !args.auto
      ? readline.createInterface({ input: stdin, output: stdout })
      : null;

  const script: ScriptedLine[] = DEMO_SCRIPT;
  let scriptIndex = 0;
  let customerLine = "（架電開始。相手が電話に出た）";
  let pendingAdvance: PhaseId | null = null;
  let pendingAgentSays: string | null = null;

  try {
    while (!state.ended && state.turns.length < 80) {
      // dry-run: 台本が指定した遷移を「発話する前に」適用する
      if (pendingAdvance) {
        const t = resolveTransition(state, pendingAdvance, [], []);
        if (t.overrideReason) console.log(C.warn(`\n      ⚠ 遷移を却下: ${t.overrideReason}`));
        state.phase = t.phase;
        pendingAdvance = null;
        if (state.phase === "END") {
          state.ended = true;
          break;
        }
      }
      printPhase(state);

      if (agent) {
        const turn = await agent.respond(state, customerLine);
        printAgent(turn.utterance, turn.note);
        if (turn.blocked.length > 0) {
          console.log(
            C.warn(
              `      ⚠ 出力前フィルタ: ${turn.blocked.map((v) => `「${v.matched}」(${v.ruleId})`).join(", ")} を相手に届く前に遮断`,
            ),
          );
        }
        if (turn.overrideReason) console.log(C.warn(`      ⚠ 遷移を却下: ${turn.overrideReason}`));
        if (turn.usedFallback) console.log(C.warn("      ⚠ 定型文にフォールバックしました"));
        if (turn.guardrails.length > 0) {
          console.log(C.dim(`      ガードレール: ${turn.guardrails.join(", ")}`));
        }
      } else {
        // dry-run: 設計書の定型文だけで通す（API を呼ばない練習モード）
        const text = dryRunUtterance(state, pendingAgentSays);
        printAgent(text, "dry-run（定型文）");
        applyExtracted(state, {
          calendar_requested: /カレンダー/.test(text),
          law_change_hook_used: /(法改正|62,?000円)/.test(text),
        });
        state.turns.push({
          index: state.turns.length,
          speaker: "agent",
          text,
          phase: state.phase,
        });
      }

      if (state.ended) break;

      // --- 客役の発話 ---
      if (args.mode === "scripted") {
        if (!script[scriptIndex]) {
          console.log(C.dim("\n（台本の最後まで到達しました）"));
          break;
        }
        if (rl) await rl.question(C.dim("      [Enter で相手の返答へ] "));

        // agentSilent の行（取次ぎ等）は AI を挟まず続けて読む
        const spoken: string[] = [];
        pendingAgentSays = null;
        for (;;) {
          const line = script[scriptIndex];
          if (!line) break;
          scriptIndex++;
          printCustomer(line.role, line.text);
          if (line.provides) applyExtracted(state, line.provides);
          const g = detectGuardrails(line.text);
          if (g.length > 0) console.log(C.dim(`      ガードレール検知: ${g.join(", ")}`));
          spoken.push(line.text);
          if (line.advanceTo) pendingAdvance = line.advanceTo;
          if (line.agentSays) pendingAgentSays = line.agentSays;
          if (!line.agentSilent) break;
        }
        customerLine = spoken.join(" ");
      } else {
        if (!rl) throw new Error("manual モードには対話端末が必要です");
        const input = await rl.question(C.customer("相手 ▶ "));
        if (input.trim() === "" || input.trim() === "/end") break;
        customerLine = input;
      }
    }
  } finally {
    rl?.close();
  }

  console.log(renderConsoleSummary(state));

  const dir = path.resolve("reports");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `call-${new Date().toISOString().replace(/[:.]/g, "-")}.md`);
  fs.writeFileSync(file, renderReport(state, Date.now() - started), "utf-8");
  console.log(C.ok(`\nレポートを書き出しました: ${path.relative(process.cwd(), file)}\n`));
}

main().catch((e) => {
  console.error(C.warn(`\nエラー: ${e instanceof Error ? e.message : String(e)}`));
  process.exit(1);
});
