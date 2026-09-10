/**
 * 対話判定エンジン（自由発話用・API 不要）。
 *
 * 台本再生（mockEngine）と違い、相手が何を言うか分からない前提で
 * 「ガードレール判定 → 一括情報抽出 → フェーズ別の意図判定 → 応答文とフェーズ遷移」を決める。
 * マイク入力（音声認識）の結果をそのままここに渡す。
 *
 * 重要: フェーズ遷移の可否とスロット充足の判定は domain/ の同じコードを通す。
 * したがって「7項目が揃うまで P9 へ進めない」「R1 発火中は終話しない」等の
 * 担保は、自由発話でもそのまま効く。
 *
 * 応答には対応する録音（public/audio/*.mp3）のパスを紐付けて返す。
 * 画面側はこれがあれば TTS ではなく録音を優先再生する（詳細は AUDIO_BASE 付近のコメント）。
 */
import { PHASES } from "../domain/phases.js";
import { GUARDRAILS, detectGuardrails } from "../domain/guardrails.js";
import { HEARING_SLOT_MAP } from "../domain/hearing.js";
import {
  applyExtracted,
  missingHearing,
  resolveTransition,
  type CallState,
  type ExtractedFacts,
} from "../domain/state.js";
import { autoFix, checkForbidden, type Violation } from "../domain/forbidden.js";
import type { GuardrailId, HearingId, PhaseId } from "../domain/types.js";
import { DEMO_SCENARIO } from "./scenario.js";

export interface DialogReply {
  utterance: string;
  phase: PhaseId;
  guardrails: GuardrailId[];
  /** どのルールで分岐したか（画面に出して「なぜこう返したか」を見せる） */
  matched: string;
  overrideReason?: string;
  /** 出力前フィルタで遮断した違反 */
  blocked: Violation[];
  /**
   * この応答に対応する録音のパス（例: "public/audio/p1_overview.mp3"）。
   * 定型のスクリプト発話にのみ付き、その場で組み立てる質問文には付かない。
   */
  audioFile?: string;
}

// ---------- 録音ファイルの対応表 ----------

/**
 * 録音の置き場所。ページからの相対パスにしてあるので、
 * ローカルの静的サーバでも GitHub Pages（/<repo>/ 配下）でも同じ指定で解決できる。
 */
export const AUDIO_BASE = "public/audio/";

/** フェーズごとの録音。P2/P3 と P4/P5 は 1 本の録音が両方を含む。 */
export const PHASE_AUDIO: Partial<Record<PhaseId, string>> = {
  P0: "p0_greeting.mp3",
  P0X: "reject_closing.mp3",
  P1: "p1_overview.mp3",
  P2: "p2_p3_hearing.mp3",
  P3: "p2_p3_hearing.mp3",
  P4: "p4_p5_hearin.mp3",
  P5: "p4_p5_hearin.mp3",
  P6: "reschedule.mp3",
  P7: "p7_schedule.mp3",
  P8: "p8_recovery.mp3",
  P9: "p9_closing.mp3",
};

/** ガードレール発火時の切り返し録音。 */
export const GUARDRAIL_AUDIO: Record<GuardrailId, string> = {
  R1: "r1_no_system.mp3",
  R2: "r2_busy.mp3",
  R3: "r3_expert.mp3",
  R4: "r4_document.mp3",
  R5: "r5_misunderstanding.mp3",
  R7: "r7_absent.mp3",
};

export const audioUrl = (file: string): string => `${AUDIO_BASE}${file}`;

// ---------- 判定辞書 ----------
// 実際の架電で出る言い回しに合わせて広めに取る。
// 迷ったら「取りこぼさない」側に倒し、誤爆が致命的になる語（人数・月）だけ文脈語を必須にする。

/** 肯定。 */
const YES =
  /(はい|ええ|うん|そうです|そうですね|そうしま|もちろん|ぜひ|是非|わかりました|分かりました|承知|了解|大丈夫|平気|問題ありませ|問題ない|構いませ|かまいませ|お願いし|いいです|いいよ|良いです|結構ですよ|それで|オッケー|オーケー|ＯＫ|OK|どうぞ|お聞きし|聞いてみ|やってみ)/i;
