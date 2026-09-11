/**
 * Web フロントエンド（プロトタイプ）。
 *
 * 会話フロー・ガードレール・ヒアリング充足判定・DoD は
 * すべて src/domain の同じコードをそのまま import して使う。
 * このファイルが持つのは描画と再生制御だけで、会話設計のロジックは一切持たない。
 *
 * 画面はマイク入力によるリアルタイム対話のみ（固定台本の再生モードは廃止）。
 * エージェントには2つのモードがある:
 *   - タイプA（アポ獲得）: DialogEngine。ヒアリングを取り切って商談を確定させる
 *   - タイプB（受付突破）: TransferEngine。取次ぎを検知したら人間へ引き継ぐ
 */
import { PHASES, PHASE_ORDER } from "../domain/phases.js";
import { HEARING_SLOTS } from "../domain/hearing.js";
import { GUARDRAILS } from "../domain/guardrails.js";
import { evaluateDod } from "../domain/dod.js";
import { createCallState, type CallState } from "../domain/state.js";
import { DEMO_SCENARIO } from "../demo/scenario.js";
import type { PhaseId } from "../domain/types.js";
import {
  japaneseVoices,
  loadClip,
  playbackRuns,
  playbackToken,
  playClip,
  playSegments,
  speakUtterance,
  stopAll,
} from "./speech.js";
import { MicInput, micSupported } from "./mic.js";
import { DialogEngine } from "../demo/dialogEngine.js";
import { TransferEngine, type AgentMode } from "../demo/transferEngine.js";
import type { SpeechSegment } from "../demo/voiceLines.js";
import { detectGuardrails } from "../domain/guardrails.js";
import {
  STATUS_LABEL,
  addRecord,
  buildAppointmentRecord,
  buildTransferRecord,
  loadHistory,
  saveHistory,
  type CallRecord,
  type HistoryStorage,
  type LogLine,
} from "./history.js";
import { initDetail, openDetail, renderHistory } from "./historyView.js";

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} が見つかりません`);
  return el;
};

let state: CallState = createCallState();
let dialog = new DialogEngine(state);
let transfer = new TransferEngine();
const mic = new MicInput();

/** 現在のエージェントモード。画面上部のトグルで切り替える。 */
let mode: AgentMode = "appointment";
/** 通話が始まっているか（第一声を流したか）。 */
let callStarted = false;
/** 通話の開始時刻と、架電履歴に残す発話ログ（タイムスタンプ付き）。 */
let callStartedAt = 0;
let callLog: LogLine[] = [];

// ---------- 描画 ----------

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderScenario(): void {
  const s = DEMO_SCENARIO;
  const goal =
    mode === "transfer"
      ? "ゴール: 受付を突破して担当者に取次いでもらい、人間のオペレーターへ引き継ぐ"
      : `ゴール: ${s.proposedDate} ${s.proposedTime} のオンライン商談（${s.meetingMinutes}分）確定＋ヒアリング7項目取得`;
  $("scenario").textContent =
    `架電先: ${s.companyName}（従業員${s.employeeCount}名・役員${s.officerCount}名） ／ ` +
    `相手: ${s.contactTitle} ${s.contactName}様 ／ ${goal}`;
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
    [
      "メールアドレス（送付先）",
      state.email && state.emailConfirmed
        ? `${state.email}${state.emailReadBackSkipped ? "（復唱なしで確定）" : "（復唱済）"}`
        : null,
    ],
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
    `発話は収録済みの台本で、生成前制約が効いている状態です。`;
}

function renderAll(): void {
  renderSteps();
  renderHearing();
  renderDod();
  renderGuardrails();
  renderTransfer();
  syncButtons();
}

/** タイプB（受付突破）の状況。取次ぎの検知結果と不在記録を出す。 */
function renderTransfer(): void {
  const list = $("transferStatus");
  list.innerHTML = "";
  const outcome = transfer.result;
  const rows: [string, boolean, string][] = [
    [
      "取次ぎ状況",
      outcome === "handover",
      outcome === "handover"
        ? "担当者接続を検知（オペレーターへ引き継ぎ）"
        : outcome === "absent"
          ? "不在のため終話"
          : outcome === "rejected"
            ? "取次ぎに至らず終話"
            : callStarted
              ? "架電中"
              : "未架電",
    ],
    [
      "不在記録",
      Boolean(transfer.absenceRecord),
      transfer.absenceRecord
        ? `${transfer.absenceRecord.said}${
            transfer.absenceRecord.returnTime ? `（戻り: ${transfer.absenceRecord.returnTime}）` : ""
          }`
        : "なし",
    ],
  ];
  for (const [label, ok, detail] of rows) {
    const li = el("li", ok ? "ok" : "ng");
    li.append(el("span", "mark", ok ? "○" : "—"));
    const body = el("span");
    body.append(document.createTextNode(label), el("span", "detail", detail));
    li.append(body);
    list.append(li);
  }
}

// ---------- 会話ログ ----------

const transcript = (): HTMLElement => $("transcript");

function clearTranscript(): void {
  transcript().innerHTML = '<div class="empty">「通話開始」で架電を始めます</div>';
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
 * 応答は区間の並び（前置き＋質問、固定文＋差し込み＋固定文 など）になっていて、
 * 録音（public/audio/*.mp3）のある区間は録音、無い区間と再生に失敗した区間は読み上げで、順に鳴らす。
 * 録音は最初にまとめて読み込むので、区間のつなぎ目で途切れない。
 */
async function speakReply(segments: readonly SpeechSegment[]): Promise<void> {
  if (!voiceOn()) return;
  await playSegments(segments, { load: loadClip, play: playClip, speak }, playbackToken());
}

/** 音声の停止（読み上げ・録音の両方。再生途中の応答は残りの区間も鳴らさない）。 */
function stopVoice(): void {
  stopAll();
}

/** どの音源で喋るかの表示（「録音 p8_reask_1.mp3 ＋ 音声合成」など）。 */
function describeSource(segments: readonly SpeechSegment[]): string {
  return playbackRuns(segments)
    .map((r) => (r.audioFile ? `録音 ${r.audioFile.split("/").pop()}` : "音声合成"))
    .join(" ＋ ");
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

/** 音声認識で得たテキストを、モードに応じた判定エンジンに渡す。 */
async function handleCustomerUtterance(text: string): Promise<void> {
  if (mode === "transfer") return handleTransferUtterance(text);
  if (busy || state.ended) return;
  busy = true;
  syncButtons();
  // 再生中にリセットされても、この通話の記録として保存できるよう手元に持っておく
  const call = state;
  const log = callLog;
  const startedAt = callStartedAt;
  try {
    if (transcript().querySelector(".empty")) transcript().innerHTML = "";

    const guardrails = detectGuardrails(text);
    dialog.pushCustomer(text, guardrails);
    const custNode = pushMessage("cust", "相手", text);
    logLine("相手", text);
    if (guardrails.length > 0) {
      pushFlag(
        `ガードレール検知: ${guardrails.map((g) => `${g}（${GUARDRAILS[g].trigger}）`).join(" / ")}`,
      );
    }
    scrollToActive(custNode);
    await pause(200);

    const r = dialog.respond(text);
    if (r.holding) {
      // 保留中は AI は喋らない。判定だけ出して、代わって出る相手の発話を待つ
      pushFlag(`判定: ${r.matched}`);
      logLine("システム", r.matched);
      renderAll();
      return;
    }
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
    logLine("AI", r.utterance);
    // 「なぜこう返したか」と、どの音源で喋るかを内部メモとして出す
    const source = describeSource(r.segments);
    const why = el("div", "flag", `判定: ${r.matched} ／ 音源: ${source}`);
    transcript().append(why);
    node.classList.add("speaking");
    renderAll();
    scrollToActive(node);
    await speakReply(r.segments);
    node.classList.remove("speaking");
    renderAll();
    if (call.ended) {
      saveCall(
        call,
        buildAppointmentRecord(call, { log, startedAt, endedAt: Date.now(), company: DEMO_SCENARIO.companyName }),
      );
    }
  } finally {
    busy = false;
    syncButtons();
  }
}

/**
 * タイプB（受付突破）。
 * 取次ぎのサインを検知したら AI を黙らせ、人間へ引き継ぐ合図だけを出す。
 */
async function handleTransferUtterance(text: string): Promise<void> {
  if (busy || transfer.finished) return;
  busy = true;
  syncButtons();
  const call = transfer;
  const log = callLog;
  const startedAt = callStartedAt;
  const saveIfFinished = (): void => {
    const outcome = call.result;
    if (outcome === "calling") return;
    saveCall(
      call,
      buildTransferRecord(outcome, call.absenceRecord, {
        log,
        startedAt,
        endedAt: Date.now(),
        company: DEMO_SCENARIO.companyName,
      }),
    );
  };
  try {
    if (transcript().querySelector(".empty")) transcript().innerHTML = "";
    const custNode = pushMessage("cust", "相手", text);
    logLine("相手", text);
    scrollToActive(custNode);

    const r = transfer.respond(text);
    if (r.guardrails.length > 0) {
      for (const g of r.guardrails) {
        if (!state.firedGuardrails.includes(g)) state.firedGuardrails.push(g);
      }
      pushFlag(
        `ガードレール検知: ${r.guardrails.map((g) => `${g}（${GUARDRAILS[g].trigger}）`).join(" / ")}`,
      );
    }

    if (r.handover) {
      // 人間が話す前に AI の声が被らないよう、再生中の音声を止める
      stopVoice();
      mic.abort();
      pushFlag(`判定: ${r.matched}`);
      logLine("システム", "担当者接続を検知 → オペレーターへ引き継ぎ（AI は発話を停止）");
      showHandover(true);
      renderAll();
      saveIfFinished();
      return;
    }

    pushFlag(`判定: ${r.matched}`);
    const node = pushMessage("ai", "AI", r.utterance);
    logLine("AI", r.utterance);
    node.classList.add("speaking");
    renderAll();
    scrollToActive(node);
    await speakReply(r.segments);
    node.classList.remove("speaking");
    renderAll();
    saveIfFinished();
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
      btn.textContent = "🎤 話す";
      clearInterim();
    },
  });
}

/** モードごとに表示するパネルを切り替える。 */
function applyPanels(): void {
  const transferMode = mode === "transfer";
  ($("transferPanel") as HTMLElement).hidden = !transferMode;
  for (const id of ["stepsPanel", "hearingPanel", "dodPanel", "baselinePanel"]) {
    ($(id) as HTMLElement).hidden = transferMode;
  }
  ($("modeA") as HTMLButtonElement).classList.toggle("on", !transferMode);
  ($("modeB") as HTMLButtonElement).classList.toggle("on", transferMode);
}

/** 担当者接続の検知アラート。 */
function showHandover(on: boolean): void {
  ($("handover") as HTMLElement).hidden = !on;
  if (on) $("handover").scrollIntoView({ behavior: "smooth", block: "center" });
}

function setMode(next: AgentMode): void {
  if (mode === next) return;
  mode = next;
  applyPanels();
  renderScenario();
  reset();
}

/** 起動時とリセット時の画面セットアップ。 */
function applySetup(): void {
  mic.abort();
  applyPanels();
  setMicNote(
    micSupported()
      ? "「📞 通話開始」を押すと架電が始まります。以降は「🎤 話す」で話しかけてください。"
      : "このブラウザは音声認識に対応していません（Chrome / Edge / Safari をお使いください）。",
    !micSupported(),
  );
  syncButtons();
}

/** 通話開始。AI の第一声（取次ぎ依頼）を出す。 */
async function startCall(): Promise<void> {
  busy = true;
  callStarted = true;
  callStartedAt = Date.now();
  callLog = [];
  syncButtons();
  try {
    if (transcript().querySelector(".empty")) transcript().innerHTML = "";
    const r = mode === "transfer" ? transfer.greeting() : dialog.greeting();
    if ("phase" in r) {
      pushPhaseSeparator(r.phase);
      lastPhase = r.phase;
    }
    const node = pushMessage("ai", "AI", r.utterance);
    logLine("AI", r.utterance);
    node.classList.add("speaking");
    renderAll();
    scrollToActive(node);
    await speakReply(r.segments);
    node.classList.remove("speaking");
    setMicNote("「🎤 話す」を押して話しかけてください。");
  } finally {
    busy = false;
    syncButtons();
  }
}

let busy = false;

function syncButtons(): void {
  const btn = $("mic") as HTMLButtonElement;
  const ended = mode === "transfer" ? transfer.finished : state.ended;
  btn.disabled = ended || busy || !micSupported();
  if (!callStarted) btn.textContent = "📞 通話開始";
  else if (!mic.listening) btn.textContent = "🎤 話す";
}

function reset(): void {
  stopVoice();
  busy = false;
  callStarted = false;
  mic.abort();
  clearInterim();
  showHandover(false);
  state = createCallState();
  dialog = new DialogEngine(state);
  transfer = new TransferEngine();
  lastPhase = null;
  clearTranscript();
  setFollow(true);
  renderAll();
  applySetup();
  window.scrollTo({ top: 0 });
}

// ---------- 架電履歴（ダッシュボード） ----------

/** localStorage。プライベートブラウズ等で使えないときは null（保存せずに動かす）。 */
function browserStorage(): HistoryStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

let history: CallRecord[] = loadHistory(browserStorage());
/** 保存済みの通話。同じ通話を二重に記録しないため、通話ごとの状態オブジェクトで覚える。 */
const savedCalls = new WeakSet<object>();

function logLine(who: LogLine["who"], text: string): void {
  callLog.push({ at: Date.now(), who, text });
}

/** 終了した通話を架電履歴の先頭に追加し、保存する。 */
function saveCall(call: object, record: CallRecord): void {
  if (savedCalls.has(call)) return;
  savedCalls.add(call);
  history = addRecord(history, record);
  const saved = saveHistory(browserStorage(), history);
  renderHistory(history, openDetail);
  setMicNote(
    saved
      ? `通話を終了し、架電履歴に保存しました（${STATUS_LABEL[record.status]}）。「リセット」で次の架電を始められます。`
      : "通話を終了しました。このブラウザでは保存が使えないため、履歴はページを閉じると消えます。",
    !saved,
  );
}

function setView(view: "call" | "history"): void {
  const isHistory = view === "history";
  $("callView").hidden = isHistory;
  $("historyView").hidden = !isHistory;
  document.body.classList.toggle("view-history", isHistory);
  for (const [id, on] of [["tabCall", !isHistory], ["tabHistory", isHistory]] as const) {
    $(id).classList.toggle("on", on);
    $(id).setAttribute("aria-selected", String(on));
  }
  // 「最新の発話に追従」ボタンは通話デモの画面だけで出す
  $("follow").hidden = isHistory || follow;
  if (isHistory) renderHistory(history, openDetail);
  window.scrollTo({ top: 0 });
}

// ---------- 起動 ----------

renderScenario();
renderAll();
renderHistory(history, openDetail);
initDetail();
$("tabCall").addEventListener("click", () => setView("call"));
$("tabHistory").addEventListener("click", () => setView("history"));
$("historyClear").addEventListener("click", () => {
  if (history.length === 0) return;
  if (!window.confirm(`架電履歴 ${history.length} 件をすべて削除します。よろしいですか？`)) return;
  history = [];
  saveHistory(browserStorage(), history);
  renderHistory(history, openDetail);
});

$("mic").addEventListener("click", () => {
  if (!callStarted) {
    void startCall();
    return;
  }
  toggleMic();
});
$("reset").addEventListener("click", reset);
$("follow").addEventListener("click", () => {
  setFollow(true);
  transcript().lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
});
// 読み上げを途中でOFFにしたら即座に止める（待機中の Promise も解決される）
$("voice").addEventListener("change", () => {
  if (!voiceOn()) stopVoice();
});
$("modeA").addEventListener("click", () => setMode("appointment"));
$("modeB").addEventListener("click", () => setMode("transfer"));
applySetup();
void initVoices();
