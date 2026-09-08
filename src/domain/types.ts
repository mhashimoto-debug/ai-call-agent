/**
 * 会話フローの型定義。
 * 出典: docs/2026-09-10_プレデモ_勝ちパターン会話フロー設計.md §3〜§7
 */

/** フェーズ ID。P0X は受付ブロック時の撤退（痕跡残し）。 */
export const PHASE_IDS = [
  "P0",
  "P0X",
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
  "P8",
  "P9",
  "END",
] as const;
export type PhaseId = (typeof PHASE_IDS)[number];

/** ガードレール ID。設計書 §5 R1〜R7。R6 は出力前フィルタ（forbidden.ts）で実装。 */
export const GUARDRAIL_IDS = ["R1", "R2", "R3", "R4", "R5", "R7"] as const;
export type GuardrailId = (typeof GUARDRAIL_IDS)[number];

/** ヒアリング項目 ID。設計書 §4 P8 の H1〜H7。 */
export const HEARING_IDS = ["H1", "H2", "H3", "H4", "H5", "H6", "H7"] as const;
export type HearingId = (typeof HEARING_IDS)[number];

export interface PhaseDef {
  id: PhaseId;
  /** デモ画面に出す短いラベル */
  label: string;
  /** このフェーズの目標（プロンプトにそのまま入る） */
  goal: string;
  /** 【必】必ず発話する内容 */
  mustSay: string[];
  /** 【条】条件成立時のみ発話する内容 */
  conditional: { when: string; say: string }[];
  /** 設計意図・原則（プロンプトに入れて発話の質を担保する） */
  principles: string[];
  /** 遷移条件の説明 */
  transition: string;
  /** 遷移を許可する次フェーズ。ここにないフェーズへは進ませない。 */
  allowedNext: PhaseId[];
  /** 想定尺（秒）。デモの尺管理用。 */
  targetElapsedSec: number;
}

export interface GuardrailDef {
  id: GuardrailId;
  /** 発火トリガーの説明 */
  trigger: string;
  /** 相手発話に対する正規表現の前検知。LLM 判定と併用する。 */
  patterns: RegExp[];
  /** 発火時の挙動（プロンプトに命令として注入される） */
  behavior: string;
  /** 発火中は終話（END）を禁止するか */
  forbidEnd: boolean;
  /** 発火時に強制するフェーズ（あれば） */
  forcePhase?: PhaseId;
}