/** 否定。「結構ですよ」（肯定）と「結構です」（断り）を取り違えないようにする。 */
const NO =
  /(いいえ|いえいえ|いや|結構です(?!よ)|けっこうです|いりません|要りません|必要ありませ|必要ない|不要|遠慮|間に合って|やめ|やらない|やりません|しません|やめておき|興味(は|が)?(ない|ありませ)|関心(は|が)?(ない|ありませ)|見送|お断り|断りし|だめ|ダメ|駄目)/;
/** 用件を問われた。 */
const ASK_PURPOSE =
  /(ご用件|用件|ご用|どういった|どういう|どのような|どんな|なんの|何の|なんでしょ|どちら様|どちらさま|どなた|失礼ですが|どこの|お名前|会社名|目的|なにか|何か)(です|でしょ|ですか|ますか|かしら)?/;
/** 取次ぎが発生した。 */
const TRANSFER =
  /(お待ち|少々|少し待|代わり|かわり|変わり|繋ぎ|つなぎ|お繋ぎ|呼んで|呼びま|確認しま|担当に|本人に|代表に|社長に|今呼び|まいります)/;
/** 受付での営業電話ブロック。 */
const REFUSE_SALES =
  /(営業(の)?(お)?電話|営業は|セールス|勧誘|売り込み|お断り(し|する|して|です)|断るよう|取り次げ|取次(ぎ)?でき|お繋ぎでき|お受けでき|そういう(お)?電話|この手の電話|一切受け付け|間に合ってます)/;
/** 日程が合わない。 */
const SCHEDULE_NG =
  /(都合が悪|都合つか|都合がつか|予定が入って|埋まって|ふさがって|塞がって|空いて(ない|いない|ませ)|厳しい|難しい|無理です|無理かな|出張(で|が|に)|休みで|定休|別の日|他の日|ほかの日|再来週|変更|ずらし|遅らせ|もう少し先)/;
/** 日程に同意した。 */
const SCHEDULE_OK =
  /(大丈夫|空いて(ます|います|る)|問題ありませ|問題ない|構いませ|かまいませ|いけます|行けます|参加でき|出られ|可能です|お願いします|入れておき|それで(いい|結構|お願い)|承知|了解)/;
/** 時間帯の指定。2択に答えたとみなす。 */
const TIME_SLOT =
  /(午前|午後|朝|昼|夕方|夜|前半|後半|早い時間|遅い時間|\d{1,2}\s*時|\d{1,2}\s*日|来週|再来週|明日|明後日|週明け|月曜|火曜|水曜|木曜|金曜)/;

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/;
const COUNT_RE = /(\d+|[〇一二三四五六七八九十]{1,4})\s*(名|人)/;
const AGE_RE = /(\d{1,3})\s*(歳|才)|(?:今年で|年齢は)\s*(\d{1,3})/;
const MONTH_RE = /(\d{1,2}|[一二三四五六七八九十]{1,3})\s*月/;

// ---------- 一括情報抽出（まとめ聞き対応） ----------
// 「役員は私を入れて3名、社会保険は10名、決算は3月です」のように
// 複数の項目をまとめて答えられても、その場で全部拾って以降の質問を飛ばす。
// 人数・月は誤爆すると質問を飛ばしてしまうため、必ず文脈語（役員/社会保険/決算など）を要求する。

/** 役員人数（H4）。「役員は3名」と「3名の役員」の両方向。 */
const OFFICER_COUNT = /(?:役員|取締役|重役|代表者)[^。、]{0,12}?(\d{1,3}|[〇一二三四五六七八九十]{1,4})\s*(?:名|人)/;
const OFFICER_COUNT_REV = /(\d{1,3}|[〇一二三四五六七八九十]{1,4})\s*(?:名|人)[^。、]{0,8}?(?:役員|取締役|重役)/;
/** 社会保険加入人数（H5）。 */
const INSURED_COUNT =
  /(?:社会保険|社保|厚生年金|健康保険|従業員|社員|スタッフ|正社員|加入)[^。、]{0,12}?(\d{1,3}|[〇一二三四五六七八九十]{1,4})\s*(?:名|人)/;
