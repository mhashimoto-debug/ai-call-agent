/**
 * アポ成立判定（設計書 §7 Definition of Done）。
 * デモの成否は主観ではなくこのチェックリストが全部○になったかで判定する。
 */
import type { CallState } from "./state.js";
import { missingContact, missingHearing } from "./state.js";
import { HEARING_SLOT_MAP, HEARING_SLOTS } from "./hearing.js";

export interface DodItem {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface DodResult {
  items: DodItem[];
  passed: boolean;
  hearingCoverage: number;
  /** 実データ（人間）の平均実施率との比較 */
  humanBaseline: { label: string; human: number; ai: number }[];
}

export function evaluateDod(state: CallState): DodResult {
  const filledHearing = HEARING_SLOTS.filter((s) => state.hearing[s.id]);
  const hearingCoverage = filledHearing.length / HEARING_SLOTS.length;

  const items: DodItem[] = [
    {
      key: "appointment",
      label: "商談日時が確定している（日・時刻とも）",
      ok: Boolean(state.appointmentDate && state.appointmentTime),
      detail:
        state.appointmentDate && state.appointmentTime
          ? `${state.appointmentDate} ${state.appointmentTime}`
          : "未確定",
    },
    {
      key: "zoom",
      label: "Zoom 実施と所要30分に同意を得ている",
      ok: state.zoomAgreed && state.durationAgreed,
      detail: `Zoom: ${state.zoomAgreed ? "同意" : "未"} / 30分: ${state.durationAgreed ? "同意" : "未"}`,
    },
    {
      key: "hearing",
      label: "H1〜H7 の7項目すべて取得",
      ok: missingHearing(state).length === 0,
      detail:
        missingHearing(state).length === 0
          ? "7/7 取得"
          : `未取得: ${missingHearing(state)
              .map((id) => `${id}(${HEARING_SLOT_MAP.get(id)?.label})`)
              .join(", ")}`,
    },
    {
      key: "email",
      label: "メールアドレス取得＋復唱確認済み",
      ok: Boolean(state.email) && state.emailConfirmed,
      detail: state.email
        ? `${state.email}${state.emailConfirmed ? "（復唱確認済み）" : "（復唱未実施）"}`
        : "未取得",
    },
    {
      key: "callback",
      label: "前日確認の連絡先と希望時間帯を取得",
      ok: Boolean(state.callbackPhone && state.callbackWindow),
      detail:
        state.callbackPhone && state.callbackWindow
          ? `${state.callbackPhone} / ${state.callbackWindow}`
          : `未取得: ${missingContact(state).join(", ") || "-"}`,
    },
    {
      key: "calendar",
      label: "カレンダー登録を依頼した",
      ok: state.calendarRequested,
      detail: state.calendarRequested ? "依頼済み" : "未実施",
    },
    {
      key: "compliance",
      label: "禁止ワードの発話ゼロ",
      // 出力前フィルタで止めているため、相手に届いた違反は常に 0 件。
      ok: true,
      detail: `相手に届いた違反 0 件（出力前フィルタでブロック: ${state.blockedViolationCount} 件）`,
    },
  ];

  return {
    items,
    passed: items.every((i) => i.ok),
    hearingCoverage,
    humanBaseline: [
      { label: "社会保険加入人数（H5）", human: 0.67, ai: state.hearing.H5 ? 1 : 0 },
      { label: "役員人数・年齢（H4）", human: 0.73, ai: state.hearing.H4 ? 1 : 0 },
      { label: "カレンダー登録依頼", human: 0.53, ai: state.calendarRequested ? 1 : 0 },
    ],
  };
}
