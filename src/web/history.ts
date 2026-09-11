/**
 * 架電履歴（ダッシュボード）のデータ。
 *
 * 通話が終わった時点の結果を1件の記録にまとめ、ブラウザの localStorage に保存する。
 * 保存先はこのブラウザだけで、サーバーには送らない。
 * DOM には触れない（表示は historyView.ts）。node のテストから直接呼べるようにするため。
 */
import { evaluateDod } from "../domain/dod.js";
import { HEARING_SLOTS } from "../domain/hearing.js";
import type { CallState } from "../domain/state.js";
import type { AbsenceRecord, AgentMode, TransferOutcome } from "../demo/transferEngine.js";

export const HISTORY_KEY = "ai-call-agent:call-history:v1";
/** 保存する件数の上限。超えたら古いものから捨てる（localStorage の容量対策）。 */
export const HISTORY_LIMIT = 200;

export type CallStatus = "appointment" | "ended" | "handover" | "absent" | "rejected";

export const STATUS_LABEL: Record<CallStatus, string> = {
  appointment: "アポ獲得",
  ended: "終話（アポ未成立）",
  handover: "担当者へ引き継ぎ",
  absent: "不在",
  rejected: "取次ぎに至らず終話",
};

/** 通話ログの1行。at は発話を画面に出した時刻（ミリ秒）。 */
export interface LogLine {
  at: number;
  who: "AI" | "相手" | "システム";
  text: string;
}

export interface CheckItem {
  label: string;
  ok: boolean;
  detail: string;
}

export interface DataItem {
  label: string;
  /** null は未取得 */
  value: string | null;
}

export interface CallRecord {
  id: string;
  mode: AgentMode;
  company: string;
  startedAt: number;
  endedAt: number;
  status: CallStatus;
  /** アポ成立チェック。タイプB（受付突破）は対象外なので null。 */
  dod: { passed: boolean; items: CheckItem[] } | null;
  /** 取得データ（タイプA: ヒアリング7項目と連絡先・商談日時 ／ タイプB: 受付突破の結果と不在記録） */
  data: DataItem[];
  log: LogLine[];
}

export interface CallMeta {
  log: readonly LogLine[];
  startedAt: number;
  endedAt: number;
  company: string;
}

export type FinishedTransferOutcome = Exclude<TransferOutcome, "calling">;

function newId(startedAt: number): string {
  return `${startedAt.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** タイプA（アポ獲得）の終了した通話を記録にする。 */
export function buildAppointmentRecord(state: CallState, meta: CallMeta): CallRecord {
  const dod = evaluateDod(state);
  const data: DataItem[] = [
    ...HEARING_SLOTS.map((s) => ({ label: `${s.id} ${s.label}`, value: state.hearing[s.id] })),
    {
      label: "商談日時",
      value: state.appointmentDate && state.appointmentTime ? `${state.appointmentDate} ${state.appointmentTime}` : null,
    },
    {
      label: "メールアドレス",
      value: state.email ? `${state.email}${state.emailConfirmed ? "（復唱確認済み）" : "（復唱未確認）"}` : null,
    },
    { label: "前日確認の連絡先（直通番号）", value: state.callbackPhone },
    { label: "前日連絡の希望時間帯", value: state.callbackWindow },
  ];
  return {
    id: newId(meta.startedAt),
    mode: "appointment",
    company: meta.company,
    startedAt: meta.startedAt,
    endedAt: meta.endedAt,
    status: dod.passed ? "appointment" : "ended",
    dod: { passed: dod.passed, items: dod.items.map(({ label, ok, detail }) => ({ label, ok, detail })) },
    data,
    log: meta.log.map((l) => ({ ...l })),
  };
}

/** タイプB（受付突破）の終了した通話を記録にする。 */
export function buildTransferRecord(
  outcome: FinishedTransferOutcome,
  absence: AbsenceRecord | null,
  meta: CallMeta,
): CallRecord {
  return {
    id: newId(meta.startedAt),
    mode: "transfer",
    company: meta.company,
    startedAt: meta.startedAt,
    endedAt: meta.endedAt,
    status: outcome,
    dod: null,
    data: [
      { label: "受付突破の結果", value: STATUS_LABEL[outcome] },
      { label: "不在時の相手の発言", value: absence?.said ?? null },
      { label: "聞き取れた戻り時間", value: absence?.returnTime ?? null },
    ],
    log: meta.log.map((l) => ({ ...l })),
  };
}

// ---------- 保存と読み込み ----------

/** localStorage と同じ形。テストではメモリ上の実装を渡す。 */
export type HistoryStorage = Pick<Storage, "getItem" | "setItem">;

const MODES: readonly string[] = ["appointment", "transfer"];

function isCallRecord(v: unknown): v is CallRecord {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  const dod = r.dod as Record<string, unknown> | null | undefined;
  return (
    typeof r.id === "string" &&
    typeof r.company === "string" &&
    typeof r.mode === "string" &&
    MODES.includes(r.mode) &&
    typeof r.startedAt === "number" &&
    typeof r.endedAt === "number" &&
    typeof r.status === "string" &&
    Object.hasOwn(STATUS_LABEL, r.status) &&
    Array.isArray(r.data) &&
    Array.isArray(r.log) &&
    (dod === null || (typeof dod === "object" && Array.isArray(dod.items)))
  );
}

/**
 * 保存済みの履歴を読み込む（新しい順）。
 * 保存が使えない・壊れている・形が合わない記録があっても例外にせず、読める分だけ返す。
 */
export function loadHistory(storage: HistoryStorage | null): CallRecord[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCallRecord).slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

/** 履歴を保存する。保存できなかった（容量超過・保存無効）ときは false。 */
export function saveHistory(storage: HistoryStorage | null, records: readonly CallRecord[]): boolean {
  if (!storage) return false;
  try {
    storage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, HISTORY_LIMIT)));
    return true;
  } catch {
    return false;
  }
}

/** 記録を先頭（最新）に追加する。上限を超えた分は古いものから捨てる。 */
export function addRecord(records: readonly CallRecord[], record: CallRecord): CallRecord[] {
  return [record, ...records.filter((r) => r.id !== record.id)].slice(0, HISTORY_LIMIT);
}

// ---------- 集計と表示用の整形 ----------

export interface HistorySummary {
  total: number;
  /** タイプA の通話数と、そのうちアポ獲得の数 */
  appointmentCalls: number;
  appointments: number;
  /** タイプB の通話数と、そのうち担当者へ引き継いだ数 */
  transferCalls: number;
  handovers: number;
}

export function summarize(records: readonly CallRecord[]): HistorySummary {
  const a = records.filter((r) => r.mode === "appointment");
  const b = records.filter((r) => r.mode === "transfer");
  return {
    total: records.length,
    appointmentCalls: a.length,
    appointments: a.filter((r) => r.status === "appointment").length,
    transferCalls: b.length,
    handovers: b.filter((r) => r.status === "handover").length,
  };
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** 「3分12秒」「45秒」 */
export function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}分${pad(s)}秒` : `${s}秒`;
}

/** 「2026/09/11 17:30」（端末のタイムゾーン） */
export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 「17:30:05」 */
export function formatClock(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 通話開始からの経過「+01:12」 */
export function formatOffset(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000));
  return `+${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
}