const INSURED_COUNT_REV =
  /(\d{1,3}|[〇一二三四五六七八九十]{1,4})\s*(?:名|人)[^。、]{0,10}?(?:社会保険|社保|厚生年金|加入|従業員|社員)/;
/** 決算月（H7）。 */
const FISCAL_MONTH = /(?:決算|期末|決算期)[^。、]{0,8}?(\d{1,2}|[一二三四五六七八九十]{1,3})\s*月/;
const FISCAL_MONTH_REV = /(\d{1,2}|[一二三四五六七八九十]{1,3})\s*月\s*(?:が|の|で)?\s*(?:決算|締め)/;
/** 代表の年齢（H3）。他人の年齢を拾わないよう一人称・年齢語を必須にする。 */
const SELF_AGE =
  /(?:私|自分|わたし|わたくし|当方|年齢|今年で|歳は)[^。、]{0,8}?(\d{1,3}|[一二三四五六七八九十]{1,3})\s*(?:歳|才|になり)/;

const KANJI_DIGITS = "〇一二三四五六七八九";

/** 「十二」「二十五」等の簡単な漢数字を数値にする。算用数字はそのまま返す。 */
export function toNumber(raw: string): number | null {
  const s = raw.trim();
  if (/^\d+$/.test(s)) return Number(s);
  if (!/^[〇一二三四五六七八九十]+$/.test(s)) return null;
  if (!s.includes("十")) {
    let n = 0;
    for (const ch of s) {
      const d = KANJI_DIGITS.indexOf(ch);
      if (d < 0) return null;
      n = n * 10 + d;
    }
    return n;
  }
  const [tensPart = "", onesPart = ""] = s.split("十");
  const tens = tensPart === "" ? 1 : KANJI_DIGITS.indexOf(tensPart);
  const ones = onesPart === "" ? 0 : KANJI_DIGITS.indexOf(onesPart);
  if (tens < 0 || ones < 0) return null;
  return tens * 10 + ones;
}

/** 1つ目にマッチしたパターンの数値を返す。 */
function firstNumber(text: string, patterns: RegExp[]): number | null {
  for (const p of patterns) {
    const m = p.exec(text);
    const n = m?.[1] ? toNumber(m[1]) : null;
    if (n !== null && n > 0) return n;
  }
  return null;
}

export interface BulkFacts {
  /** 役員人数 */
  officers?: number;
  /** 社会保険加入人数 */
  insured?: number;
  /** 決算月 */
  fiscalMonth?: number;
  /** 代表年齢 */
  age?: number;
}

/**
 * 1発話から人数・決算月・年齢をまとめて拾う。
 * 質問の文脈に依存しないので、どのフェーズの発話に対しても呼んでよい。
 */
export function bulkExtract(text: string): BulkFacts {
  const facts: BulkFacts = {};
  const officers = firstNumber(text, [OFFICER_COUNT, OFFICER_COUNT_REV]);
  const insured = firstNumber(text, [INSURED_COUNT, INSURED_COUNT_REV]);
  const month = firstNumber(text, [FISCAL_MONTH, FISCAL_MONTH_REV]);
  const age = firstNumber(text, [SELF_AGE]);
  if (officers !== null) facts.officers = officers;
  if (insured !== null) facts.insured = insured;
  if (month !== null && month >= 1 && month <= 12) facts.fiscalMonth = month;
  if (age !== null && age >= 18 && age <= 99) facts.age = age;
  return facts;
}

/** P8 で今どのスロットを聞いているか。 */
type PendingSlot = HearingId | "email" | "emailConfirm" | "callbackPhone" | "callbackWindow";

export class DialogEngine {
  private pending: PendingSlot | null = null;
  /** 直前の発話で一括抽出できた項目（画面に「まとめ聞きで取得」と出すため） */
  private harvested: HearingId[] = [];
  /** 再生済みの録音。同じ録音を1通話で二度流さない（P2/P3 等は1本に収録されている） */
  private playedAudio = new Set<string>();

