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

// ---------- 収録台本（Vrew 台本 = 画面表示テキスト = 音声） ----------

/**
 * 録音の置き場所。ページからの相対パスにしてあるので、
 * ローカルの静的サーバでも GitHub Pages（/<repo>/ 配下）でも同じ指定で解決できる。
 */
export const AUDIO_BASE = "public/audio/";

export interface VoiceLine {
  /** public/audio/ 内のファイル名 */
  readonly file: string;
  /** 収録した読み上げ内容そのもの */
  readonly text: string;
}

/**
 * Vrew に入力した最新台本。
 *
 * 画面に出す文字列と再生する音声を必ずこの1箇所から取り出すことで、
 * 「表示テキストと音声が食い違う」ことが構造的に起きないようにしている。
 * 台本を直すときはここだけを直す（対応する MP3 の録り直しも必要）。
 */
export const VOICE_LINES = {
  greeting: {
    file: "p0_greeting.mp3",
    text: "お世話になっております。私、企業型確定拠出年金相談センターと申します。2026年12月の法改正の件で、ご担当者様にお繋ぎいただけますでしょうか？",
  },
  overview: {
    file: "p1_overview.mp3",
    text: "あ、ありがとうございます！実は今回の法改正により、企業型DCの導入要件が大幅に緩和され、事業主様の節税効果や優秀な人材確保に向けたメリットが非常に大きくなっております。御社でのご活用状況について確認でお電話させていただきました。",
  },
  hearingAgeCount: {
    file: "p2_p3_hearing.mp3",
    text: "ご回答ありがとうございます！現在御社で対象となる方の主な年齢層と、役員様・従業員様を合わせた全体の人数はおおよそ何名様になりますでしょうか？",
  },
  hearingFiscalEmail: {
    file: "p4_p5_hearin.mp3",
    text: "ご教示ありがとうございます！最新のシミュレーション資料をお送りしたいのですが、御社の決算月と、送付先のメールアドレスをお伺いできますでしょうか？",
  },
  schedule: {
    file: "p7_schedule.mp3",
    text: "ありがとうございます！ご状況に合わせた最適な活用案について、弊社専門スタッフより15分ほどオンラインでご案内できればと存じます。例えば、来週の水曜日14時頃のご都合はいかがでしょうか？",
  },
  reschedule: {
    file: "reschedule.mp3",
    text: "失礼いたしました！それでは、別の日時として木曜日の15時頃はいかがでしょうか？",
  },
  contact: {
    file: "p8_recovery.mp3",
    text: "ご教示いただき誠にありがとうございます！確認のため、ご担当者様の直通のお電話番号、またはメールアドレスをお伺いしてもよろしいでしょうか？",
  },
  closing: {
    file: "p9_closing.mp3",
    text: "お時間をいただき誠にありがとうございます！それではご指定の日時に、お伺いいたしましたメールアドレスへオンライン会議のURLをお送りいたします。当日はどうぞよろしくお願いいたします。失礼いたします。",
  },
  reject: {
    file: "reject_closing.mp3",
    text: "承知いたしました。貴重なお時間をいただき誠にありがとうございました。それでは失礼いたします。",
  },
  r1NoSystem: {
    file: "r1_no_system.mp3",
    text: "あ、失礼いたしました！実は今回の法改正は、まだ導入されていない企業様ほど節税やコスト削減のメリットが大きい内容となっております。差し支えなければ、御社の現在の従業員数だけお伺いできますでしょうか？",
  },
  r2Busy: {
    file: "r2_busy.mp3",
    text: "あ、大変失礼いたしました！お忙しい時間帯にお電話してしまいましたよね。本当に30秒だけ要点をお伝えして、すぐにお電話切らせていただきますね。実は今回の法改正で企業型DCの導入要件が大きく変わり、会社側の節税メリットが非常に大きくなったため確認でお電話いたしました。差し支えなければ、御社の現在の従業員数だけお伺いできますでしょうか？",
  },
  r3Expert: {
    file: "r3_expert.mp3",
    text: "あ、すでに信頼できる専門家様がいらっしゃるのですね！素晴らしいです。ただ、今回の企業型DC法改正は社労士様や税理士様でも見落とされやすい専門領域となっております。セカンドオピニオンとして情報確認だけでもいかがでしょうか？",
  },
  r4Document: {
    file: "r4_document.mp3",
    text: "承知いたしました！ご検討いただきありがとうございます。お送りする資料に相違がないよう、差し支えなければ送付先のメールアドレスをお伺いできますでしょうか？",
  },
  r5OtherScheme: {
    file: "r5_misunderstanding.mp3",
    text: "あ、ご認識ありがとうございます！実はiDeCoや個人の年金ではなく、会社側の社会保険料や税金も軽減できる企業型の制度についての法改正となっております。",
  },
  r7Absent: {
    file: "r7_absent.mp3",
    text: "承知いたしました。お戻りの際にご案内資料をお渡しできればと存じますので、恐れ入りますがご担当者様のメールアドレスか、ご直通のお電話番号をお伺いしてもよろしいでしょうか？",
  },
} as const satisfies Record<string, VoiceLine>;

export type VoiceLineId = keyof typeof VOICE_LINES;

/** 言い直しの対象にしない台本（言い切って終わるもの）。 */
const CLOSING_LINES = new Set<VoiceLineId>(["reject", "closing"]);

