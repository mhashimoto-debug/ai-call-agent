/**
 * 架電履歴（ダッシュボード）のデータ組み立て・保存・整形。
 * 画面と同じ順序（相手の発話を積む → 応答）で1通話を流し、終了時の記録が正しく作られることを見る。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DialogEngine } from "../demo/dialogEngine.js";
import { TransferEngine } from "../demo/transferEngine.js";
import { createCallState, type CallState } from "../domain/state.js";
import { detectGuardrails } from "../domain/guardrails.js";
import {
  HISTORY_KEY,
  HISTORY_LIMIT,
  addRecord,
  buildAppointmentRecord,
  buildTransferRecord,
  formatDateTime,
  formatDuration,
  formatOffset,
  loadHistory,
  saveHistory,
  summarize,
  type CallRecord,
  type HistoryStorage,
  type LogLine,
} from "./history.js";

const T0 = new Date(2026, 8, 11, 17, 30, 0).getTime();
const COMPANY = "株式会社サンプル工業";

function runCallA(turns: string[]): { state: CallState; log: LogLine[]; endedAt: number } {
  const state = createCallState();
  const engine = new DialogEngine(state);
  const log: LogLine[] = [];
  let t = T0;
  log.push({ at: t, who: "AI", text: engine.greeting().utterance });
  for (const text of turns) {
    t += 5_000;
    log.push({ at: t, who: "相手", text });
    engine.pushCustomer(text, detectGuardrails(text));
    t += 3_000;
    log.push({ at: t, who: "AI", text: engine.respond(text).utterance });
  }
  return { state, log, endedAt: t };
}

const APPOINTMENT_TURNS = [
  "少々お待ちください、代わります",
  "はい、代表の中村です",
  "50代で、役員2名と社員18名の20人です",
  "決算は3月で、メールは nakamura@example.co.jp です",
  "はい、その時間なら大丈夫です",
  "090-1234-5678 です",
  "いえ、特にやっていません",
  "特にないです",
  "はい、私が決めます",
  "はい、合っています",
  "午前中なら繋がります",
  "はい、入れておきます",
];

function memoryStorage(initial?: string): HistoryStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(HISTORY_KEY, initial);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

function sampleRecord(i: number): CallRecord {
  return buildTransferRecord("handover", null, {
    log: [{ at: T0 + i, who: "AI", text: `発話${i}` }],
    startedAt: T0 + i * 60_000,
    endedAt: T0 + i * 60_000 + 30_000,
    company: COMPANY,
  });
}

// ---------- 記録の組み立て ----------

test("タイプA 完走: 締めで通話終了になり、アポ獲得として DoD・取得データ・ログがそろう", () => {
  const { state, log, endedAt } = runCallA(APPOINTMENT_TURNS);
  assert.equal(state.ended, true, "締めのあいさつを話したら終話扱いになる");

  const r = buildAppointmentRecord(state, { log, startedAt: T0, endedAt, company: COMPANY });
  assert.equal(r.mode, "appointment");
  assert.equal(r.status, "appointment");
  assert.equal(r.company, COMPANY);
  assert.equal(r.endedAt - r.startedAt, endedAt - T0);
  assert.ok(r.dod?.passed);
  assert.equal(r.dod?.items.length, 7);
  assert.ok(r.dod?.items.every((i) => i.ok));

  const value = (label: string): string | null | undefined => r.data.find((d) => d.label === label)?.value;
  assert.equal(value("H7 決算月"), "3月");
  assert.equal(value("メールアドレス"), "nakamura@example.co.jp（復唱確認済み）");
  assert.equal(value("前日確認の連絡先（直通番号）"), "090-1234-5678");
  assert.ok(value("商談日時"));
  assert.ok(r.data.every((d) => d.value), "7項目と連絡先がすべて取得済み");

  assert.equal(r.log.length, 1 + APPOINTMENT_TURNS.length * 2);
  assert.deepEqual(r.log.map((l) => l.who).slice(0, 3), ["AI", "相手", "AI"]);
  assert.notEqual(r.log, log, "ログは記録時点の写しを持つ");
});

test("タイプA 撤退: 受付の営業電話ブロックは終話（アポ未成立）として記録する", () => {
  const { state, log, endedAt } = runCallA(["営業電話はお断りしております"]);
  assert.equal(state.ended, true);
  const r = buildAppointmentRecord(state, { log, startedAt: T0, endedAt, company: COMPANY });
  assert.equal(r.status, "ended");
  assert.equal(r.dod?.passed, false);
  assert.ok(r.data.some((d) => d.value === null), "未取得の項目は null のまま残す");
});

test("タイプB: 取次ぎを検知したら担当者へ引き継ぎとして記録し、DoD は対象外", () => {
  const engine = new TransferEngine();
  engine.greeting();
  engine.respond("少々お待ちください、代わります");
  assert.equal(engine.finished, true);
  const outcome = engine.result;
  assert.notEqual(outcome, "calling");
  if (outcome === "calling") return;

  const r = buildTransferRecord(outcome, engine.absenceRecord, { log: [], startedAt: T0, endedAt: T0 + 20_000, company: COMPANY });
  assert.equal(r.mode, "transfer");
  assert.equal(r.status, "handover");
  assert.equal(r.dod, null);
  assert.equal(r.data[0]?.value, "担当者へ引き継ぎ");
});

test("タイプB 不在: 相手の発言と戻り時間を取得データに残す", () => {
  const r = buildTransferRecord(
    "absent",
    { said: "担当は今不在にしてます", returnTime: "夕方" },
    { log: [], startedAt: T0, endedAt: T0 + 15_000, company: COMPANY },
  );
  assert.equal(r.status, "absent");
  assert.deepEqual(
    r.data.map((d) => d.value),
    ["不在", "担当は今不在にしてます", "夕方"],
  );
});

// ---------- 保存と読み込み ----------

test("保存した履歴を読み込むと、新しい順のまま元に戻る", () => {
  const storage = memoryStorage();
  let records: CallRecord[] = [];
  records = addRecord(records, sampleRecord(1));
  records = addRecord(records, sampleRecord(2));
  assert.equal(saveHistory(storage, records), true);

  const loaded = loadHistory(storage);
  assert.deepEqual(loaded, records);
  assert.equal(loaded[0]?.startedAt, T0 + 2 * 60_000, "最後に追加した通話が先頭");
});

test("上限を超えたら古いものから捨てる", () => {
  let records: CallRecord[] = [];
  for (let i = 0; i < HISTORY_LIMIT + 5; i++) records = addRecord(records, sampleRecord(i));
  assert.equal(records.length, HISTORY_LIMIT);
  assert.equal(records[0]?.startedAt, T0 + (HISTORY_LIMIT + 4) * 60_000);
});

test("同じ記録を二重に追加しない", () => {
  const r = sampleRecord(1);
  assert.equal(addRecord(addRecord([], r), r).length, 1);
});

test("保存データが壊れていても例外にせず、読める記録だけ返す", () => {
  assert.deepEqual(loadHistory(memoryStorage("{壊れたJSON")), []);
  assert.deepEqual(loadHistory(memoryStorage('{"a":1}')), []);
  const good = sampleRecord(1);
  const mixed = JSON.stringify([good, { id: 1 }, null, { ...good, id: "x", status: "toString" }]);
  assert.deepEqual(loadHistory(memoryStorage(mixed)), [good]);
});

test("保存が使えないブラウザでも止まらない（null・容量超過・読み込み失敗）", () => {
  assert.deepEqual(loadHistory(null), []);
  assert.equal(saveHistory(null, [sampleRecord(1)]), false);
  const broken: HistoryStorage = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  assert.deepEqual(loadHistory(broken), []);
  assert.equal(saveHistory(broken, [sampleRecord(1)]), false);
});

// ---------- 集計と整形 ----------

test("集計: タイプ別の件数と、アポ獲得・引き継ぎの数", () => {
  const { state, log, endedAt } = runCallA(APPOINTMENT_TURNS);
  const a = buildAppointmentRecord(state, { log, startedAt: T0, endedAt, company: COMPANY });
  const b = sampleRecord(1);
  const c = buildTransferRecord("rejected", null, { log: [], startedAt: T0, endedAt: T0, company: COMPANY });
  assert.deepEqual(summarize([a, b, c]), {
    total: 3,
    appointmentCalls: 1,
    appointments: 1,
    transferCalls: 2,
    handovers: 1,
  });
});

test("表示用の整形: 通話時間・日時・経過時間", () => {
  assert.equal(formatDuration(0), "0秒");
  assert.equal(formatDuration(45_400), "45秒");
  assert.equal(formatDuration(192_000), "3分12秒");
  assert.equal(formatDateTime(new Date(2026, 8, 11, 9, 5).getTime()), "2026/09/11 09:05");
  assert.equal(formatOffset(72_000), "+01:12");
});
