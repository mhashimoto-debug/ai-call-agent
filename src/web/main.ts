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
import { japaneseVoices, speakUtterance } from "./speech.js";

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
  syncButtons();
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

function pushMessage(kind: "ai" | "cust", who: string, text: string): HTMLElement {
  const row = el("div", `msg ${kind}`);
  row.append(el("div", "who", who), el("div", "bubble", text));
  transcript().append(row);
  return row;
}

function pushFlag(text: string): void {
  const d = el("div", "flag", text);
  transcript().append(d);
}

/**
 * スクロール追従。
 * 「今どこを喋っているか」を追いかけるが、ユーザーが自分でスクロールしたら追従をやめる。
 * 最下部まで自分で戻せば自動で再開する（右下のボタンでも再開できる）。
 */
let follow = true;

function nearBottom(): boolean {
  const doc = document.documentElement;
  return window.innerHeight + window.scrollY >= doc.scrollHeight - 140;
}

function setFollow(on: boolean): void {
  follow = on;
  ($("follow") as HTMLButtonElement).hidden = on;
}

/** 現在の発話行までスムーズにスクロールする。追従が切れていれば何もしない。 */
function scrollToActive(node: HTMLElement): void {
  if (!follow) return;
  node.scrollIntoView({ behavior: "smooth", block: "center" });
}

// 上方向のホイール・タッチ操作は「自分で読みたい」の意思表示とみなして追従を切る
window.addEventListener("wheel", (e) => { if (e.deltaY < 0) setFollow(false); }, { passive: true });
window.addEventListener("touchmove", () => { if (!nearBottom()) setFollow(false); }, { passive: true });
window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "PageUp", "Home"].includes(e.key)) setFollow(false);
});
// 自分で最下部まで戻したら追従を再開する
window.addEventListener("scroll", () => { if (!follow && nearBottom()) setFollow(true); }, { passive: true });

// ---------- 音声（AI 側のみ。相手側 STT は次フェーズ） ----------

const voiceOn = (): boolean => ($("voice") as HTMLInputElement).checked;

/** 日本語ボイスを品質推定の高い順に並べてセレクトに流し込み、先頭を既定にする。 */
let voices: SpeechSynthesisVoice[] = [];

async function initVoices(): Promise<void> {
  const sel = $("voicesel") as HTMLSelectElement;
  if (!("speechSynthesis" in window)) {
    sel.disabled = true;
    sel.innerHTML = "<option>音声非対応のブラウザです</option>";
    return;
  }
  voices = await japaneseVoices();
  sel.innerHTML = "";
  if (voices.length === 0) {
    sel.disabled = true;
    sel.innerHTML = "<option>日本語ボイスが見つかりません</option>";
    return;
  }
  voices.forEach((v, i) => {
    const o = document.createElement("option");
    o.value = String(i);
    // 先頭が自動選択された「最も自然に聞こえる」ボイス
    o.textContent = i === 0 ? `${v.name}（推奨）` : v.name;
    sel.append(o);
  });
  sel.value = "0";
}

const selectedVoice = (): SpeechSynthesisVoice | null =>
  voices[Number(($("voicesel") as HTMLSelectElement).value || 0)] ?? null;

/** 読み上げ。発話が終わるまで解決しないので、ログの表示と音声がずれない。 */
function speak(text: string): Promise<void> {
  if (!voiceOn()) return Promise.resolve();
  return speakUtterance(text, { voice: selectedVoice(), rate: 1.0, gapMs: 240 });
}

const pause = (ms: number): Promise<void> =>
  new Promise((r) => window.setTimeout(r, ms));

// ---------- 再生制御 ----------

let lastPhase: PhaseId | null = null;
let busy = false;
let playing = false;

function syncButtons(): void {
  ($("next") as HTMLButtonElement).disabled = state.ended || busy;
  ($("play") as HTMLButtonElement).disabled = state.ended;
  $("play").textContent = playing ? "⏸ 停止" : "⏩ 自動再生";
}

/**
 * 1ターン進める。
 * AI が話し終わってから相手のセリフを出すため、音声ONでもログと音声がずれない。
 */
async function step(): Promise<void> {
  if (busy || state.ended) return;
  busy = true;
  syncButtons();
  try {
    const s = engine.step();
    if (!s) return;
    if (transcript().querySelector(".empty")) transcript().innerHTML = "";

    if (s.overrideReason) pushFlag(`⚠ 遷移を却下: ${s.overrideReason}`);

    if (s.agent.text) {
      if (s.agent.phase !== lastPhase) {
        pushPhaseSeparator(s.agent.phase);
        lastPhase = s.agent.phase;
      }
      const node = pushMessage("ai", "AI", s.agent.text);
      node.classList.add("speaking");
      renderAll();
      scrollToActive(node);
      await speak(s.agent.text); // 読み上げ終了まで待つ
      node.classList.remove("speaking");
    }

    // AI が話し終わってから相手が返す
    for (const c of s.customer) {
      await pause(voiceOn() ? 450 : 120);
      const node = pushMessage("cust", c.role, c.text);
      if (c.guardrails.length > 0) {
        pushFlag(
          `ガードレール検知: ${c.guardrails.map((g) => `${g}（${GUARDRAILS[g].trigger}）`).join(" / ")}`,
        );
      }
      renderAll();
      scrollToActive(node);
    }

    renderAll();
  } finally {
    busy = false;
    syncButtons();
  }
}

/** 自動再生。固定間隔ではなく「1ターンが終わったら次」で回すので音声と同期する。 */
async function playLoop(): Promise<void> {
  while (playing && !state.ended) {
    await step();
    if (!playing || state.ended) break;
    await pause(voiceOn() ? 500 : 1500);
  }
  playing = false;
  syncButtons();
}

function stopPlay(): void {
  playing = false;
  syncButtons();
}

function togglePlay(): void {
  if (playing) {
    stopPlay();
    window.speechSynthesis?.cancel();
    return;
  }
  playing = true;
  syncButtons();
  void playLoop();
}

function reset(): void {
  stopPlay();
  window.speechSynthesis?.cancel();
  busy = false;
  state = createCallState();
  engine = new MockCallEngine(state);
  lastPhase = null;
  clearTranscript();
  setFollow(true);
  renderAll();
  window.scrollTo({ top: 0 });
}

// ---------- 起動 ----------

renderScenario();
renderAll();

$("next").addEventListener("click", () => {
  stopPlay();
  window.speechSynthesis?.cancel();
  void step();
});
$("play").addEventListener("click", togglePlay);
$("reset").addEventListener("click", reset);
$("follow").addEventListener("click", () => {
  setFollow(true);
  transcript().lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
});
// 読み上げを途中でOFFにしたら即座に止める（待機中の Promise も解決される）
$("voice").addEventListener("change", () => {
  if (!voiceOn()) window.speechSynthesis?.cancel();
});
void initVoices();
