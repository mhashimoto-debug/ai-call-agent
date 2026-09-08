/**
 * 客役の固定台本（設計書 §8-1「客役の台本を先に固定する」）。
 *
 * プレデモの目的は AI のアドリブ評価ではないため、応対者の返答は
 * 設計書 §4 の想定どおりに固定する。
 *
 * - `provides`  : --dry-run（API を呼ばない練習モード）で状態を進めるための情報
 * - `advanceTo` : --dry-run でのフェーズ遷移先。省略時は同じフェーズに留まる。
 *                 本番（LLM）モードではフェーズは LLM の判断＋コード側の検証で決まるため使わない。
 * - `agentSilent`: この発話に対して AI は応答しない（取次ぎ等）。次の台本行と続けて扱う。
 * - `agentSays`  : --dry-run でこの発話への返答として読み上げる AI の台詞。
 *                  省略時はそのフェーズの必須発話。【条】条件発話を使うターンだけ指定する。
 */
import type { ExtractedFacts } from "../domain/state.js";
import type { PhaseId } from "../domain/types.js";

export interface ScriptedLine {
  role: "受付" | "代表 中村様";
  text: string;
  provides?: ExtractedFacts;
  advanceTo?: PhaseId;
  agentSilent?: boolean;
  agentSays?: string;
}

export const DEMO_SCRIPT: ScriptedLine[] = [
  // ── P0 受付突破 ──
  {
    role: "受付",
    text: "はい、株式会社サンプル工業でございます。どういったご用件でしょうか？",
    agentSays:
      "代表の中村様ご自身の退職金のご準備に関する件です。初めに1点だけ確認なのですが、御社では役員様の退職金のご準備や、社員様向けの積立制度は何かされていますか？",
  },
  {
    role: "受付",
    text: "積立の制度ですか…。特に何もしていないと思いますが、少々お待ちください。代表に代わります。",
    agentSilent: true, // 取次ぎ中。AI は代表が出るまで喋らない。
  },
  { role: "代表 中村様", text: "はい、お電話代わりました。中村です。", advanceTo: "P1" },

  // ── P1 → P2 最頻出の断り ──
  {
    role: "代表 中村様",
    text: "ああ、うち、退職金は保険でやってるので大丈夫ですよ。",
    advanceTo: "P2",
  },

  // ── P2 充足度質問が効いて、相手が不足を口にする ──
  {
    role: "代表 中村様",
    text: "私自身の分ですか？うーん…正直そこまで考えたことなかったですね。社員向けにかけてるものなので、自分の分がどうなってるかは把握してないです。",
    advanceTo: "P3",
  },

  // ── P3 差別化 → P4 法改正フック ──
  {
    role: "代表 中村様",
    text: "へえ、経費で落とせるんですか。それは保険とはまた別の話なんですね。",
    advanceTo: "P4",
  },
  { role: "代表 中村様", text: "来年また制度が変わるんですか。それは知らなかったな。", advanceTo: "P5" },

  // ── P5 低ハードル打診 → 多忙・要相談で保留（R2） ──
  {
    role: "代表 中村様",
    text: "うーん、話は分かるんですが今週ちょっとバタバタしてまして。それに、こういうのは妻とも相談してからになるかな。",
    advanceTo: "P6",
  },

  // ── P6 仮押さえクローズが決まる（★決定打） ──
  {
    role: "代表 中村様",
    text: "まあ、仮押さえなら…はい、それなら大丈夫です。",
    advanceTo: "P7",
    agentSays: "ありがとうございます。来週でしたら、午前と午後どちらがよろしいですか？",
  },

  // ── P7 日程2択 → 1点確定 ──
  {
    role: "代表 中村様",
    text: "来週ですね。午前中は現場に出ていることが多いので、午後の方がいいかな。",
    agentSays: "では9月17日（水）14時から30分でいかがでしょうか？",
  },
  {
    role: "代表 中村様",
    text: "17日の14時ね、大丈夫です。あ、ちなみに Zoom って何ですか？パソコンあまり詳しくなくて。",
    provides: { appointment_date: "9月17日（水）", appointment_time: "14時" },
    agentSays:
      "ありがとうございます。Zoom はオンラインの会議システムで、スマートフォンでも参加できます。メールでお送りする URL をタップいただくだけです。",
  },
  {
    role: "代表 中村様",
    text: "なるほど、スマホでURLをタップするだけならできそうです。30分ですね、わかりました。",
    provides: { zoom_agreed: true, duration_agreed: true },
    advanceTo: "P8",
  },

  // ── P8 ヒアリング7項目 ──
  { role: "代表 中村様", text: "はい、大丈夫ですよ。どうぞ。" },
  {
    role: "代表 中村様",
    text: "iDeCo はやってないですね。投資も特にはやっていません。",
    provides: { H1: "iDeCo・投資ともになし" },
  },
  {
    role: "代表 中村様",
    text: "退職金制度は…さっきお話しした保険だけですね。あと私の年齢は、今年で56になります。",
    provides: { H2: "保険（生命保険）のみ", H3: "56歳" },
  },
  {
    role: "代表 中村様",
    text: "役員は私と妻の2名です。妻は52ですね。",
    provides: { H4: "2名（代表56歳・配偶者52歳）" },
  },
  {
    role: "代表 中村様",
    text: "社会保険は…パートを除いて10名くらいかな。10名です。",
    provides: { H5: "10名" },
  },
  {
    role: "代表 中村様",
    text: "決めるのは私ですね。あと決算は3月です。",
    provides: { H6: "代表の判断で決裁可能", H7: "3月" },
  },
  {
    role: "代表 中村様",
    text: "メールは nakamura@sample-kogyo.co.jp です。",
    provides: { email: "nakamura@sample-kogyo.co.jp" },
  },
  { role: "代表 中村様", text: "はい、それで合っています。", provides: { email_confirmed: true } },
  {
    role: "代表 中村様",
    text: "前日の連絡は携帯にください。090-1234-5678 です。午前中がつながりやすいです。",
    provides: { callback_phone: "090-1234-5678", callback_window: "午前中" },
    advanceTo: "P9",
  },

  // ── P9 締め ──
  {
    role: "代表 中村様",
    text: "カレンダーに入れておきますね。はい、当日はよろしくお願いします。",
    advanceTo: "END",
  },
];
