/**
 * 通話レポート。デモの提示順 ③「DoD チェックリストの充足結果」に対応。
 */
import { evaluateDod } from "../domain/dod.js";
import { HEARING_SLOTS } from "../domain/hearing.js";
import { PHASES } from "../domain/phases.js";
import type { CallState } from "../domain/state.js";

export function renderReport(state: CallState, elapsedMs: number): string {
  const dod = evaluateDod(state);
  const lines: string[] = [];

  lines.push("# 通話レポート");
  lines.push("");
  lines.push(`- 生成日時: ${new Date().toISOString()}`);
  lines.push(`- 所要: ${(elapsedMs / 1000).toFixed(1)} 秒（システム処理時間）`);
  lines.push(`- 総ターン数: ${state.turns.length}`);
  lines.push(`- 到達フェーズ: ${state.phase}（${PHASES[state.phase].label}）`);
  lines.push("");

  lines.push("## アポ成立判定（Definition of Done）");
  lines.push("");
  lines.push("| | 項目 | 結果 |");
  lines.push("|---|---|---|");
  for (const i of dod.items) {
    lines.push(`| ${i.ok ? "○" : "×"} | ${i.label} | ${i.detail} |`);
  }
  lines.push("");
  lines.push(`**判定: ${dod.passed ? "アポ成立（全項目○）" : "未成立（未充足あり）"}**`);
  lines.push("");

  lines.push("## ヒアリング7項目");
  lines.push("");
  lines.push("| # | 項目 | 取得値 | 実データ実施率 | AI |");
  lines.push("|---|---|---|---|---|");
  for (const s of HEARING_SLOTS) {
    const v = state.hearing[s.id];
    lines.push(
      `| ${s.id} | ${s.label}${s.critical ? " ⚠" : ""} | ${v ?? "—"} | ${Math.round(s.humanRate * 100)}% | ${v ? "○" : "×"} |`,
    );
  }
  lines.push("");
  lines.push(`取得率: ${Math.round(dod.hearingCoverage * 100)}%（${HEARING_SLOTS.length}項目中 ${HEARING_SLOTS.filter((s) => state.hearing[s.id]).length}項目）`);
  lines.push("");

  lines.push("## 人間のばらつきとの比較");
  lines.push("");
  lines.push("| 項目 | 実データ（人間） | 今回のAI |");
  lines.push("|---|---|---|");
  for (const b of dod.humanBaseline) {
    lines.push(`| ${b.label} | ${Math.round(b.human * 100)}% | ${b.ai === 1 ? "100%（取得）" : "0%（未取得）"} |`);
  }
  lines.push("");

  lines.push("## コンプライアンス");
  lines.push("");
  lines.push(`- 相手に届いた禁止表現: **0 件**（出力前フィルタで発話前に遮断）`);
  lines.push(`- 出力前フィルタでブロック・修正した違反: ${state.blockedViolationCount} 件`);
  const blocked = state.turns.flatMap((t) => t.blockedViolations ?? []);
  if (blocked.length > 0) {
    lines.push("");
    lines.push("| ルール | 検知した表現 | 言い換え |");
    lines.push("|---|---|---|");
    for (const v of blocked) {
      lines.push(`| ${v.ruleId} ${v.label} | ${v.matched} | ${v.alternative ?? "（削除）"} |`);
    }
  }
  lines.push("");

  lines.push("## 発火したガードレール");
  lines.push("");
  lines.push(state.firedGuardrails.length > 0 ? state.firedGuardrails.map((g) => `- ${g}`).join("\n") : "- なし");
  lines.push("");

  lines.push("## 会話ログ");
  lines.push("");
  for (const t of state.turns) {
    const who = t.speaker === "agent" ? "AI" : "相手";
    lines.push(`**[${t.phase}] ${who}:** ${t.text}`);
    if (t.note) lines.push(`> 意図: ${t.note}`);
    if (t.blockedViolations?.length) {
      lines.push(`> ⚠ 出力前フィルタ: ${t.blockedViolations.map((v) => v.matched).join(", ")} を遮断`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function renderConsoleSummary(state: CallState): string {
  const dod = evaluateDod(state);
  const lines: string[] = [];
  lines.push("");
  lines.push("═".repeat(64));
  lines.push("  アポ成立判定（Definition of Done）");
  lines.push("═".repeat(64));
  for (const i of dod.items) {
    lines.push(`  [${i.ok ? "○" : "×"}] ${i.label}`);
    lines.push(`       ${i.detail}`);
  }
  lines.push("─".repeat(64));
  lines.push(`  判定: ${dod.passed ? "✅ アポ成立（全項目○）" : "❌ 未成立"}`);
  lines.push(`  ヒアリング取得率: ${Math.round(dod.hearingCoverage * 100)}%（人間の平均: H5=67% / H4=73%）`);
  lines.push(`  カレンダー登録依頼: ${state.calendarRequested ? "実施" : "未実施"}（人間の平均: 53%）`);
  lines.push(`  相手に届いた禁止表現: 0 件（フィルタ遮断 ${state.blockedViolationCount} 件）`);
  lines.push("═".repeat(64));
  return lines.join("\n");
}
