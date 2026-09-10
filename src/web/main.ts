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
import { japaneseVoices, playAudioFile, speakUtterance, stopAudio } from "./speech.js";
import { MicInput, micSupported } from "./mic.js";
import { DialogEngine } from "../demo/dialogEngine.js";
import { detectGuardrails } from "../domain/guardrails.js";

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} が見つかりません`);
  return el;
};

let state: CallState = createCallState();
let engine = new MockCallEngine(state);
let dialog = new DialogEngine(state);
const mic = new MicInput();

type Mode = "script" | "mic";
const mode = (): Mode => (($("mode") as HTMLSelectElement).value as Mode) ?? "script";
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

/**
 * AI の発話を鳴らす。
 * 対応する録音（public/audio/*.mp3）があれば合成音声より優先して再生し、
 * 録音が無い発話（その場で組み立てた質問文など）と再生に失敗したときだけ読み上げる。
 */
async function speakReply(text: string, audioFile?: string): Promise<void> {
  if (!voiceOn()) return;
  if (audioFile && (await playAudioFile(audioFile))) return;
  await speak(text);
}

/** 音声の停止（読み上げ・録音の両方）。 */
function stopVoice(): void {
  window.speechSynthesis?.cancel();
  stopAudio();
}

const pause = (ms: number): Promise<void> =>
  new Promise((r) => window.setTimeout(r, ms));

// ---------- 再生制御 ----------

let lastPhase: PhaseId | null = null;

// ---------- マイク入力（自由発話） ----------

function setMicNote(text: string, isError = false): void {
  const n = $("micnote");
  n.textContent = text;
  n.className = `micnote${isError ? " err" : ""}`;
}

/** 認識中の暫定テキストを1行だけ薄く出す。確定したら消す。 */
let interimNode: HTMLElement | null = null;

function showInterim(text: string): void {
  if (!interimNode) {
    if (transcript().querySelector(".empty")) transcript().innerHTML = "";
    interimNode = pushMessage("cust", "相手", text);
    interimNode.classList.add("interim");
  } else {
    const bubble = interimNode.querySelector(".bubble");
    if (bubble) bubble.textContent = text;
  }
  scrollToActive(interimNode);
}

function clearInterim(): void {
  interimNode?.remove();
  interimNode = null;
}

/** 音声認識で得たテキストを対話判定エンジンに渡し、AI に応答させる。 */
async function handleCustomerUtterance(text: string): Promise<void> {
  if (busy || state.ended) return;
  busy = true;
  syncButtons();
  try {
    if (transcript().querySelector(".empty")) transcript().innerHTML = "";

    const guardrails = detectGuardrails(text);
    dialog.pushCustomer(text, guardrails);
    const custNode = pushMessage("cust", "相手", text);
    if (guardrails.length > 0) {
      pushFlag(
        `ガードレール検知: ${guardrails.map((g) => `${g}（${GUARDRAILS[g].trigger}）`).join(" / ")}`,
      );
    }
    scrollToActive(custNode);
    await pause(200);

    const r = dialog.respond(text);
    if (r.overrideReason) pushFlag(`⚠ 遷移を却下: ${r.overrideReason}`);
    if (r.blocked.length > 0) {
      pushFlag(
        `出力前フィルタ: ${r.blocked.map((v) => `「${v.matched}」(${v.ruleId})`).join(", ")} を相手に届く前に遮断`,
      );
    }
    if (r.phase !== lastPhase) {
      pushPhaseSeparator(r.phase);
      lastPhase = r.phase;
    }
    const node = pushMessage("ai", "AI", r.utterance);
    // 「なぜこう返したか」と、どの音源で喋るかを内部メモとして出す
    const source = r.audioFile ? `録音 ${r.audioFile.split("/").pop()}` : "音声合成";
    const why = el("div", "flag", `判定: ${r.matched} ／ 音源: ${source}`);
    transcript().append(why);
    node.classList.add("speaking");
    renderAll();
    scrollToActive(node);
    await speakReply(r.utterance, r.audioFile);
    node.classList.remove("speaking");
    renderAll();
  } finally {
    busy = false;
    syncButtons();
  }
}

function toggleMic(): void {
  const btn = $("mic") as HTMLButtonElement;
  if (mic.listening) {
    mic.stop(); // 手動で確定
    return;
  }
  stopVoice();
  setMicNote("お話しください…");
  btn.classList.add("on");
  btn.textContent = "■ 話し終わり";
  mic.start({
    onInterim: showInterim,
    onFinal: (text) => {
      clearInterim();
      setMicNote("");
      void handleCustomerUtterance(text);
    },
    onError: (msg) => {
      clearInterim();
      setMicNote(msg, true);
    },
    onEnd: () => {
      btn.classList.remove("on");
      btn.textContent = "🎤 マイクで話す";
      clearInterim();
    },
  });
}

/** モード切替。マイクモードでは台本の再生ボタンを隠す。 */
function applyMode(): void {
  const m = mode();
  ($("mic") as HTMLButtonElement).hidden = m !== "mic";
  ($("next") as HTMLButtonElement).hidden = m === "mic";
  ($("play") as HTMLButtonElement).hidden = m === "mic";
  if (m === "mic") {
    mic.abort();
    setMicNote(
      micSupported()
        ? "「🎤 マイクで話す」を押して話しかけてください。AI がフェーズとガードレールで分岐して応答します。"
        : "このブラウザは音声認識に対応していません（Chrome / Edge / Safari をお使いください）。",
      !micSupported(),
    );
    ($("mic") as HTMLButtonElement).disabled = !micSupported();
    // 未発話なら AI の第一声から始める
    if (state.turns.length === 0) void startCall();
  } else {
    mic.abort();
    setMicNote("");
  }
  syncButtons();
}

/** マイクモードの開始。AI の第一声を出す。 */
async function startCall(): Promise<void> {
  busy = true;
  syncButtons();
  try {
    if (transcript().querySelector(".empty")) transcript().innerHTML = "";
    const r = dialog.greeting();
    pushPhaseSeparator(r.phase);
    lastPhase = r.phase;
    const node = pushMessage("ai", "AI", r.utterance);
    node.classList.add("speaking");
    renderAll();
    scrollToActive(node);
    await speakReply(r.utterance, r.audioFile);
    node.classList.remove("speaking");
  } finally {
    busy = false;
    syncButtons();
  }
}

let busy = false;
let playing = false;

function syncButtons(): void {
  ($("next") as HTMLButtonElement).disabled = state.ended || busy;
  ($("play") as HTMLButtonElement).disabled = state.ended;
  ($("mic") as HTMLButtonElement).disabled = state.ended || busy || !micSupported();
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
    stopVoice();
    return;
  }
  playing = true;
  syncButtons();
  void playLoop();
}

function reset(): void {
  stopPlay();
  stopVoice();
  busy = false;
  mic.abort();
  clearInterim();
  setMicNote("");
  state = createCallState();
  engine = new MockCallEngine(state);
  dialog = new DialogEngine(state);
  lastPhase = null;
  clearTranscript();
  setFollow(true);
  renderAll();
  window.scrollTo({ top: 0 });
  if (mode() === "mic") void startCall();
}

// ---------- 起動 ----------

renderScenario();
renderAll();

$("next").addEventListener("click", () => {
  stopPlay();
  stopVoice();
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
  if (!voiceOn()) stopVoice();
});
$("mic").addEventListener("click", toggleMic);
$("mode").addEventListener("change", applyMode);
applyMode();
void initVoices();