/**
 * 短い聞き返し。
 * 直前に流したばかりの台本をもう一度そのまま流すと、長い説明が2回続いて不自然になる。
 * その場合はここから、同じことを一言で聞き直す（録音は無いので音声合成）。
 */
const RECAP: Partial<Record<VoiceLineId, string>> = {
  greeting: "恐れ入ります、2026年12月の法改正の件で、ご担当者様にお繋ぎいただけますでしょうか？",
  overview: "恐れ入ります、御社では役員様の退職金のご準備は何かされていますでしょうか？",
  hearingAgeCount: "恐れ入ります、役員様と従業員様を合わせて、おおよそ何名様でいらっしゃいますか？",
  hearingFiscalEmail: "恐れ入ります、御社の決算月はいつになりますでしょうか？",
  schedule: "恐れ入ります、来週の水曜日14時頃でしたら、ご都合いかがでしょうか？",
  reschedule: "恐れ入ります、木曜日の15時頃でしたら、ご都合いかがでしょうか？",
  contact: "恐れ入ります、ご担当者様のお電話番号かメールアドレスを伺えますでしょうか？",
  r1NoSystem: "恐れ入ります、御社の現在の従業員数だけ伺えますでしょうか？",
  r2Busy: "恐れ入ります、御社の現在の従業員数だけ伺えますでしょうか？",
  r3Expert: "恐れ入ります、セカンドオピニオンとして情報のご確認だけでもいかがでしょうか？",
  r4Document: "恐れ入ります、送付先のメールアドレスを伺えますでしょうか？",
  r5OtherScheme: "恐れ入ります、御社の現在の従業員数だけ伺えますでしょうか？",
  r7Absent: "恐れ入ります、何時頃でしたらお戻りになりますでしょうか？",
};

/**
 * フェーズごとの「その場面の主質問」。
 * 想定外の発話で立て直すとき、どの録音に戻ればよいかをここで決める。
 */
export const PHASE_ANCHOR: Partial<Record<PhaseId, VoiceLineId>> = {
  P0: "greeting",
  P1: "overview",
  P2: "hearingAgeCount",
  P3: "hearingAgeCount",
  P4: "hearingFiscalEmail",
  P5: "hearingFiscalEmail",
  P6: "schedule",
  P7: "schedule",
  P8: "contact",
  P9: "closing",
};

/**
 * ガードレール発火時に流す録音。
 * R5 だけは「他制度との勘違い」用の収録なので、公的機関との誤認は別扱いにする
 * （立場の切り分けは実データ由来の必須ルールで、省略すると最後まで噛み合わない）。
 */
export const GUARDRAIL_LINE: Record<Exclude<GuardrailId, "R5">, VoiceLineId> = {
  R1: "r1NoSystem",
  R2: "r2Busy",
  R3: "r3Expert",
  R4: "r4Document",
  R7: "r7Absent",
};

export const audioUrl = (file: string): string => `${AUDIO_BASE}${file}`;

// ---------- 判定辞書 ----------
// 実際の架電で出る言い回しに合わせて広めに取る。
// 迷ったら「取りこぼさない」側に倒し、誤爆が致命的になる語（人数・月）だけ文脈語を必須にする。

/** 肯定。 */
const YES =
  /(はい|ええ|うん|そうです|そうですね|そうしま|もちろん|ぜひ|是非|わかりました|分かりました|承知|了解|大丈夫|平気|問題ありませ|問題ない|構いませ|かまいませ|お願いし|いいです|いいよ|良いです|結構ですよ|それでいい|それで結構|それで大丈夫|それでお願い|オッケー|オーケー|ＯＫ|OK|どうぞ|お聞きし|聞いてみ|やってみ)/i;
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
  /(大丈夫|空いて(ます|います|る)|問題ありませ|問題ない|構いませ|かまいませ|いけます|行けます|参加でき|出られ|可能です|お願いします|入れておき|それで(いい|結構|お願い)|承知|了解|調整し|都合つけ|押さえて|空けておき|みてみます)/;
/**
 * R7 のうち「本人が今いない」ケース。決裁権なしとは切り返しが変わるので分ける。
 * R7 が発火した発話にだけ当てるので、広めに取ってよい。
 */
const ABSENT_NOW =
  /(不在|席を外|外出|出かけ|出払|留守|帰社|帰宅|退社|出張|戻り|戻って|お休み|休み|おりませ|今[はも]?い(ませ|ない))/;

/** 戻り時間・折り返しやすい時間帯の申し出。 */
const RETURN_TIME =
  /(午前|午後|朝|昼|夕方|夜|明日|明後日|来週|週明け|\d{1,2}\s*時|\d{1,2}\s*日|後ほど|のちほど|いつでも|月曜|火曜|水曜|木曜|金曜)/;

/**
 * 断り・導入済みの意思表示。
 * 「もう対策してる」「間に合ってます」は質問への回答ではなく断りなので、
 * ヒアリングの進行より先に判定する（進めると会話が噛み合わなくなる）。
 */
const DECLINE =
  /(対策(は|も)?(して|済|でき|ばっちり)|やってます|やっており|やっている|やってる|やってました|やっていました|導入(済|して(ます|おり|いる|いました))|(?:保険|制度|共済|年金|中退共|DC)[^。]{0,6}入って(ます|おり|いる)|間に合って|足りて(ます|いる|おり)|十分|充分|結構です(?!よ)|けっこうです|要りません|いりません|いらない|要らない|いらん|不要|必要(は)?(ない|ありませ)|興味(は|が)?(ない|ありませ)|関心(は|が)?(ない|ありませ)|お断り|遠慮(し|させ)|うちは(いい|平気)|もう(いい|やって|済ん))/;

