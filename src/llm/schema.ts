/**
 * 1ターン分の構造化出力スキーマ。
 * 発話と「状態の読み取り」を同じ1回の呼び出しで返させ、
 * 状態の確定（遷移可否・スロット充足）はコード側で検証する。
 */
import { z } from "zod";
import { GUARDRAIL_IDS, PHASE_IDS } from "../domain/types.js";

const phaseEnum = z.enum(PHASE_IDS);
const guardrailEnum = z.enum(GUARDRAIL_IDS);

export const TurnOutputSchema = z.object({
  utterance: z
    .string()
    .describe("電話でそのまま読み上げる日本語の発話。記号・箇条書き・絵文字は使わない。"),
  next_phase: phaseEnum.describe("この発話を終えた後に置くべきフェーズ ID"),
  note: z
    .string()
    .describe("なぜこの発話にしたかの一行メモ（デモ画面に表示する内部メモ。顧客には読まれない）"),
  signals: z.object({
    objection_type: z
      .string()
      .describe("相手の断り・反応の種別（例: 保険で対応済み / 制度なし / 多忙 / なし）"),
    guardrails_fired: z
      .array(guardrailEnum)
      .describe("直前の相手発話に対して適用すべきガードレール ID。無ければ空配列。"),
    is_decision_maker: z.enum(["yes", "no", "unknown"]),
    customer_ended_call: z.boolean().describe("相手が明確に通話を終了しようとしているか"),
  }),
  extracted: z
    .object({
      H1: z.string().nullable().describe("iDeCo・投資の有無（今回判明した場合のみ）"),
      H2: z.string().nullable().describe("既存の退職金制度"),
      H3: z.string().nullable().describe("代表年齢"),
      H4: z.string().nullable().describe("役員人数・年齢"),
      H5: z.string().nullable().describe("社会保険加入人数"),
      H6: z.string().nullable().describe("決裁権の所在"),
      H7: z.string().nullable().describe("決算月"),
      email: z.string().nullable(),
      email_confirmed: z.boolean().describe("メールアドレスを復唱して相手の確認が取れたか"),
      callback_phone: z.string().nullable().describe("前日確認の連絡先"),
      callback_window: z.string().nullable().describe("前日連絡の希望時間帯"),
      appointment_date: z.string().nullable(),
      appointment_time: z.string().nullable(),
      zoom_agreed: z.boolean(),
      duration_agreed: z.boolean().describe("所要15分に同意が取れたか"),
      calendar_requested: z.boolean().describe("今回の発話でカレンダー登録を依頼したか"),
      law_change_hook_used: z.boolean().describe("今回の発話で法改正フックを使ったか"),
    })
    .describe(
      "今回の相手発話および自分の発話から確定した情報のみ。判明していない項目は null / false のままにする。推測で埋めない。",
    ),
});

export type TurnOutput = z.infer<typeof TurnOutputSchema>;