  constructor(private state: CallState) {}

  /** 架電開始の第一声。 */
  greeting(): DialogReply {
    return this.reply(PHASES.P0.mustSay[0] ?? "", "P0", [], "架電開始", PHASE_AUDIO.P0);
  }

  /** 相手の発話を受けて応答を1つ返す。state は破壊的に更新される。 */
  respond(customerText: string): DialogReply {
    const text = customerText.trim();
    const fired = detectGuardrails(text);
    for (const g of fired) {
      if (!this.state.firedGuardrails.includes(g)) this.state.firedGuardrails.push(g);
    }

    // まとめ聞き対応: 質問していない項目でも、言われた時点で拾って保持する
    this.harvested = this.harvest(text);

    const g = this.byGuardrail(text, fired);
    if (g) return g;

    switch (this.state.phase) {
      case "P0":
        return this.p0(text, fired);
      case "P1":
        return this.p1(text, fired);
      case "P2":
        return this.p2(text, fired);
      case "P3":
        return this.p3(text, fired);
      case "P4":
        return this.reply(PHASES.P5.mustSay.join(" "), "P5", fired, "法改正フック後 → 低ハードル打診", PHASE_AUDIO.P5);
      case "P5":
        return this.p5(text, fired);
      case "P6":
        return this.p6(text, fired);
      case "P7":
        return this.p7(text, fired);
      case "P8":
        return this.p8(text, fired);
      case "P9":
        return this.reply("本日はお時間をいただきありがとうございました。失礼いたします。", "END", fired, "締め完了");
      default:
        return this.reply("ありがとうございました。失礼いたします。", "END", fired, "終話");
    }
  }

  /**
   * 発話から人数・決算月・年齢を拾って state に入れる。
   * すでに取得済みの項目は上書きしない（取りこぼし防止と同じ方針）。
   * 戻り値は「今回新しく埋まった項目」。
   */
  private harvest(text: string): HearingId[] {
    const b = bulkExtract(text);
    const facts: ExtractedFacts = {};
    const filled: HearingId[] = [];
    const put = (id: HearingId, value: string): void => {
      if (this.state.hearing[id]) return;
      facts[id] = value;
      filled.push(id);
    };
    if (b.officers !== undefined) put("H4", `${b.officers}名（${text}）`);
    if (b.insured !== undefined) put("H5", `${b.insured}名`);
    if (b.fiscalMonth !== undefined) put("H7", `${b.fiscalMonth}月`);
    if (b.age !== undefined) put("H3", `${b.age}歳`);
    if (filled.length > 0) applyExtracted(this.state, facts);
    return filled;
  }

  // ---------- ガードレール優先の分岐（設計書 §5） ----------