/** 「大丈夫」を肯定と読んでよい文脈（日程の可否を答えている場面）。 */
const SCHEDULE_CONTEXT = /(時間|日時|その日|来週|水曜|午前|午後|それで|日程|参加|伺い|お願いします|入れて)/;

/** 相手が電話口に出た合図（受付の名乗り・相槌）。 */
const ANSWERED_CALL =
  /(もしもし|株式会社|有限会社|合同会社|でございます|社長の|代表の|担当の|私が|わたくし)/;

/**
 * 数字を伴わない人数表現。
 * 小規模企業では「私と妻だけ」「私一人」という答え方が多く、数字が出てこない。
 */
const PERSON_PHRASES: [RegExp, number][] = [
  [/(私|自分|わたし)(と|や|＋)(妻|夫|家内|主人|嫁|息子|娘|息子夫婦)/, 2],
  [/夫婦(で|だけ|二人|2人)?/, 2],
  [/(私|自分|わたし)(だけ|一人|ひとり)/, 1],
  [/(一人|ひとり|1人)(だけ|です|ですね|でやって)/, 1],
];

/** メールでは受け取れない、という申し出。 */
const EMAIL_UNAVAILABLE =
  /(メール|アドレス)[^。]{0,12}(苦手|使って(ない|いない|おりませ|ません)|持って(ない|いない|おりませ)|見ない|分からない|わからない|やってない)/;

/** 時間帯の指定。2択に答えたとみなす。 */
const TIME_SLOT =
  /(午前|午後|朝|昼|夕方|夜|前半|後半|早い時間|遅い時間|\d{1,2}\s*時|\d{1,2}\s*日|来週|再来週|明日|明後日|週明け|月曜|火曜|水曜|木曜|金曜)/;

/**
 * R5 のうち「公的機関との誤認」だけを切り分ける。
 * こちらは収録が無く、立場の切り分け（民間の導入支援事業者）を必ず読み上げる必要がある。
 */
const PUBLIC_BODY_CONFUSION =
  /(お国|国が|国の|お役所|役所|市役所|区役所|町役場|公的|行政|官公庁|厚労省|厚生労働省|年金機構|年金事務所|社会保険事務所|商工会|商工会議所|税務署|ハローワーク|労働基準監督署|公務員|職員|担当官|補助金|助成金|給付金)/;

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

/** 数字のない人数表現から人数を読む（「私と妻だけです」→ 2）。 */
export function phraseCount(text: string): number | null {
  for (const [pattern, count] of PERSON_PHRASES) if (pattern.test(text)) return count;
  return null;
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
  /** 社会保険加入人数（人数の指定が1つだけなら全体人数として扱う） */
  insured?: number;
  /** 決算月 */
  fiscalMonth?: number;
  /** 代表年齢 */
  age?: number;
  /** メールアドレス */
  email?: string;
  /** 折り返し先の電話番号 */
  phone?: string;
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
  // 新台本は「決算月とメールアドレス」「電話番号またはメールアドレス」をまとめて聞くため、
  // 連絡先もこの場で拾えるようにしておく
  const email = EMAIL_RE.exec(text.replace(/\s/g, ""))?.[0];
  const phone = PHONE_RE.exec(text.replace(/\s/g, ""))?.[0];
  if (email) facts.email = email;
  if (phone) facts.phone = phone;
  return facts;
}

/** 年齢層の回答（「50代」「40代から50代」）。 */
const AGE_ERA = /(\d{2})\s*代/;
/** 文脈語のない人数（「20人くらいです」）。その場面で人数を聞いているときだけ使う。 */
const BARE_COUNT = /(\d{1,4}|[〇一二三四五六七八九十]{1,4})\s*(?:名|人)/;

/** P8 で今どのスロットを聞いているか。 */
type PendingSlot = HearingId | "email" | "emailConfirm" | "callbackPhone" | "callbackWindow";

/** ガードレールの切り返しで相手に投げた質問。次の発話をその文脈で読む。 */
type Expecting = "headcount" | "contact" | null;

export class DialogEngine {
  private pending: PendingSlot | null = null;
  /** 直前の発話で一括抽出できた項目（画面に「まとめ聞きで取得」と出すため） */
  private harvested: HearingId[] = [];
  /** すでに読み上げた収録台本。同じ録音を続けて流さないために持つ。 */
  private said = new Set<VoiceLineId>();
  /** 切り返しで投げた質問（従業員数だけ／連絡先だけ） */
  private expecting: Expecting = null;
  /** 想定外の発話が続いた回数。立て直しの段階を決める。 */
  private unknownStreak = 0;
  /**
   * R2（多忙）の切り返しを再生済みか。
   * R2 は「30秒だけ要点をお伝えして…」という一度きりの切り返しなので、
   * 同じ通話で二度流すと会話が前に進まずループする。1通話1回に制限する。
   */
  private busyPitchDone = false;
  /** R7（不在）対応に切り替わっているか。戻り時間と折り返し先の確定だけを行う。 */
  private absentMode = false;
  /** 不在対応で何ターン粘ったか。確認が取れないまま長引かせないための上限。 */
  private absentTurns = 0;
  /**
   * 連続して拒絶された回数（多忙・断りをまとめて数える）。
   * 種類が違っても2回続けて断られた時点で食い下がらない。
   */
  private refusalStreak = 0;
  /** 直前に流した収録台本。言い直しはフェーズではなくこれを基準にする。 */
  private lastLine: VoiceLineId | null = null;

