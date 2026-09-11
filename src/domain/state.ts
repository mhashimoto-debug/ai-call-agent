/**
 * 通話状態。フェーズ遷移の可否・スロット充足・フック使用回数を
 * すべてここで一元管理し、LLM の自己申告を検証する側に立たせる。
 */
import type { GuardrailId, HearingId, PhaseId } from "./types.js";
import { PHASES } from "./phases.js";
import { HEARING_SLOTS } from "./hearing.js";
import type { Violation } from "./forbidden.js";

export interface TurnRecord {
  index: number;
  speaker: "agent" | "customer";
  text: string;
  phase: PhaseId;
  /** 出力前フィルタで検知して修正・再生成した違反（相手には届いていない） */
  blockedViolations?: Violation[];
  guardrails?: GuardrailId[];
  note?: string;
}

export interface CallState {
  phase: PhaseId;
  turns: TurnRecord[];
  /** H1〜H7 の取得値。null は未取得。 */
  hearing: Record<HearingId, string | null>;
  email: string | null;
  emailConfirmed: boolean;
  /**
   * メールアドレスを復唱せずに送付先として確定したか。
   * 録音だけで通話するモード（アドレスの読み上げは音声合成になるため復唱しない）で立つ。記録の表示に使う
   */
  emailReadBackSkipped: boolean;
  callbackPhone: string | null;
  /** 前日確認の連絡先に、今お電話している番号（発信先の番号）を使うか */
  isCurrentNumber: boolean;
  callbackWindow: string | null;
  appointmentDate: string | null;
  appointmentTime: string | null;
  zoomAgreed: boolean;
  durationAgreed: boolean;
  calendarRequested: boolean;
  /** P4 の法改正フックは会話全体で1回だけ */
  lawChangeHookUsed: boolean;
  /** これまでに発火したガードレール */
  firedGuardrails: GuardrailId[];
  /** 出力前フィルタでブロックした違反の累計（相手に届いた違反ではない） */
  blockedViolationCount: number;
  isDecisionMaker: "yes" | "no" | "unknown";
  ended: boolean;
}

export function createCallState(): CallState {
  return {
    phase: "P0",
    turns: [],
    hearing: { H1: null, H2: null, H3: null, H4: null, H5: null, H6: null, H7: null },
    email: null,
    emailConfirmed: false,
    emailReadBackSkipped: false,
    callbackPhone: null,
    isCurrentNumber: false,
    callbackWindow: null,
    appointmentDate: null,
    appointmentTime: null,
    zoomAgreed: false,
    durationAgreed: false,
    calendarRequested: false,
    lawChangeHookUsed: false,
    firedGuardrails: [],
    blockedViolationCount: 0,
    isDecisionMaker: "unknown",
    ended: false,
  };
}

export function missingHearing(state: CallState): HearingId[] {
  return HEARING_SLOTS.filter((s) => !state.hearing[s.id]).map((s) => s.id);
}

export function missingContact(state: CallState): string[] {
  const missing: string[] = [];
  if (!state.email) missing.push("メールアドレス");
  else if (!state.emailConfirmed) missing.push("メールアドレスの復唱確認");
  if (!state.callbackPhone) missing.push("前日確認の連絡先");
  if (!state.callbackWindow) missing.push("前日連絡の希望時間帯");
  return missing;
}

/** P8 を抜けてよいか。G2 の要。1つでも欠けたら false。 */
export function canLeaveHearing(state: CallState): boolean {
  return missingHearing(state).length === 0 && missingContact(state).length === 0;
}

export interface TransitionResult {
  phase: PhaseId;
  /** LLM の希望を却下した場合の理由（デモ画面に出す） */
  overrideReason?: string;
}

/**
 * LLM が提案した次フェーズを検証して確定させる。
 * 却下条件:
 *   - 現フェーズの allowedNext に無い
 *   - P8 → P9 なのにヒアリングが未充足（G2 の機械的担保）
 *   - R1/R3/R4/R5 発火中の END（勝ち筋の取りこぼし防止）
 */
export function resolveTransition(
  state: CallState,
  proposed: PhaseId,
  activeGuardrails: GuardrailId[],
  forbidEndGuardrails: GuardrailId[],
): TransitionResult {
  const current = PHASES[state.phase];

  if (proposed !== state.phase && !current.allowedNext.includes(proposed)) {
    return {
      phase: state.phase,
      overrideReason: `${state.phase} から ${proposed} への遷移は許可されていません（許可: ${current.allowedNext.join(", ")}）。フェーズを維持します。`,
    };
  }

  if (state.phase === "P8" && proposed === "P9" && !canLeaveHearing(state)) {
    const missing = [...missingHearing(state), ...missingContact(state)];
    return {
      phase: "P8",
      overrideReason: `ヒアリング未充足のため P9 へ進めません（未取得: ${missing.join(" / ")}）。`,
    };
  }

  if (proposed === "END" && state.phase !== "P9" && state.phase !== "P0X") {
    const blocking = activeGuardrails.filter((g) => forbidEndGuardrails.includes(g));
    if (blocking.length > 0) {
      return {
        phase: state.phase,
        overrideReason: `ガードレール ${blocking.join(", ")} 発火中のため終話できません。切り返しを継続します。`,
      };
    }
  }

  return { phase: proposed };
}

export interface ExtractedFacts {
  H1?: string | null;
  H2?: string | null;
  H3?: string | null;
  H4?: string | null;
  H5?: string | null;
  H6?: string | null;
  H7?: string | null;
  email?: string | null;
  email_confirmed?: boolean;
  callback_phone?: string | null;
  is_current_number?: boolean;
  callback_window?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  zoom_agreed?: boolean;
  duration_agreed?: boolean;
  calendar_requested?: boolean;
  law_change_hook_used?: boolean;
}

/**
 * 抽出結果を状態にマージする。
 * 一度取得した値を null / false で上書きすることはしない（取りこぼし防止）。
 */
export function applyExtracted(state: CallState, facts: ExtractedFacts): void {
  for (const id of ["H1", "H2", "H3", "H4", "H5", "H6", "H7"] as HearingId[]) {
    const v = facts[id];
    if (v && v.trim()) state.hearing[id] = v.trim();
  }
  if (facts.email?.trim()) state.email = facts.email.trim();
  if (facts.email_confirmed) state.emailConfirmed = true;
  if (facts.callback_phone?.trim()) state.callbackPhone = facts.callback_phone.trim();
  if (facts.is_current_number) state.isCurrentNumber = true;
  if (facts.callback_window?.trim()) state.callbackWindow = facts.callback_window.trim();
  if (facts.appointment_date?.trim()) state.appointmentDate = facts.appointment_date.trim();
  if (facts.appointment_time?.trim()) state.appointmentTime = facts.appointment_time.trim();
  if (facts.zoom_agreed) state.zoomAgreed = true;
  if (facts.duration_agreed) state.durationAgreed = true;
  if (facts.calendar_requested) state.calendarRequested = true;
  if (facts.law_change_hook_used) state.lawChangeHookUsed = true;
}