  private byGuardrail(text: string, fired: GuardrailId[]): DialogReply | null {
    const has = (id: GuardrailId): boolean => fired.includes(id);

    // R5: 公的機関との誤認は最優先で解く
    if (has("R5")) {
      return this.reply(
        "紛らわしくて申し訳ございません。制度は厚生労働省の管轄ですが、私どもは民間の導入支援事業者でございます。",
        this.state.phase,
        fired,
        "R5: 公的機関との誤認を即座に訂正",
        GUARDRAIL_AUDIO.R5,
      );
    }
    // R7: 決裁者でない／不在なら、次回接触条件の確定に切り替える
    if (has("R7")) {
      return this.reply(
        "承知いたしました。それでは代表の方はいつ頃お戻りでしょうか。お繋ぎいただきやすい時間帯だけ教えていただけますと助かります。",
        this.state.phase,
        fired,
        "R7: ヒアリングを止めて次回接触条件の確定へ",
        GUARDRAIL_AUDIO.R7,
      );
    }
    // R1: 「制度がない」は断りではなく最も見込みが高いホットサイン
    if (has("R1")) {
      return this.reply(
        "そうなのですね、ありがとうございます。これから作られる前提で、役員様1名からでもご導入いただけます。" +
          PHASES.P3.mustSay.map((m) => m.replace(/^（[^）]*）/, "")).join(" "),
        "P3",
        fired,
        "R1: 断り判定を禁止し、差別化(P3)へ",
        GUARDRAIL_AUDIO.R1,
      );
    }
    // R3: 専門家を否定せず、判断材料を渡す立場に回る
    if (has("R3")) {
      return this.reply(
        "さすがですね。先生にご相談いただくための判断材料をお渡しするところまでが私どもの担当ですので、その材料だけお持ちできればと思っております。",
        this.state.phase,
        fired,
        "R3: 専門家を否定せず判断材料の提供に回る",
        GUARDRAIL_AUDIO.R3,
      );
    }
    // R4: 資料送付で終わらせず、手段の選択と再架電日をセットで取る
    if (has("R4")) {
      return this.reply(
        "承知いたしました。資料はメール・SMS・郵送のいずれがよろしいでしょうか。お送りしたうえで、改めてご感想だけ伺うお電話を差し上げたいのですが、来週でしたら前半と後半どちらがご都合よろしいですか？",
        this.state.phase,
        fired,
        "R4: 送付手段の選択＋再架電日の確定をセットで",
        GUARDRAIL_AUDIO.R4,
      );
    }
    // R2: 忙しい相手に制度説明を被せない。時間の約束だけに切り替える
    if (has("R2")) {
      const target: PhaseId = this.state.phase === "P8" || this.state.phase === "P9" ? this.state.phase : "P6";
      return this.reply(
        "お忙しいところ失礼いたしました。お時間は取らせません。" +
          PHASES.P6.mustSay.map((m) => m.replace(/^（[^）]*）/, "")).join(" "),
        target,
        fired,
        "R2: 説明を被せず仮押さえクローズへ",
        GUARDRAIL_AUDIO.R2,
      );
    }
    return null;
  }

  // ---------- フェーズ別の意図判定 ----------

  private p0(text: string, fired: GuardrailId[]): DialogReply {
    if (REFUSE_SALES.test(text)) {
      return this.reply(PHASES.P0X.mustSay.join(" "), "P0X", fired, "受付ブロック → 痕跡を残して撤退", PHASE_AUDIO.P0X);
    }
    if (TRANSFER.test(text)) {
      // 代表が出る前に名乗りを始めないよう、ここでは短く受けるだけにする
      return this.reply(
        "ありがとうございます。よろしくお願いいたします。",
        "P1",
        fired,
        "取次ぎ発生 → 代表が出るのを待つ(P1)",
      );
    }
    if (ASK_PURPOSE.test(text)) {
      return this.reply(PHASES.P0.conditional[0]?.say ?? "", "P0", fired, "用件を問われた → 巻き込み質問で返す");
    }
    return this.reply(PHASES.P0.mustSay[0] ?? "", "P0", fired, "取次ぎ依頼を簡潔に繰り返す");
  }

  private p1(text: string, fired: GuardrailId[]): DialogReply {
    // 名乗り（立場の切り分け＋巻き込み質問）がまだなら、まずそれを行う
    const introduced = this.state.turns.some(
      (t) => t.speaker === "agent" && /突然のお電話/.test(t.text),
    );
    if (!introduced) {
      return this.reply(
        PHASES.P1.mustSay.join(" "),
        "P1",
        fired,
        "代表接続 → 名乗り＋立場の切り分け＋巻き込み質問",
        PHASE_AUDIO.P1,
      );
    }
    // 相手が挙げた既存の備えを受け止めてから、充足度を問う（設計書 P2）
    const ack = /保険/.test(text)
      ? "保険でご準備されているんですね、ありがとうございます。"
      : /中退共/.test(text)
        ? "中退共にご加入なんですね、ありがとうございます。"
        : "ありがとうございます。";
    return this.reply(
      `${ack}ちなみにそちらは、${DEMO_SCENARIO.contactName}様ご自身の退職金のご準備としても十分に活用できていらっしゃいますか？`,
      "P2",
      fired,
      "受け止め → 充足度質問（「あるか」ではなく「足りているか」）",
      PHASE_AUDIO.P2,
    );
  }