  constructor(private state: CallState) {}

  /** 架電開始の第一声。 */
  greeting(): DialogReply {
    return this.say("greeting", "P0", [], "架電開始");
  }

  /** 相手の発話を受けて応答を1つ返す。state は破壊的に更新される。 */
  respond(customerText: string): DialogReply {
    const text = customerText.trim();
    const fired = detectGuardrails(text);
    for (const g of fired) {
      if (!this.state.firedGuardrails.includes(g)) this.state.firedGuardrails.push(g);
    }

    // 拒絶（多忙・断り）が続いているかを先に確定させる。種類をまたいで数える
    if (!fired.includes("R2") && !this.isDecline(text)) this.refusalStreak = 0;

    // まとめ聞き対応: 質問していない項目でも、言われた時点で拾って保持する
    this.harvested = this.harvest(text);
    // 切り返しで投げた質問への回答は、フェーズに関係なくここで回収する
    const collected = this.collectExpected(text);

    const g = this.byGuardrail(text, fired);
    if (g) return g;

    // 切り返しで聞いた従業員数が取れたら、そのまま次の質問（決算月・メール）へ進む。
    // これは断り判定より先に見る。「20名でやってます」のような回答を
    // 「やってます＝断り」と取り違えると、答えているのに会話が止まってしまう。
    if (collected === "headcount") {
      this.unknownStreak = 0;
      this.refusalStreak = 0;
      return this.say(
        "hearingFiscalEmail",
        this.toPhase("P5"),
        fired,
        "切り返しへの回答から H5 を取得 → 決算月と送付先メールアドレスへ",
      );
    }

    // R2 の直後にまた「忙しい」と言われた場合は、食い下がらず丁寧に終話する
    if (fired.includes("R2") && this.busyPitchDone) {
      const cont = this.afterBusy(fired);
      if (cont) return cont;
    }

    // 不在対応中は、制度の話に戻さず戻り時間と折り返し先の確定だけを行う
    if (this.absentMode && !this.state.ended) {
      return this.absentFollowUp(text, fired);
    }

    // 断り・導入済みの申し出は、ヒアリングの進行より先に判定する
    if (this.isDecline(text)) {
      this.refusalStreak++;
      return this.handleDecline(fired);
    }

    switch (this.state.phase) {
      case "P0":
        return this.p0(text, fired);
      case "P1":
        return this.p1(text, fired);
      case "P2":
      case "P3":
        return this.hearingAgeCount(text, fired);
      case "P4":
      case "P5":
        return this.hearingFiscalEmail(text, fired);
      case "P6":
      case "P7":
        return this.p7(text, fired);
      case "P8":
        return this.p8(text, fired);
      case "P9":
        return this.speakOnly(
          "本日はお時間をいただきありがとうございました。失礼いたします。",
          "END",
          fired,
          "締め完了",
        );
      default:
        return this.speakOnly("ありがとうございました。失礼いたします。", "END", fired, "終話");
    }
  }

  /**
   * 発話から人数・決算月・年齢・連絡先を拾って state に入れる。
   * すでに取得済みの項目は上書きしない（取りこぼし防止と同じ方針）。
   * 戻り値は「今回新しく埋まったヒアリング項目」。
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
    if (b.email && !this.state.email) facts.email = b.email;
    if (b.phone && !this.state.callbackPhone) facts.callback_phone = b.phone;
    if (filled.length > 0 || facts.email || facts.callback_phone) applyExtracted(this.state, facts);
    return filled;
  }

  /**
   * 「従業員数だけ」「連絡先だけ」など切り返しで投げた質問への回答を回収する。
   * 文脈語が無い回答（「20人です」）でも、直前に聞いた項目としてなら受け取れる。
   */
  private collectExpected(text: string): Expecting {
    if (!this.expecting) return null;
    if (this.expecting === "headcount") {
      // 「20名です」「10人くらい」のように数だけ返ってくるので、文脈語は要求しない
      const n = this.state.hearing.H5
        ? null
        : (toNumber(BARE_COUNT.exec(text)?.[1] ?? "") ?? phraseCount(text));
      if (n === null || n <= 0) return null;
      applyExtracted(this.state, { H5: `${n}名` });
      if (!this.harvested.includes("H5")) this.harvested.push("H5");
      this.expecting = null;
      return "headcount";
    }
    // contact: メール・電話は harvest 側で拾えているので、入ったかどうかだけ見る
    if (this.state.email || this.state.callbackPhone) {
      this.expecting = null;
      return "contact";
    }
    return null;
  }

  // ---------- ガードレール優先の分岐（設計書 §5） ----------

