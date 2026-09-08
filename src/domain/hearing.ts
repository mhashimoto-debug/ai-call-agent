/**
 * ヒアリング7項目（設計書 §4 P8）と、その取得状況のバリデーション。
 *
 * このデモの本命（G2）は「7項目を100%取り切る」こと。
 * したがって取得判定は LLM の自己申告ではなく、ここで宣言的に管理し、
 * 未取得なら P9 への遷移をコード側で機械的にブロックする。
 */
import type { HearingId } from "./types.js";

export interface HearingSlotDef {
  id: HearingId;
  label: string;
  /** 想定の質問文 */
  question: string;
  /** 実データでの実施率（デモの比較材料） */
  humanRate: number;
  /** シミュレーション精度に直結する最重要項目か */
  critical: boolean;
}

export const HEARING_SLOTS: HearingSlotDef[] = [
  {
    id: "H1",
    label: "iDeCo・投資の有無",
    question: "現在 iDeCo やその他の投資はされていますか？（されている場合は月額も）",
    humanRate: 0.8,
    critical: false,
  },
  {
    id: "H2",
    label: "既存の退職金制度",
    question: "御社で退職金制度は何かご導入されていますか？",
    humanRate: 0.87,
    critical: false,
  },
  {
    id: "H3",
    label: "代表年齢",
    question: "差し支えなければ中村様のご年齢を伺えますか？",
    humanRate: 0.87,
    critical: false,
  },
  {
    id: "H4",
    label: "役員人数・年齢",
    question: "役員様は中村様含め何名でいらっしゃいますか？（→ 各役員のご年齢も）",
    humanRate: 0.73,
    critical: true,
  },
  {
    id: "H5",
    label: "社会保険加入人数",
    question: "社会保険にご加入の人数は何名くらいですか？",
    humanRate: 0.67,
    critical: true,
  },
  {
    id: "H6",
    label: "決裁権",
    question: "こういった制度をご導入される際は中村様のご判断で決められますか？",
    humanRate: 0.87,
    critical: false,
  },
  {
    id: "H7",
    label: "決算月",
    question: "御社の決算月はいつになりますでしょうか？",
    humanRate: 0.8,
    critical: false,
  },
];

/** H1〜H7 に加えて P8 で必ず取る連絡情報。 */
export const CONTACT_SLOTS = [
  { id: "email", label: "メールアドレス（復唱確認込み）" },
  { id: "emailConfirmed", label: "メールアドレスの復唱確認" },
  { id: "callbackPhone", label: "前日確認の連絡先" },
  { id: "callbackWindow", label: "前日連絡の希望時間帯" },
] as const;

export type ContactSlotId = (typeof CONTACT_SLOTS)[number]["id"];

export const HEARING_SLOT_MAP = new Map(HEARING_SLOTS.map((s) => [s.id, s]));