  private p2(text: string, fired: GuardrailId[]): DialogReply {
    return this.reply(
      PHASES.P3.mustSay.map((m) => m.replace(/^（[^）]*）/, "")).join(" "),
      "P3",
      fired,
      "現状の不足・不明を確認 → 差別化(P3)",
      PHASE_AUDIO.P3,
    );
  }

  private p3(text: string, fired: GuardrailId[]): DialogReply {
    if (/中退共/.test(text)) {
      return this.reply(
        PHASES.P3.conditional[0]?.say ?? "",
        "P3",
        fired,
        "条件分岐: 中退共は従業員のみが対象",
      );
    }
    if (/(iDeCo|イデコ|小規模企業共済)/i.test(text)) {
      return this.reply(
        PHASES.P3.conditional[1]?.say ?? "",
        "P3",
        fired,
        "条件分岐: iDeCo・小規模企業共済とは併用可能",
      );
    }
    if (this.state.lawChangeHookUsed) {
      return this.reply(PHASES.P5.mustSay.join(" "), "P5", fired, "法改正フックは使用済み → P5 へ", PHASE_AUDIO.P5);
    }
    return this.reply(PHASES.P4.mustSay.join(" "), "P4", fired, "差別化を理解 → 法改正フック(1回のみ)", PHASE_AUDIO.P4);
  }

  private p5(text: string, fired: GuardrailId[]): DialogReply {
    if ((YES.test(text) || SCHEDULE_OK.test(text)) && !NO.test(text)) {
      return this.reply(
        "ありがとうございます。来週でしたら、午前と午後どちらがよろしいですか？",
        "P7",
        fired,
        "即OK → 日程2択クローズ",
        PHASE_AUDIO.P7,
      );
    }
    return this.reply(
      PHASES.P6.mustSay.map((m) => m.replace(/^（[^）]*）/, "")).join(" "),
      "P6",
      fired,
      "保留・要相談 → 仮押さえクローズ",
      PHASE_AUDIO.P6,
    );
  }

  private p6(text: string, fired: GuardrailId[]): DialogReply {
    if ((YES.test(text) || SCHEDULE_OK.test(text)) && !NO.test(text)) {
      return this.reply(
        "ありがとうございます。来週でしたら、午前と午後どちらがよろしいですか？",
        "P7",
        fired,
        "仮押さえ同意 → 日程2択",
        PHASE_AUDIO.P7,
      );
    }
    return this.reply(
      "承知いたしました。それでは本日中でお時間いただける頃はございませんか？",
      "P6",
      fired,
      "再架電の約束に切り替え",
      PHASE_AUDIO.P6,
    );
  }

  private p7(text: string, fired: GuardrailId[]): DialogReply {
    if (/(ズーム|zoom)/i.test(text) && /(何|なに|わからない|分からない|使えない|詳しくない)/.test(text)) {
      return this.reply(
        "スマートフォンでも参加できます。メールでお送りするURLをタップいただくだけです。",
        "P7",
        fired,
        "条件分岐: Zoom の説明",
      );
    }
    if (/(遠い|距離|来られ|お越し)/.test(text)) {
      return this.reply("オンラインですので移動は不要です。", "P7", fired, "条件分岐: オンラインなので移動不要");
    }
    // 時間帯の指定がないまま「その日は難しい」と言われたケース。開いた質問に戻さず2択で出し直す
    if (SCHEDULE_NG.test(text) && !TIME_SLOT.test(text)) {
      return this.reply(
        "承知いたしました。それでは再来週でしたら、前半と後半のどちらがご都合よろしいでしょうか？",
        "P7",
        fired,
        "日程NG → 別週の2択で出し直す",
      );
    }
    const sc = DEMO_SCENARIO;
    if (TIME_SLOT.test(text)) {
      return this.reply(
        `ありがとうございます。では${sc.proposedDate}${sc.proposedTime}から${sc.meetingMinutes}分でいかがでしょうか？`,
        "P7",
        fired,
        "2択の回答 → 1点に確定させる",
      );
    }
    if ((YES.test(text) || SCHEDULE_OK.test(text)) && !NO.test(text)) {
      applyExtracted(this.state, {
        appointment_date: sc.proposedDate,
        appointment_time: sc.proposedTime,
        zoom_agreed: true,
        duration_agreed: true,
      });
      this.pending = null;
      return this.reply(
        PHASES.P8.mustSay[0]?.replace(/^（[^）]*）/, "") ?? "",
        "P8",
        fired,
        "日時確定 → ヒアリングの許可取得(P8)",
        PHASE_AUDIO.P8,
      );
    }
    return this.reply("来週でしたら、午前と午後どちらがよろしいですか？", "P7", fired, "開いた質問は使わず2択で聞き直す");
  }