  private byGuardrail(text: string, fired: GuardrailId[]): DialogReply | null {
    const has = (id: GuardrailId): boolean => fired.includes(id);

    // R5: 誤認は最優先で解く。
    // 公的機関との誤認だけは収録が無いので、立場の切り分けを読み上げで必ず行う。
    if (has("R5")) {
      this.unknownStreak = 0;
      if (PUBLIC_BODY_CONFUSION.test(text)) {
        return this.speakOnly(
          "紛らわしくて申し訳ございません。制度は厚生労働省の管轄ですが、私どもは民間の導入支援事業者でございます。",
          this.state.phase,
          fired,
          "R5: 公的機関との誤認を即座に訂正（録音なし・音声合成）",
        );
      }
      return this.say("r5OtherScheme", this.state.phase, fired, "R5: iDeCo・個人年金との勘違いを訂正");
    }
    // R7: 不在／決裁権なしなら、ヒアリングを止めて次回接触の確定に切り替える
    if (has("R7")) {
      this.unknownStreak = 0;
      const absent = ABSENT_NOW.test(text);
      if (!this.said.has("r7Absent")) {
        this.expecting = "contact";
        this.absentMode = absent;
        return this.say(
          "r7Absent",
          this.state.phase,
          fired,
          absent
            ? "R7: 不在 → 戻りの際の連絡先を確保"
            : "R7: 決裁権なし → 判断できる方の連絡先を確保",
        );
      }
      // 同じ切り返しは繰り返さない。不在なら戻り時間と折り返しの確定へ進める
      if (absent || this.absentMode) {
        this.absentMode = true;
        return this.absentFollowUp(text, fired);
      }
    }
    // R1: 「制度がない」は断りではなく最も見込みが高いホットサイン
    if (has("R1")) {
      this.unknownStreak = 0;
      this.expecting = "headcount";
      return this.say(
        "r1NoSystem",
        this.toPhase("P3"),
        fired,
        "R1: 断り判定を禁止し、未導入企業向けの訴求＋人数確認へ",
      );
    }
    // R3: 専門家を否定せず、セカンドオピニオンの位置に回る
    if (has("R3")) {
      this.unknownStreak = 0;
      return this.say("r3Expert", this.state.phase, fired, "R3: 専門家を否定せずセカンドオピニオンとして提案");
    }
    // R4: 資料送付で終わらせず、送付先メールアドレスの確定をセットで取る
    if (has("R4")) {
      this.unknownStreak = 0;
      this.expecting = "contact";
      return this.say("r4Document", this.state.phase, fired, "R4: 送付を受けたうえで送付先メールアドレスを確定");
    }
    // R2: 忙しい相手には要点だけを短く伝え、人数確認まで一気に運ぶ。
    // ただし再生は1通話1回だけ（2回目以降は afterBusy で質問側へ進める）
    if (has("R2") && !this.busyPitchDone) {
      this.unknownStreak = 0;
      this.refusalStreak++;
      // すでに一度断られていれば、多忙で食い下がらずに終話する
      if (this.refusalStreak >= 2) {
        return this.say("reject", this.toPhase("P0X"), fired, "2回連続の拒絶 → 食い下がらず丁寧に終話");
      }
      this.expecting = "headcount";
      this.busyPitchDone = true;
      // 新台本の R2 は仮押さえではなく「30秒で要点＋人数確認」なので、
      // 受付段階のままにせず、可能ならヒアリング(P3)へ進める
      return this.say("r2Busy", this.toPhase("P3"), fired, "R2: 30秒で要点を伝えて人数確認へ");
    }
    return null;
  }

  // ---------- フェーズ別の意図判定 ----------

  private p0(text: string, fired: GuardrailId[]): DialogReply {
    if (REFUSE_SALES.test(text)) {
      this.unknownStreak = 0;
      return this.say("reject", "P0X", fired, "受付ブロック → 丁寧に撤退");
    }
    // 取次ぎでも用件確認でも、次に話すのは法改正の概要（収録台本どおり）
    if (TRANSFER.test(text) || ASK_PURPOSE.test(text)) {
      this.unknownStreak = 0;
      return this.say(
        "overview",
        "P1",
        fired,
        TRANSFER.test(text) ? "取次ぎ発生 → 法改正の概要" : "用件を問われた → 法改正の概要",
      );
    }
    // 「はい、○○です」「もしもし」など、相手が電話口に出た合図には概要を伝える
    if (YES.test(text) || ANSWERED_CALL.test(text)) {
      this.unknownStreak = 0;
      return this.say("overview", "P1", fired, "相手が応答 → 法改正の概要");
    }
    return this.repair(fired, "受付の反応を判定できず");
  }

  private p1(text: string, fired: GuardrailId[]): DialogReply {
    if (!this.said.has("overview")) {
      return this.say("overview", "P1", fired, "担当者接続 → 法改正の概要");
    }
    this.unknownStreak = 0;
    return this.say("hearingAgeCount", "P3", fired, "概要への反応 → 年齢層と人数のヒアリング");
  }

  /** P2/P3: 年齢層・人数を聞いている場面。 */
  private hearingAgeCount(text: string, fired: GuardrailId[]): DialogReply {
    const got = [...this.harvested];

    // 「20人くらい」「50代です」のように文脈語が無い回答も、この場面なら受け取れる
    if (!this.state.hearing.H5) {
      const n = toNumber(BARE_COUNT.exec(text)?.[1] ?? "") ?? phraseCount(text);
      if (n !== null && n > 0) {
        applyExtracted(this.state, { H5: `${n}名` });
        got.push("H5");
      }
    }
    if (!this.state.hearing.H3) {
      const era = AGE_ERA.exec(text)?.[1];
      if (era) {
        applyExtracted(this.state, { H3: `${era}代` });
        got.push("H3");
      }
    }

    if (got.length === 0 && !YES.test(text)) {
      return this.repair(fired, "年齢層・人数の回答として読み取れず");
    }
    this.unknownStreak = 0;
    this.expecting = null;
    const note = got.length > 0 ? `${[...new Set(got)].join("・")} を取得` : "反応を確認";
    return this.say("hearingFiscalEmail", "P5", fired, `${note} → 決算月と送付先メールアドレスへ`);
  }

