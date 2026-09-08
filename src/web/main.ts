/**
 * Web フロントエンド（プロトタイプ）。
 *
 * 会話フロー・ガードレール・ヒアリング充足判定・DoD は
 * すべて src/domain の同じコードをそのまま import して使う。
 * このファイルが持つのは描画と再生制御だけで、会話設計のロジックは一切持たない。
 *
 * 音声デモへの拡張点:
 *   - AI 側の発話は Web Speech API（speechSynthesis）で読み上げ済み（音声トグル）
 *   - 相手側は次フェーズで SpeechRecognition に差し替える。
 *     `MockCallEngine.step()` を `CallAgent.respond()` に置き換えれば実 LLM 応答になる。
 */
import { PHASES, PHASE_ORDER } from "../domain/phases.js";
import { HEARING_SLOTS } from "../domain/hearing.js";
import { GUARDRAILS } from "../domain/guardrails.js";
import { evaluateDod } from "../domain/dod.js";
import { createCallState, type CallState } from "../domain/state.js";
import { MockCallEngine } from "../demo/mockEngine.js";
import { DEMO_SCENARIO } from "../demo/scenario.js";
import type { PhaseId } from "../domain/types.js";

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} が見つかりません`);
  return el;
};

let state: CallState = createCallState();
let engine = new MockCallEngine(state);
let playTimer: number | null = null;

// ---------- 描画 ----------

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderScenario(): void {
  const s = DEMO_SCENARIO;
  $("scenario").textContent =
    `架電先: ${s.companyName}（従業員${s.employeeCount}名・役員${s.officerCount}名） ／ ` +
    `相手: ${s.contactTitle} ${s.contactName}様 ／ ` +
    `ゴール: ${s.proposedDate} ${s.proposedTime} の Zoom 商談（${s.meetingMinutes}分）確定＋ヒアリング7項目取得`;
}

function renderSteps(): void {
  const list = $("steps");
  list.innerHTML = "";
  const currentIdx = PHASE_ORDER.indexOf(state.phase);
  for (const id of PHASE_ORDER) {
    const p = PHASES[id];
    const idx = PHASE_ORDER.indexOf(id);
    const done = state.ended || (currentIdx >= 0 && idx < currentIdx);
    const now = id === state.phase;
    const li = el("li", now ? "now" : done ? "done" : "");
    li.append(el("span", "id", p.id), el("span", "", p.label));
    list.append(li);
  }
}

function renderHearing(): void {
  const list = $("hearing");
  list.innerHTML = "";
  for (const s of HEARING_SLOTS) {
    const v = state.hearing[s.id];
    const li = el("li", v ? "ok" : "ng");
    li.append(el("span", "mark", v ? "○" : "×"));
    const body = el("span");
    body.append(document.createTextNode(`${s.id} ${s.label}`));
    if (s.critical) body.append(el("span", "crit", " ⚠必須"));
    body.append(el("span", "detail", v ?? "未取得"));
    li.append(body);
    list.append(li);
  }
  const extras: [string, string | null][] = [
    ["メールアドレス（復唱確認）", state.email && state.emailConfirmed ? `${state.email}（復唱済）` : null],
    ["前日確認の連絡先", state.callbackPhone],
    ["前日連絡の希望時間帯", state.callbackWindow],
  ];
  for (const [label, v] of extras) {
    const li = el("li", v ? "ok" : "ng");
    li.append(el("span", "mark", v ? "○" : "×"));
    const body = el("span");
    body.append(document.createTextNode(label), el("span", "detail", v ?? "未取得"));
    li.append(body);
    list.append(li);
  }
}

function renderDod(): void {
  const dod = evaluateDod(state);
  const list = $("dod");
  list.innerHTML = "";
  for (const i of dod.items) {
    const li = el("li", i.ok ? "ok" : "ng");
    li.append(el("span", "mark", i.ok ? "○" : "×"));
    const body = el("span");
    body.append(document.createTextNode(i.label), el("span", "detail", i.detail));
    li.append(body);
    list.append(li);
  }
  const v = $("verdict");
  v.className = `verdict ${dod.passed ? "pass" : "fail"}`;
  v.textContent = dod.passed ? "✅ アポ成立（全項目○）" : "未成立（未充足あり）";

  const tbody = $("baseline");
  tbody.innerHTML = "";
  for (const b of dod.humanBaseline) {
    const tr = el("tr");
    tr.append(el("td", "", b.label));
    tr.append(el("td", "n hu", `${Math.round(b.human * 100)}%`));
    tr.append(el("td", "n ai", b.ai === 1 ? "100%" : "—"));
    tbody.append(tr);
  }
}

function renderGuardrails(): void {
  const box = $("guardrails");
  box.innerHTML = "";
  if (state.firedGuardrails.length === 0) {
    box.append(el("div", "note", "発火なし"));
  } else {
    for (const id of state.firedGuardrails) {
      const tag = el("span", "tag", `${id} ${GUARDRAILS[id].trigger}`);
      box.append(tag);
    }
  }
  $("compliance").textContent =
    `相手に届いた禁止表現: 0 件（出力前フィルタで発話前に遮断 ${state.blockedViolationCount} 件）。` +
    `モックモードのため発話は設計書の定型文で、生成前制約が効いている状態です。`;
}

function renderAll(): void {
  renderSteps();
  renderHearing();
  renderDod();
  renderGuardrails();
  $("progress").textContent = state.ended
    ? "通話終了"
    : `台本 ${Math.round(engine.progress * 100)}%`;
  ($("next") as HTMLButtonElement).disabled = state.ended;
  ($("play") as HTMLButtonElement).disabled = state.ended;
}

// ---------- 会話ログ ----------

const transcript = (): HTMLElement => $("transcript");

function clearTranscript(): void {
  transcript().innerHTML = '<div class="empty">「次のターン」で架電を開始します</div>';
}

function pushPhaseSeparator(phase: PhaseId): void {
  const p = PHASES[phase];
  const sep = el("div", "phase-sep");
  sep.append(el("b", "", `${p.id} ${p.label}`), el("span", "", p.goal));
  transcript().append(sep);
}

function pushMessage(kind: "ai" | "cust", who: string, text: string): void {
  const row = el("div", `msg ${kind}`);
  row.append(el("div", "who", who), el("div", "bubble", text));
  transcript().append(row);
}

function pushFlag(text: string): void {
  const d = el("div", "flag", text);
  transcript().append(d);
}

function scrollToEnd(): void {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

// ---------- 音声（AI 側のみ。相手側 STT は次フェーズ） ----------

function speak(text: string): void {
  const on = ($("voice") as HTMLInputElement).checked;
  if (!on || !("speechSynthesis" in window) || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  u.rate = 1.05;
  window.speechSynthesis.speak(u);
}

// ---------- 再生制御 ----------

let lastPhase: PhaseId | null = null;

function step(): void {
  const s = engine.step();
  if (!s) {
    stopPlay();
    renderAll();
    return;
  }
  if (transcript().querySelector(".empty")) transcript().innerHTML = "";

  if (s.overrideReason) pushFlag(`⚠ 遷移を却下: ${s.overrideReason}`);

  if (s.agent.text) {
    if (s.agent.phase !== lastPhase) {
      pushPhaseSeparator(s.agent.phase);
      lastPhase = s.agent.phase;
    }
    pushMessage("ai", "AI", s.agent.text);
    speak(s.agent.text);
  }
  for (const c of s.customer) {
    pushMessage("cust", c.role, c.text);
    if (c.guardrails.length > 0) {
      pushFlag(
        `ガードレール検知: ${c.guardrails.map((g) => `${g}（${GUARDRAILS[g].trigger}）`).join(" / ")}`,
      );
    }
  }

  renderAll();
  scrollToEnd();
  if (state.ended) stopPlay();
}

function stopPlay(): void {
  if (playTimer !== null) {
    clearInterval(playTimer);
    playTimer = null;
  }
  $("play").textContent = "⏩ 自動再生";
}

function togglePlay(): void {
  if (playTimer !== null) {
    stopPlay();
    return;
  }
  $("play").textContent = "⏸ 停止";
  step();
  playTimer = window.setInterval(step, 2600);
}

function reset(): void {
  stopPlay();
  window.speechSynthesis?.cancel();
  state = createCallState();
  engine = new MockCallEngine(state);
  lastPhase = null;
  clearTranscript();
  renderAll();
  window.scrollTo({ top: 0 });
}

// ---------- 起動 ----------

renderScenario();
renderAll();
$("next").addEventListener("click", () => {
  stopPlay();
  step();
});
$("play").addEventListener("click", togglePlay);
$("reset").addEventListener("click", reset);
