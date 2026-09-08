/**
 * デモ実行 CLI。
 *
 *   npm run demo      台本モード（客役の返答を固定して自動再生。要 API キー）
 *   npm run manual    手動モード（客役の返答を自分で打つ。要 API キー）
 *   npm run dryrun    モックモード（API を呼ばず設計書の定型文だけで通す）
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { CallAgent } from "../llm/agent.js";
import { DEMO_SCRIPT } from "../demo/customerScript.js";
import { MockCallEngine } from "../demo/mockEngine.js";
import { DEMO_SCENARIO } from "../demo/scenario.js";
import { PHASES } from "../domain/phases.js";
import { createCallState, type CallState } from "../domain/state.js";
import { detectGuardrails } from "../domain/guardrails.js";
import { renderConsoleSummary, renderReport } from "../report/report.js";

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  agent: (s: string) => `\x1b[36m${s}\x1b[0m`,
  customer: (s: string) => `\x1b[33m${s}\x1b[0m`,
  warn: (s: string) => `\x1b[31m${s}\x1b[0m`,
  ok: (s: string) => `\x1b[32m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

type Prompt = ((q: string) => Promise<string>) | null;

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

/** モックモード。共通の MockCallEngine を再生するだけ。 */
async function runMock(state: CallState, ask: Prompt): Promise<void> {
  const engine = new MockCallEngine(state, DEMO_SCRIPT);
  while (!engine.finished) {
    const step = engine.step();
    if (!step) break;
    if (step.overrideReason) console.log(C.warn(`\n      ⚠ 遷移を却下: ${step.overrideReason}`));
    if (step.ended && !step.agent.text) break;

    printPhase(state);
    printAgent(step.agent.text, "モック（定型文）");
    if (ask) await ask(C.dim("      [Enter で相手の返答へ] "));
    for (const c of step.customer) {
      printCustomer(c.role, c.text);
      if (c.guardrails.length > 0) {
        console.log(C.dim(`      ガードレール検知: ${c.guardrails.join(", ")}`));
      }
    }
  }
}

/** 本番モード。Claude が発話を生成する。 */
async function runLive(state: CallState, args: Args, ask: Prompt): Promise<void> {
  const agent = new CallAgent(DEMO_SCENARIO);
  let customerLine = "（架電開始。相手が電話に出た）";
  let scriptIndex = 0;

  while (!state.ended && state.turns.length < 80) {
    printPhase(state);
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
    if (state.ended) break;

    if (args.mode === "scripted") {
      if (!DEMO_SCRIPT[scriptIndex]) {
        console.log(C.dim("\n（台本の最後まで到達しました）"));
        break;
      }
      if (ask) await ask(C.dim("      [Enter で相手の返答へ] "));
      // agentSilent の行（取次ぎ等）は AI を挟まず続けて読む
      const spoken: string[] = [];
      for (;;) {
        const line = DEMO_SCRIPT[scriptIndex];
        if (!line) break;
        scriptIndex++;
        printCustomer(line.role, line.text);
        const g = detectGuardrails(line.text);
        if (g.length > 0) console.log(C.dim(`      ガードレール検知: ${g.join(", ")}`));
        spoken.push(line.text);
        if (!line.agentSilent) break;
      }
      customerLine = spoken.join(" ");
    } else {
      if (!ask) throw new Error("manual モードには対話端末が必要です");
      const input = await ask(C.customer("相手 ▶ "));
      if (input.trim() === "" || input.trim() === "/end") break;
      customerLine = input;
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const state = createCallState();
  const started = Date.now();

  console.log(C.bold("\n=== BPSR 企業型DC アポ獲得 AI架電エージェント（プレデモ v1.0）==="));
  console.log(
    C.dim(
      `架電先: ${DEMO_SCENARIO.companyName} / 相手: ${DEMO_SCENARIO.contactTitle} ${DEMO_SCENARIO.contactName}様`,
    ),
  );
  console.log(C.dim(`モード: ${args.dryRun ? "モック（API 呼び出しなし）" : args.mode}`));

  const hasCreds = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  if (!args.dryRun && !hasCreds) {
    console.log(
      C.warn("\n認証情報が見つかりません。ANTHROPIC_API_KEY を設定するか `ant auth login` を実行してください。"),
    );
    console.log(C.dim("API を使わずに流れだけ確認するには: npm run dryrun -- --auto\n"));
    process.exit(1);
  }

  const rl =
    args.mode === "manual" || !args.auto
      ? readline.createInterface({ input: stdin, output: stdout })
      : null;
  const ask: Prompt = rl ? (q: string) => rl.question(q) : null;

  try {
    if (args.dryRun) await runMock(state, ask);
    else await runLive(state, args, ask);
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