  /** P4/P5: 決算月・メールアドレスを聞いている場面。 */
  private hearingFiscalEmail(text: string, fired: GuardrailId[]): DialogReply {
    const got: string[] = [...this.harvested];

    // この場面での「3月です」は決算月とみなしてよい
    if (!this.state.hearing.H7) {
      const m = toNumber(MONTH_RE.exec(text)?.[1] ?? "");
      if (m !== null && m >= 1 && m <= 12) {
        applyExtracted(this.state, { H7: `${m}月` });
        got.push("H7");
      }
    }
    if (this.state.email && !got.includes("email") && EMAIL_RE.test(text.replace(/\s/g, ""))) {
      got.push("email");
    }

    if (got.length === 0 && EMAIL_UNAVAILABLE.test(text)) {
      this.unknownStreak = 0;
      return this.speakOnly(
        this.state.hearing.H7
          ? "承知いたしました。それでは資料は郵送でお送りいたします。"
          : "承知いたしました。それでは、御社の決算月だけ伺えますでしょうか？資料は郵送でもお送りできます。",
        this.state.phase,
        fired,
        "メールが使えない → 郵送に切り替えて決算月のみ確認",
      );
    }
    if (got.length === 0 && !YES.test(text)) {
      return this.repair(fired, "決算月・メールアドレスの回答として読み取れず");
    }
    this.unknownStreak = 0;
    this.expecting = null;
    return this.say(
      "schedule",
      "P7",
      fired,
      `${[...new Set(got)].join("・") || "反応を確認"} を取得 → オンライン商談の日程打診`,
    );
  }