  // ---------- P8: ヒアリング7項目 ----------

  private p8(text: string, fired: GuardrailId[]): DialogReply {
    const notes: string[] = [];
    if (this.harvested.length > 0) {
      notes.push(`まとめ聞きで ${this.harvested.join("・")} を同時取得`);
    }

    if (this.pending) {
      if (this.isFilled(this.pending)) {
        // 一括回答ですでに埋まっている項目は聞き直さない
        notes.push(`${this.pending} は回答済みのため質問をスキップ`);
      } else {
        const { facts, ok } = this.extract(this.pending, text);
        if (ok) {
          applyExtracted(this.state, facts);
          notes.push(`${this.pending} を取得`);
        } else {
          // 取れなかった項目は次へ進めず聞き直す（G2 の担保）
          return this.reply(this.askText(this.pending), "P8", fired, `${this.pending} が聞き取れず再質問`);
        }
      }
    }

    const nextSlot = this.nextSlot();
    if (!nextSlot) {
      this.pending = null;
      return this.reply(
        PHASES.P9.mustSay.map((m) => m.replace(/^（[^）]*）/, "")).join(" "),
        "P9",
        fired,
        `${notes.join(" / ") || "取得完了"} → 7項目＋連絡先が揃ったので締め(P9)`,
        PHASE_AUDIO.P9,
      );
    }
    this.pending = nextSlot;
    return this.reply(
      this.askText(nextSlot),
      "P8",
      fired,
      `${notes.length > 0 ? notes.join(" / ") + " → " : ""}次は ${nextSlot}`,
    );
  }

  /** そのスロットがすでに埋まっているか。 */
  private isFilled(slot: PendingSlot): boolean {
    switch (slot) {
      case "email":
        return Boolean(this.state.email);
      case "emailConfirm":
        return this.state.emailConfirmed;
      case "callbackPhone":
        return Boolean(this.state.callbackPhone);
      case "callbackWindow":
        return Boolean(this.state.callbackWindow);
      default:
        return Boolean(this.state.hearing[slot]);
    }
  }

  private nextSlot(): PendingSlot | null {
    const h = missingHearing(this.state)[0];
    if (h) return h;
    if (!this.state.email) return "email";
    if (!this.state.emailConfirmed) return "emailConfirm";
    if (!this.state.callbackPhone) return "callbackPhone";
    if (!this.state.callbackWindow) return "callbackWindow";
    return null;
  }

  private askText(slot: PendingSlot): string {
    switch (slot) {
      case "email":
        return "会社概要とZoomのURLをお送りしたいのですが、メールアドレスを伺えますでしょうか？";
      case "emailConfirm":
        return `復唱させていただきます。${this.state.email} でお間違いないでしょうか？`;
      case "callbackPhone":
        return "前日に確認のご連絡を差し上げたいのですが、お電話番号を伺えますでしょうか？";
      case "callbackWindow":
        return "前日のご連絡は、何時頃が繋がりやすいでしょうか？";
      default:
        return (HEARING_SLOT_MAP.get(slot)?.question ?? "").replace(/（[^）]*）\s*$/, "");
    }
  }