  /** P6/P7: 日程を詰めている場面。 */
  private p7(text: string, fired: GuardrailId[]): DialogReply {
    // オンライン商談そのものへの不安は、日程の可否より先に解消する
    if (
      /(ズーム|zoom|オンライン|ウェブ|web|リモート|url|URL)/i.test(text) &&
      /(何|なに|わからない|分からない|使えない|できない|詳しくない|苦手|不安|やったこと)/.test(text)
    ) {
      this.unknownStreak = 0;
      return this.speakOnly(
        "スマートフォンでも参加できます。メールでお送りするURLをタップいただくだけですので、難しい操作はございません。",
        "P7",
        fired,
        "条件分岐: オンライン商談の説明",
      );
    }
    // 「そちらは遠い」という誤解も、移動不要であることだけ伝える
    if (/(遠い|距離|来られ|お越し|伺うの)/.test(text)) {
      this.unknownStreak = 0;
      return this.speakOnly(
        "オンラインですので、ご移動やご来社は不要でございます。",
        "P7",
        fired,
        "条件分岐: オンラインなので移動は不要",
      );
    }
    // 日程NG は開いた質問に戻さず、収録済みの代替日程で出し直す。
    // 代替日程も断られた場合は同じ提案を繰り返さず、立て直し（最終的に丁寧な終話）へ回す。
    if (SCHEDULE_NG.test(text) && !SCHEDULE_OK.test(text)) {
      if (!this.said.has("reschedule")) {
        this.unknownStreak = 0;
        return this.say("reschedule", "P7", fired, "日程NG → 代替日程を提示");
      }
      return this.repair(fired, "代替日程も合わず");
    }
    if ((YES.test(text) || SCHEDULE_OK.test(text) || TIME_SLOT.test(text)) && !NO.test(text)) {
      const sc = DEMO_SCENARIO;
      applyExtracted(this.state, {
        appointment_date: sc.proposedDate,
        appointment_time: sc.proposedTime,
        zoom_agreed: true,
        duration_agreed: true,
      });
      this.unknownStreak = 0;
      // 収録台本の次の一言が「直通の電話番号またはメールアドレス」なので、それを待つ
      this.pending = this.state.callbackPhone ? null : "callbackPhone";
      return this.say("contact", "P8", fired, "日程確定 → 連絡先の確認(P8)");
    }
    return this.repair(fired, "日程の可否を判定できず");
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
          return this.speakOnly(
            this.askText(this.pending),
            "P8",
            fired,
            `${this.pending} が聞き取れず再質問`,
          );
        }
      }
    }
    this.unknownStreak = 0;

    const nextSlot = this.nextSlot();
    if (!nextSlot) {
      this.pending = null;
      // 収録台本の締めにはカレンダー登録依頼が含まれていない。
      // 実データで53%しか実施されていない項目で、このデモの主張そのものなので、
      // 録音が無くても必ず1回入れる（DoD の「カレンダー登録を依頼した」を満たす）。
      if (!this.state.calendarRequested) {
        const sc = DEMO_SCENARIO;
        return this.speakOnly(
          `担当の予定の兼ね合いで、もし日程変更になりますと次回のご案内がかなり先になる可能性がございます。お手数ですが${sc.proposedDate}${sc.proposedTime}で、一旦カレンダーにご予定だけ入れておいていただけますと助かります。`,
          "P8",
          fired,
          `${notes.join(" / ") || "取得完了"} → カレンダー登録依頼（録音なし・音声合成）`,
        );
      }
      return this.say(
        "closing",
        "P9",
        fired,
        `${notes.join(" / ") || "取得完了"} → 7項目＋連絡先が揃ったので締め(P9)`,
      );
    }
    this.pending = nextSlot;
    // 収録台本に無い項目は音声合成で補う（画面にもそう出す）
    return this.speakOnly(
      this.askText(nextSlot),
      "P8",
      fired,
      `${notes.length > 0 ? notes.join(" / ") + " → " : ""}次は ${nextSlot}（録音なし・音声合成）`,
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
        return "資料とオンライン会議のURLをお送りしたいのですが、メールアドレスを伺えますでしょうか？";
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
        const era = AGE_ERA.exec(text)?.[1];
        if (age) return { facts: { H3: `${age}歳` }, ok: true };
        if (era) return { facts: { H3: `${era}代` }, ok: true };
        return { facts: { H3: text }, ok: false };
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

  // ---------- R7（不在）の継続 ----------

  /**
   * 不在と分かったあとの進行。
   *
   * 相手は取次ぎ担当で、制度の話をしても意味がない。
   * 「戻り時間」と「折り返し先」の2つが揃った時点で折り返しを約束して終話する。
   * どちらも取れないまま長引く場合は粘らずに終話する。
   */
  private absentFollowUp(text: string, fired: GuardrailId[]): DialogReply {
    // 途中で本人に代わってもらえた場合は不在対応をやめて通常の会話に戻す
    if (TRANSFER.test(text)) {
      this.absentMode = false;
      this.absentTurns = 0;
      return this.say("overview", this.toPhase("P1"), fired, "不在から取次ぎ → 法改正の概要");
    }

    this.absentTurns++;
    // 「夕方には戻ります」のような申し出から、折り返しやすい時間帯を拾う
    if (!this.state.callbackWindow) {
      const window = RETURN_TIME.exec(text)?.[0];
      if (window) applyExtracted(this.state, { callback_window: window });
    }
    const hasContact = Boolean(this.state.callbackPhone || this.state.email);
    const window = this.state.callbackWindow;

    if (window && hasContact) {
      return this.speakOnly(
        `ありがとうございます。それでは${window}頃に改めてお電話いたします。お忙しいところ失礼いたしました。`,
        this.toPhase("P0X"),
        fired,
        "不在: 戻り時間と折り返し先を確保 → 折り返しを約束して終話",
      );
    }
    if (this.absentTurns >= 3) {
      return this.say("reject", this.toPhase("P0X"), fired, "不在: 確認が取れないため粘らず終話");
    }
    if (!window) {
      return this.speakOnly(
        "恐れ入ります、何時頃でしたらお戻りになりますでしょうか。改めてこちらからお電話いたします。",
        this.state.phase,
        fired,
        "不在: 戻り時間の確認",
      );
    }
    this.expecting = "contact";
    return this.speakOnly(
      `承知いたしました。${window}頃に改めてお電話いたします。念のため、ご担当者様のお電話番号かメールアドレスを伺えますでしょうか？`,
      this.state.phase,
      fired,
      "不在: 折り返し先の確認",
    );
  }

  // ---------- 断り・導入済みへの対応 ----------

  /**
   * 「もう対策してる」「間に合ってます」等の断りかどうか。
   *
   * 「大丈夫」は文脈で意味が反転する（日程の可否なら肯定、それ以外は「間に合っている」）。
   * ヒアリング中（P8 以降）は質問への回答なので断り判定しない。
   */
  private isDecline(text: string): boolean {
    const phase = this.state.phase;
    if (phase === "P8" || phase === "P9" || phase === "END" || phase === "P0X") return false;
    if (TRANSFER.test(text)) return false;
    // 受付での「営業電話はお断り」だけは P0X（痕跡を残して撤退）で扱う。
    // 「間に合ってます」等の一般的な断りはここで拾わない
    if (phase === "P0" && /(営業|セールス|勧誘|売り込み)/.test(text) && REFUSE_SALES.test(text)) {
      return false;
    }
    if (DECLINE.test(text)) return true;
    if (/大丈夫/.test(text)) {
      const scheduling = phase === "P6" || phase === "P7";
      return !scheduling && !SCHEDULE_CONTEXT.test(text);
    }
    return false;
  }

  /**
   * 断られたときの切り返し。
   * 1回目は「今やっているものとは別枠の制度」であることだけを伝え、
   * 2回続けて断られたら食い下がらずに終話する。
   */
  private handleDecline(fired: GuardrailId[]): DialogReply {
    if (this.refusalStreak >= 2) {
      return this.say("reject", this.toPhase("P0X"), fired, "2回連続の拒絶 → 食い下がらず丁寧に終話");
    }
    if (!this.said.has("r5OtherScheme")) {
      this.unknownStreak = 0;
      return this.say(
        "r5OtherScheme",
        this.state.phase,
        fired,
        "断り（対策済み・間に合っている）→ 今やっているものとは別枠であることを伝える",
      );
    }
    return this.say("reject", this.toPhase("P0X"), fired, "断りが続いたため丁寧に終話");
  }

  // ---------- R2（多忙）の継続 ----------

  /**
   * R2 の切り返しを流したあとに、また「忙しい」と言われたときの処理。
   *
   * ここで別の話題（人数確認など）に引き延ばすと、断っている相手に話を被せる形になり
   * 文脈が破綻する。2回続けて断られた時点で食い下がるのをやめ、
   * 日を改める前提で丁寧に終話する（実データでも、粘った架電はすべて切られている）。
   *
   * 直後ではない再発火（会話が進んだあとの「忙しい」）は終話にせず、
   * 同じ切り返しの再生だけを避けて通常のフェーズ処理に渡す。
   */
  private afterBusy(fired: GuardrailId[]): DialogReply | null {
    if (!this.justSaid(VOICE_LINES.r2Busy.text)) return null;
    return this.say(
      "reject",
      this.toPhase("P0X"),
      fired,
      "2回連続の多忙 → 食い下がらず日を改める前提で丁寧に終話",
    );
  }

  /**
   * 謝罪から入る台本かどうか。
   * 「あ、失礼いたしました！」が続けて流れると、何に謝っているのか分からず不自然になるため、
   * 台本を選ぶ段階で連続を避ける（読み上げ側で文頭を削ると音声とテキストがずれるのでやらない）。
   */
  private static opensWithApology(text: string): boolean {
    return /^(あ、|ああ、)?(大変|誠に)?(失礼(いた)?しました|申し訳|すみません)/.test(text);
  }

  /** 直前の AI 発話が謝罪から入っていたか。 */
  private justApologized(): boolean {
    const last = [...this.state.turns].reverse().find((t) => t.speaker === "agent");
    return last ? DialogEngine.opensWithApology(last.text) : false;
  }

  /** 直前の AI 発話が同じ内容だったか（同じセリフを続けて流さないための判定）。 */
  private justSaid(text: string): boolean {
    for (let i = this.state.turns.length - 1; i >= 0; i--) {
      const turn = this.state.turns[i];
      if (turn?.speaker !== "agent") continue;
      return turn.text === text;
    }
    return false;
  }

  /** 遷移が許可されていないフェーズは提案しない（不要な却下フラグを出さないため）。 */
  private toPhase(desired: PhaseId): PhaseId {
    const current = this.state.phase;
    if (desired === current) return current;
    return PHASES[current].allowedNext.includes(desired) ? desired : current;
  }

  // ---------- 想定外の発話への立て直し ----------

  /**
   * どの分岐にも当たらなかったときの処理。
   *
   * ここで無条件に読み上げへ落とすと、収録音声と合成音声が交互に出て会話が壊れる。
   * そのため「言い直す → 最小の質問に切り替える → 日程に振る → 丁寧に終話」の順で、
   * 収録済みの台本を使いながら会話を前に進める。
   */
  private repair(fired: GuardrailId[], reason: string): DialogReply {
    this.unknownStreak++;
    // 言い直しの基準は「実際に最後に流した質問」。
    // フェーズの主質問を使うと、切り返し(R2 等)でフェーズが進んでいない場面で
    // 冒頭の挨拶まで巻き戻ってしまう。
    const anchor =
      this.lastLine && !CLOSING_LINES.has(this.lastLine)
        ? this.lastLine
        : PHASE_ANCHOR[this.state.phase];

    // 1回目: 直前に流した質問をもう一度（電話では自然な立て直し）
    if (this.unknownStreak === 1 && anchor) {
      if (!this.justSaid(VOICE_LINES[anchor].text)) {
        return this.say(anchor, this.state.phase, fired, `${reason} → 直前の質問を言い直す`, {
          replay: true,
        });
      }
      // たった今流したばかりの台本は繰り返さず、同じ内容を一言で聞き直す
      const recap = RECAP[anchor];
      if (recap) {
        return this.speakOnly(recap, this.state.phase, fired, `${reason} → 直前の質問を短く聞き直す`);
      }
    }
    // 以降は、まだ使っていない録音を順に使って会話を前に進める。
    // ただし直前が謝罪から入る台本だったときは、謝罪が二重になるので人数確認は飛ばす。
    if (!this.said.has("r1NoSystem") && !this.justApologized()) {
      this.expecting = "headcount";
      return this.say("r1NoSystem", this.state.phase, fired, `${reason} → 最小の質問（人数）に切り替え`);
    }
    if (!this.said.has("schedule")) {
      return this.say("schedule", this.toPhase("P7"), fired, `${reason} → 内容を離れて日程打診に切り替え`);
    }
    // それでも噛み合わなければ、痕跡を残して丁寧に終話する
    return this.say("reject", "P0X", fired, `${reason} → 立て直せず丁寧に終話`);
  }

  // ---------- 応答の確定（フィルタ・遷移検証・履歴） ----------

  /** 収録台本を1本読み上げる。画面表示テキストと音声は同じ定義から取る。 */
  private say(
    id: VoiceLineId,
    proposed: PhaseId,
    fired: GuardrailId[],
    matched: string,
    opts: { replay?: boolean } = {},
  ): DialogReply {
    const line = VOICE_LINES[id];
    const alreadySaid = this.said.has(id);
    this.said.add(id);
    this.lastLine = id;
    // 同じ録音は続けて流さない。ただし言い直しは同じ文言なので再生してよい。
    const audioFile = !alreadySaid || opts.replay ? audioUrl(line.file) : undefined;
    return this.emit(line.text, proposed, fired, matched, audioFile);
  }

  /** 収録の無い発話（P8 の個別質問など）。音声合成で読み上げる。 */
  private speakOnly(
    raw: string,
    proposed: PhaseId,
    fired: GuardrailId[],
    matched: string,
  ): DialogReply {
    return this.emit(raw, proposed, fired, matched, undefined);
  }

  private emit(
    raw: string,
    proposed: PhaseId,
    fired: GuardrailId[],
    matched: string,
    audioFile: string | undefined,
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
    // P0X（撤退）は「失礼いたします」まで言い切る撤退フレーズなので、END と同じく終話扱いにする
    if (t.phase === "END" || t.phase === "P0X") this.state.ended = true;

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