  /** 「今どの項目を聞いているか」が分かっているので、その文脈で回答を解釈する。 */
  private extract(slot: PendingSlot, text: string): { facts: ExtractedFacts; ok: boolean } {
    const num = COUNT_RE.exec(text)?.[1];
    const count = num ? toNumber(num) : null;
    switch (slot) {
      case "H1":
        return {
          facts: {
            H1: /(やって(い)?ませ|して(い)?ませ|入って(い)?ませ|やってな|してな|入ってな|ない|いない|特に|無し|なし|未加入|ありませ|ございませ)/.test(
              text,
            )
              ? "iDeCo・投資ともになし"
              : text,
          },
          ok: true,
        };
      case "H2":
        return { facts: { H2: text }, ok: true };
      case "H3": {
        const m = AGE_RE.exec(text);
        const age = m?.[1] ?? m?.[3];
        return { facts: { H3: age ? `${age}歳` : text }, ok: Boolean(age) };
      }
      case "H4":
        return { facts: { H4: count !== null ? `${count}名（${text}）` : text }, ok: count !== null };
      case "H5":
        return { facts: { H5: count !== null ? `${count}名` : text }, ok: count !== null };
      case "H6":
        return {
          facts: {
            H6: /(私|自分|わたし|一人で|独断|即決|はい|そうです|決められ|決めて|決裁|判断でき)/.test(text)
              ? "代表の判断で決裁可能"
              : text,
          },
          ok: true,
        };
      case "H7": {
        const m = MONTH_RE.exec(text);
        const month = m?.[1] ? toNumber(m[1]) : null;
        return { facts: { H7: month !== null ? `${month}月` : text }, ok: month !== null };
      }
      case "email": {
        const m = EMAIL_RE.exec(text.replace(/\s/g, ""));
        return { facts: { email: m?.[0] ?? null }, ok: Boolean(m) };
      }
      case "emailConfirm":
        return { facts: { email_confirmed: true }, ok: YES.test(text) && !NO.test(text) };
      case "callbackPhone": {
        const m = PHONE_RE.exec(text.replace(/\s/g, ""));
        return { facts: { callback_phone: m?.[0] ?? null }, ok: Boolean(m) };
      }
      case "callbackWindow":
        return { facts: { callback_window: text }, ok: /(午前|午後|朝|昼|夕方|夜|時|いつでも)/.test(text) };
    }
  }

  // ---------- 応答の確定（フィルタ・遷移検証・履歴） ----------

  private reply(
    raw: string,
    proposed: PhaseId,
    fired: GuardrailId[],
    matched: string,
    audio?: string,
  ): DialogReply {
    // 出力前フィルタ（設計書 §6）。定型文ベースでも必ず通す。
    const fixed = autoFix(raw);
    const blocked = checkForbidden(raw).filter((v) => v.fixable);
    const utterance = fixed.text;

    applyExtracted(this.state, {
      calendar_requested: /カレンダー/.test(utterance),
      law_change_hook_used: /(法改正|62,?000円)/.test(utterance),
    });

    const forbidEnd = (Object.keys(GUARDRAILS) as GuardrailId[]).filter((id) => GUARDRAILS[id].forbidEnd);
    const t = resolveTransition(this.state, proposed, fired, forbidEnd);

    // 同じ録音を二度流さない。2回目は画面側の TTS にフォールバックする
    let audioFile: string | undefined;
    if (audio && !this.playedAudio.has(audio)) {
      this.playedAudio.add(audio);
      audioFile = audioUrl(audio);
    }

    this.state.turns.push({
      index: this.state.turns.length,
      speaker: "agent",
      text: utterance,
      phase: this.state.phase,
      blockedViolations: blocked.length > 0 ? blocked : undefined,
      note: matched,
    });
    this.state.blockedViolationCount += blocked.length;
    this.state.phase = t.phase;
    if (t.phase === "END" || t.phase === "P0X") this.state.ended = t.phase === "END";

    return {
      utterance,
      phase: t.phase,
      guardrails: fired,
      matched,
      overrideReason: t.overrideReason,
      blocked,
      audioFile,
    };
  }

  /** 相手の発話を履歴に積む（画面側から呼ぶ）。 */
  pushCustomer(text: string, guardrails: GuardrailId[]): void {
    this.state.turns.push({
      index: this.state.turns.length,
      speaker: "customer",
      text,
      phase: this.state.phase,
      guardrails,
    });
  }
}
