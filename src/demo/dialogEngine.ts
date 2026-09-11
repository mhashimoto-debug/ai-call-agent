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
 * 応答は区間（録音 or 音声合成）の並びで返す。台本と録音の対応は voiceLines.ts にまとめてある。
 */
import { PHASES } from "../domain/phases.js";
import { GUARDRAILS, detectGuardrails } from "../domain/guardrails.js";
import {
  applyExtracted,
  missingHearing,
  resolveTransition,
  type CallState,
  type ExtractedFacts,
} from "../domain/state.js";
import { checkForbidden, type Violation } from "../domain/forbidden.js";
import type { GuardrailId, HearingId, PhaseId } from "../domain/types.js";
import { DEMO_SCENARIO } from "./scenario.js";
import {
  PHRASES,
  VOICE_LINES,
  clip,
  filterSegment,
  tts,
  type PhraseId,
  type SpeechSegment,
  type VoiceLineId,
} from "./voiceLines.js";

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
   * 再生する区間の並び。区間ごとに録音があれば MP3、無ければ音声合成で鳴らす。
   * 区間のテキストをつなげると utterance と一致する。
   */
  segments: SpeechSegment[];
  /**
   * 相手が保留にした（「少々お待ちください」）。AI は喋らずに相手の次の発話を待つ。
   * このとき utterance は空で、segments も空。履歴にも AI の発話を積まない。
   */
  holding?: boolean;
}

/** 言い直しの対象にしない台本（言い切って終わるもの）。 */
const CLOSING_LINES = new Set<VoiceLineId>(["reject", "closing"]);

/**
 * 短い聞き返し。
 * 直前に流したばかりの台本をもう一度そのまま流すと、長い説明が2回続いて不自然になる。
 * その場合はここから、同じことを一言で聞き直す（文言は PHRASES.recap*）。
 */
const RECAP: Partial<Record<VoiceLineId, PhraseId>> = {
  greeting: "recapGreeting",
  overview: "recapOverview",
  hearingAgeCount: "recapHearingAgeCount",
  hearingFiscalEmail: "recapHearingFiscalEmail",
  schedule: "recapSchedule",
  reschedule: "recapReschedule",
  contact: "recapContact",
  r1NoSystem: "recapHeadcount",
  r2Busy: "recapHeadcount",
  r3Expert: "recapExpert",
  r4Document: "recapDocument",
  r5OtherScheme: "recapHeadcount",
  r7Absent: "recapAbsent",
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
export const ASK_PURPOSE =
  /(ご用件|用件|ご用|どういった|どういう|どのような|どんな|なんの|何の|なんでしょ|どちら様|どちらさま|どなた|失礼ですが|どこの|お名前|会社名|目的|なにか|何か)(です|でしょ|ですか|ますか|かしら)?/;
/** 取次ぎが発生した。 */
const TRANSFER =
  /(お待ち|少々|少し待|代わり|かわり|変わり|繋ぎ|つなぎ|お繋ぎ|呼んで|呼びま|確認しま|担当に|本人に|代表に|社長に|今呼び|まいります)/;

/**
 * 保留の合図（「少々お待ちください」「代表に代わります」）。
 * 電話口の相手が替わる途中なので、AI は喋らずに待つ。ここで概要や質問を流すと、
 * 保留中の受付に向かって話し続けることになる。
 * 「代わりました」（担当者が出た合図）とは語尾で切り分ける。
 */
const HOLD =
  /((少々|少し|しばらく|ちょっと)[^。]{0,4}(お待ち|待って(ください|もらえ|いただけ|て))|お待ち(ください|いただけ|頂け|願え)|(代わ|かわ|替わ)ります|(繋ぎ|つなぎ)(します|いたします|致します)|(繋|つな)ぎます|呼んで(きます|まいり|参り)|お呼び(します|いたします|してまいり|して参り)|確認して(まいり|参り|きます))/;

/** 別の人に電話を回す言い方。本人が手元の確認で待たせているだけの保留と切り分ける。 */
const HANDOFF_VERB =
  /((代わ|かわ|替わ)ります|(繋ぎ|つなぎ)(します|いたします|致します)|(繋|つな)ぎます|呼んで(きます|まいり|参り)|お呼び(します|いたします|してまいり|して参り))/;

/** 代わって出た担当者の第一声（「お電話代わりました」「はい、代わりました」）。 */
const TOOK_OVER = /(代わ|かわ|替わ)りました/;

/** 保留が明けた合図（「お待たせしました」）。取次ぎの後なら、代わって出た担当者の第一声。 */
const HOLD_OVER = /お待たせ/;

/**
 * 相槌・促しの語（「はい」「どうぞ」「どうぞ教えてください」「なるほど」「詳しく話してください」）。
 * 長いものを先に並べる（「ええと」を「ええ」＋「と」に割らないため）。
 */
const PROMPT_WORD =
  /(お待たせ(いたしました|致しました|しました)|お願い(いたします|致します|します)|詳しく|くわしく|もう少し|もうちょっと|説明して(ください)?|お話し(ください)?|話して(ください)?|教えて(いただけますか|もらえますか|ください)|聞かせて(ください)?|続けて(ください)?|お聞きします|聞いて(います|ます)|伺います|聞きます|どうぞ|なるほど|そうなんですね|そうなんですか|そうですね|そうですか|そうです|大丈夫です|いいですよ|ええと|えーと|えっと|うーん|ふーん|へえ|へー|ほう|はあ|はぁ|はい|ええ|えー|うん|ああ|あー|それで|教えて|ね|よ|で)/g;
const PROMPT_PUNCT = /[\s、。，．,.!！?？…〜~]/g;

/** 続きを促す言い方。「大丈夫です、どうぞ」を断りと取り違えないために使う。 */
const GO_AHEAD = /(どうぞ|続けて|教えて|聞かせて|お聞きし)/;

/**
 * 相槌・促しだけの発話か。
 * 聞く姿勢を示しただけで何かに答えたわけではないので、「ご回答ありがとうございます」で受けると噛み合わない。
 */
export function isPromptOnly(text: string): boolean {
  const stripped = text.replace(PROMPT_PUNCT, "");
  return stripped.length > 0 && stripped.replace(PROMPT_WORD, "") === "";
}
/** 受付での営業電話ブロック。 */
export const REFUSE_SALES =
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
export const ABSENT_NOW =
  /(不在|席を外|外出|出かけ|出払|留守|帰社|帰宅|退社|出張|戻り|戻って|お休み|休み|おりませ|今[はも]?い(ませ|ない))/;

/** 戻り時間・折り返しやすい時間帯の申し出。 */
export const RETURN_TIME =
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

/**
 * 「ホームページに載っています」型の回避。
 *
 * 資料請求（R4）と混同してはいけない。R4 は送付先を確定させる切り返しなので、
 * HP を見てくれと言われているのにメールアドレスを催促することになり、会話が壊れる。
 * こちらは「送る必要がない＝接点を作る理由が消えた」状態なので、日程打診に切り替える。
 */
const HP_REFERENCE =
  /(ホームページ|ＨＰ|HP|ウェブ|Web|ウェブサイト|サイト|ネット|インターネット|オンライン上|URL|ＵＲＬ|弊社サイト)[^。]{0,16}(見|ご覧|載って|掲載|出て|ござい|あります|ありま|確認|調べ|検索|参照)/i;

/** HP 参照の言い換え（「そこに載ってます」「サイト通り」のように媒体名や動詞を省く場合）。 */
const POSTED_ELSEWHERE =
  /(載って(ます|います|る|おり)|掲載して(ます|います|おり)|出ております)|(ホームページ|ＨＰ|HP|サイト|ウェブ|ネット)[^。]{0,6}(通り|とおり|の通り)/i;

/**
 * P8 で送付先・連絡先を「ホームページに載っているもの」で指定された言い方
 * （「ホームページのでいいです」「HPに載ってるアドレスで」「サイトを見て」）。
 * アドレスの文字列が出てこないので、メールアドレスの抽出では拾えない。
 */
const HP_ADDRESS =
  /(ホームページ|ＨＰ|HP|ウェブサイト|ウェブ|Web|サイト|ネット)[^。]{0,12}?(アドレス|メール|番号|見て|ご覧|載って|掲載|出て|ので|のを|のに|のやつ|でいい|で結構|で大丈夫|でお願い|確認)/i;

/** P8 で連絡先を HP 掲載のもので指定されたか。 */
export function isHpAddress(text: string): boolean {
  return HP_ADDRESS.test(text) || HP_REFERENCE.test(text) || POSTED_ELSEWHERE.test(text);
}

/** 送付先をホームページ掲載のアドレスで指定された場合に、メールアドレス欄へ入れる表記。 */
export const HP_ADDRESS_LABEL = "ホームページ掲載のアドレス（弊社でサイトより確認）";

/** 前日連絡の番号をホームページ掲載の番号で指定された場合に、連絡先欄へ入れる表記。 */
export const HP_NUMBER_LABEL = "ホームページ掲載の番号（弊社でサイトより確認）";

/**
 * 受付ガード: 「担当者のお名前は？」「誰に繋げばいい？」型の応答。
 *
 * これを用件確認（ご用件は？）と取り違えると概要説明を流してしまい、
 * ヒアリングに進むと相手の質問を無視した形になる。挨拶の繰り返しも噛み合わない。
 * こちらが名指しできない以上、部署・役職で取次ぎ先を示すしかない。
 *
 * 判定は助詞に依存させない。音声認識では助詞が落ちたり空白が入ったりするため
 * （「担当者名 お分かりでしょうか」「名前わかりますか」）、
 * 「誰のことを話しているか」を示す語と「分からない・教えてほしい」を示す語の
 * 組み合わせで見る。
 */
/** 疑問・不明を示す語。取次ぎの申し出と、取次ぎ先の質問を切り分けるために使う。 */
const CONTACT_INTERROGATIVE = /(誰|どなた|どこ|どちら|何|なん|分か|わか|存じ|知ら|不明|教え)/;

/** 取次ぎ先そのものを指す語（疑問詞を除く）。 */
const CONTACT_TARGET = /(担当者名|担当者|担当|窓口|部署|お名前|名前|氏名)/;

/** 取次ぎ先を話題にしている語。 */
const CONTACT_SUBJECT = /(担当者名|担当者|担当|窓口|部署|お名前|名前|氏名|誰|どなた)/;

/** 「分からない・教えてほしい」に相当する語。 */
const CONTACT_QUERY =
  /(分か|わか|判ら|知ら|存じ|確認|聞(き|け|い|く)|教え|どちら|なんて|何て|不明|いらっしゃ|でしょうか|ですか)/;

/** 単独で取次ぎ先の確認とみなせる言い回し。 */
const CONTACT_STANDALONE =
  /(担当部署|担当窓口|担当者名|(どこ|どちら|何)\s*(の)?\s*(部署|課|担当|窓口)|(誰|どなた)\s*(に|へ|宛て?)?\s*(お)?(伝え|繋|つな|回|渡)|誰宛|どなた宛)/;

/**
 * 「担当者名を教えてほしい／誰に繋げばいいか分からない」型かどうか。
 * 助詞やスペースの有無に依存しない。
 */
export function isContactGuard(text: string): boolean {
  // 「担当に確認してまいります」のような取次ぎの申し出は対象外（取次ぎ成功のサイン）。
  // ただし「どなたにお繋ぎすれば？」は取次ぎ先を尋ねているので、疑問形なら対象に含める
  if (TRANSFER.test(text) && !CONTACT_INTERROGATIVE.test(text)) return false;
  if (CONTACT_STANDALONE.test(text)) return true;
  // 「担当 誰」のように疑問詞だけで聞かれる場合も取次ぎ先の確認
  if (CONTACT_TARGET.test(text) && /(誰|どなた)/.test(text)) return true;
  return CONTACT_SUBJECT.test(text) && CONTACT_QUERY.test(text);
}

/** そのうち「担当者の名前」を尋ねられているもの。 */
export function isContactNameAsked(text: string): boolean {
  if (!isContactGuard(text)) return false;
  return /(担当者名|お名前|名前|氏名|誰宛|どなた宛)/.test(text);
}

/**
 * 本人・担当者が電話口に出た合図。
 *
 * タイプB では取次ぎ成功として人間へ引き継ぐサインになり、
 * タイプA では「受付を突破して本人に繋がった」合図として概要説明へ進む。
 * 判定を1箇所にまとめて、両モードでずれないようにしている。
 *
 * 音声認識は「私 です」「私、です」のように区切りを入れたり、
 * 「ぼくです」「ワタシです」のようにかなで返したりするため、どちらでも拾えるようにしている。
 * 「私では分かりません」（決裁権なし）は「で」の後ろが続かないので当たらない。
 */
const SELF_WORD = "(?:私|わたくし|わたし|ワタシ|僕|ぼく|ボク|俺|おれ|オレ|自分|じぶん|当方)";
const SELF_SEP = "[\\s、，,]*";
export const SELF_IDENTIFIED = new RegExp(
  [
    `${SELF_WORD}${SELF_SEP}(?:です|でございます)`,
    `${SELF_WORD}${SELF_SEP}が${SELF_SEP}(?:担当|窓口|責任者|やって|見て|そうです)`,
    `(?:担当|窓口)${SELF_SEP}です`,
    `${SELF_WORD}${SELF_SEP}で${SELF_SEP}(?:お伺い|伺い|承り|お受け|大丈夫|結構)`,
  ].join("|"),
);

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

/**
 * 「この番号でいいです」「今かけてもらってる番号です」型の、発信先の番号を連絡先に指定する回答。
 * 番号そのものが出てこないので、電話番号の抽出では拾えない。
 */
const CURRENT_NUMBER =
  /(この|こちらの|こっちの|今の|いまの)\s*(番号|電話|携帯|ケータイ)|(今|いま)\s*(お)?(かけ|掛け)て(もらって|いただいて|頂いて|られて|くれて)?(る|い)|(今|いま)\s*(かかって|掛かって)(る|い|き)|(発信|着信)\s*(元|の)?\s*(番号|電話)|表示\s*(されて(る|いる)|の)\s*(番号|電話)/;

/** 「この番号じゃなくて」「この電話はつながりにくい」のように、発信先の番号を断っている言い方。 */
const CURRENT_NUMBER_REFUSED =
  /(じゃなく|ではなく|でなく|じゃない|ではない|以外|は(だめ|ダメ|駄目|困|使え|繋が|つなが))/;

/** 発信先の番号を連絡先に指定されたか。 */
export function isCurrentNumber(text: string): boolean {
  return CURRENT_NUMBER.test(text) && !CURRENT_NUMBER_REFUSED.test(text);
}

/** 発信先の番号を使う場合に、連絡先欄へ入れる表記。 */
export const CURRENT_NUMBER_LABEL = "発信番号（今お電話している番号）";

/** 時間帯の指定。2択に答えたとみなす。 */
const TIME_SLOT =
  /(午前|午後|朝|昼|夕方|夜|前半|後半|早い時間|遅い時間|\d{1,2}\s*時|\d{1,2}\s*日|来週|再来週|明日|明後日|週明け|月曜|火曜|水曜|木曜|金曜)/;

/**
 * R5 のうち「公的機関との誤認」だけを切り分ける。
 * こちらは他制度用の録音では答えにならず、立場の切り分け（民間の導入支援事業者）を必ず伝える必要がある。
 */
const PUBLIC_BODY_CONFUSION =
  /(お国|国が|国の|お役所|役所|市役所|区役所|町役場|公的|行政|官公庁|厚労省|厚生労働省|年金機構|年金事務所|社会保険事務所|商工会|商工会議所|税務署|ハローワーク|労働基準監督署|公務員|職員|担当官|補助金|助成金|給付金)/;

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/;

/**
 * 口頭のメールアドレス表現を記号・英字に寄せる（「アットマーク」→「@」、「ジーメール ドット コム」→「gmail.com」）。
 * 音声認識は記号やドメインをカタカナで返すことが多いため。長い言い方を先に並べる。
 */
const SPOKEN_EMAIL: [RegExp, string][] = [
  [/アットマーク|あっとまーく|アット|あっと/g, "@"],
  [/ドット|どっと/g, "."],
  [/ハイフン|はいふん/g, "-"],
  [/アンダーバー|アンダースコア/g, "_"],
  [/ジーメール|じーめーる|Gメール/gi, "gmail"],
  [/ヤフー|やふー/g, "yahoo"],
  [/アウトルック/g, "outlook"],
  [/ホットメール/g, "hotmail"],
  [/アイクラウド/g, "icloud"],
  [/シーオー/g, "co"],
  [/ジェーピー|ジェイピー/g, "jp"],
  [/コム/g, "com"],
  [/ネット/g, "net"],
];

/** @ 以降のドメイン部分。 */
const EMAIL_DOMAIN = /@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/;

/** ユーザー名の説明の前に付く前置き（「メールは」「アドレスが」）。 */
const LOCAL_HEAD =
  /^(?:(?:はい|ええ|えーと|えっと|あの)[、,]?)*(?:(?:メールアドレス|メール|アドレス)(?:は|が|ですが|ですけど|なんですけど)?)?/;

/** ユーザー名の説明の後ろ、@ の前に付く言い回し（「会社名の後に@」「社名のアットマーク」）。 */
const LOCAL_TAIL = /(?:の後ろに|のうしろに|の後に|のあとに|の後|のあと|の|に|で|が|を|は)+$/;

export interface SpokenEmail {
  /** 格納するアドレス。ユーザー名が日本語の説明（「会社名」）のときは、説明のまま @ の前に置く */
  address: string;
  /** ユーザー名が英字で取れなかった（「会社名の後に@gmail.com」）。送付前に担当者が確認する */
  partial: boolean;
}

/**
 * 発話からメールアドレスを拾う。
 * 1. そのままのアドレス（tanaka@example.com。全角も可）
 * 2. 口頭の表現（「tanaka アットマーク ジーメール ドット コム」）
 * 3. ドメインだけ英字で分かる言い方（「会社名の後に@gmail.com」「社名のアットマークgmail.com」）
 *    → ユーザー名の説明を残して「会社名@gmail.com」として受け取る。取得失敗にすると聞き直しから抜けられない
 */
export function extractEmail(text: string): SpokenEmail | null {
  const compact = text.normalize("NFKC").replace(/\s/g, "");
  const direct = EMAIL_RE.exec(compact)?.[0];
  if (direct) return { address: direct, partial: false };

  let spoken = compact;
  for (const [pattern, to] of SPOKEN_EMAIL) spoken = spoken.replace(pattern, to);
  const full = EMAIL_RE.exec(spoken)?.[0];
  if (full) return { address: full, partial: false };

  const domain = EMAIL_DOMAIN.exec(spoken);
  if (!domain?.[1]) return null;
  // @ の直前の区切り（句読点）以降だけを見て、前置きと「の後に」を落とす
  const before = spoken.slice(0, domain.index).split(/[。、,]/).pop() ?? "";
  const local = before.replace(LOCAL_HEAD, "").replace(LOCAL_TAIL, "");
  // 「sample-kogyoの後に@gmail.com」のようにユーザー名が英字なら、そのまま完全なアドレスになる
  if (/^[A-Za-z0-9._%+-]+$/.test(local)) return { address: `${local}@${domain[1]}`, partial: false };
  return { address: `${local}@${domain[1]}`, partial: true };
}
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
  const email = extractEmail(text)?.address;
  const phone = PHONE_RE.exec(text.replace(/\s/g, ""))?.[0];
  if (email) facts.email = email;
  if (phone) facts.phone = phone;
  return facts;
}

/** 年齢層の回答（「50代」「40代から50代」）。 */
const AGE_ERA = /(\d{2})\s*代/;
/** 文脈語のない人数（「20人くらいです」）。その場面で人数を聞いているときだけ使う。 */
const BARE_COUNT = /(\d{1,4}|[〇一二三四五六七八九十]{1,4})\s*(?:名|人)/;

/** 聞き取れなかったときの前置き。聞き直すたびに変える（文言は PHRASES.reask*）。 */
const REASK_PREFIX: PhraseId[] = ["reask1", "reask2", "reask3"];

/**
 * 年齢層・人数をこちらから聞く前の段階。ここでは人数の言いっぱなしも拾う。
 * P2/P3 は専用の処理（年齢層も一緒に拾う）があるので含めない。
 */
const EARLY_PHASES = new Set<PhaseId>(["P0", "P1"]);

/** P8 で今どのスロットを聞いているか。 */
/**
 * P8 で聞く項目。メールアドレスの復唱（emailConfirm）は行わない。
 * アドレスの読み上げは音声合成になり、録音だけで通話できなくなるため（取得した時点で送付先として確定する）。
 */
type PendingSlot = HearingId | "email" | "callbackPhone" | "callbackWindow";

/** 詳細ヒアリング（H1〜H7）の項目か。 */
const isHearingSlot = (slot: PendingSlot | null): slot is HearingId => slot !== null && /^H[1-7]$/.test(slot);

/** P8 の各項目を尋ねる発話。 */
const SLOT_QUESTION: Record<PendingSlot, PhraseId> = {
  H1: "askH1",
  H2: "askH2",
  H3: "askH3",
  H4: "askH4",
  H5: "askH5",
  H6: "askH6",
  H7: "askH7",
  email: "askEmail",
  callbackPhone: "askCallbackPhone",
  callbackWindow: "askCallbackWindow",
};

/** 発話の部品。PHRASES の短い発話か、差し込み（メールアドレス・時刻など）の区間。 */
type Part = PhraseId | SpeechSegment;

/** ガードレールの切り返しで相手に投げた質問。次の発話をその文脈で読む。 */
type Expecting = "headcount" | "contact" | null;

/**
 * 保留の種類。
 * transfer: 受付が担当者に代わる途中（明けたら名乗り直す）
 * check:    話している相手が手元の確認などで待たせているだけ（明けたらそのまま続ける）
 */
type Hold = "transfer" | "check" | null;

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
  /** 各スロットを聞き直した回数。前置きを変えて同じ言い回しを続けないために持つ。 */
  private reasked = new Map<PendingSlot, number>();
  /** 要点だけを聞き直した切り返し。同じ聞き直しを繰り返さないために持つ。 */
  private recapped = new Set<VoiceLineId>();
  /** 言い直した台本。同じ台本を何度も流し直さないために持つ。 */
  private replayed = new Set<VoiceLineId>();
  /** 資料を郵送に切り替える案内を済ませたか。同じ案内を繰り返さないために持つ。 */
  private postalOffered = false;
  /** 取次ぎ先を尋ね返された回数。2回目は食い下がらない。 */
  private contactUnknownAsks = 0;
  /** 「ホームページを見て」と言われた回数。2回目は食い下がらない。 */
  private hpDeflections = 0;
  /** 一度でも HP 参照があったか。以後はメールアドレスの催促をしない。 */
  private hpReferenced = false;
  /**
   * HP 参照の切り返し（オンラインでのご挨拶の打診）を流したターンの位置。
   * 受付段階では日程フェーズへ進めないため、直後の「大丈夫です」をフェーズでは
   * 承諾と判別できない。打診の直後かどうかをこれで見る。
   */
  private meetingOfferedAt = -1;
  /** P8 から HP 参照の切り返しで日程調整（P7）へ戻したか。承諾されたら P8 の残りから再開する。 */
  private resumeP8 = false;
  /** 詳細ヒアリング（H1〜）へ移るときの前置きを済ませたか。1通話1回だけ挟む。 */
  private hearingCushioned = false;
  /** P5 で決算月・メールアドレスの片方だけを聞いた質問（両方を聞く台本の代わり）。 */
  private fiscalEmailAsk: PhraseId | null = null;
  /** その片方だけの質問を聞き直したか。聞き直しは1回まで。 */
  private fiscalEmailReasked = false;
  /** 公的機関との誤認を訂正済みか。同じ訂正を繰り返さないために持つ。 */
  private publicBodyCorrected = false;
  /** R7（不在）対応に切り替わっているか。戻り時間と折り返し先の確定だけを行う。 */
  private absentMode = false;
  /** 不在対応で何ターン粘ったか。確認が取れないまま長引かせないための上限。 */
  private absentTurns = 0;
  /** 不在対応で何を聞き終えたか。同じ質問を繰り返さないために持つ。 */
  private absentAsked = new Set<"window" | "contact">();
  /**
   * 連続して拒絶された回数（多忙・断りをまとめて数える）。
   * 種類が違っても2回続けて断られた時点で食い下がらない。
   */
  private refusalStreak = 0;
  /** 直前に流した収録台本。言い直しはフェーズではなくこれを基準にする。 */
  private lastLine: VoiceLineId | null = null;
  /** 相手が保留中か（保留中は AI は喋らない）。 */
  private holding: Hold = null;
  /** 本人・担当者と話していると分かっているか。受付の保留（取次ぎ）と、本人の保留を切り分ける。 */
  private personOnLine = false;
  /**
   * 代わって出た担当者に、まだ概要を伝えていないか。
   * 受付に概要を伝えたあとで取次がれた場合、担当者は用件を聞いていないので伝え直す。
   */
  private briefingOwed = false;

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
    let collected = this.collectExpected(text);
    // 質問していなくても、ヒアリング前の段階で人数だけ言われたら拾う
    // （誤認の訂正直後など、こちらが聞いていないタイミングで答えられることがある）
    if (!collected && EARLY_PHASES.has(this.state.phase) && !this.state.hearing.H5) {
      const n = toNumber(BARE_COUNT.exec(text)?.[1] ?? "") ?? phraseCount(text);
      if (n !== null && n > 0) {
        applyExtracted(this.state, { H5: `${n}名` });
        if (!this.harvested.includes("H5")) this.harvested.push("H5");
        collected = "headcount";
      }
    }

    // 「少々お待ちください」「代表に代わります」は保留の合図。相手が戻るまで AI は喋らない
    if (this.isHold(text, fired)) return this.hold(text, fired);
    // 保留が明けた。取次ぎの後なら、いま話しているのは代わって出た担当者
    const resumed = this.holding;
    this.holding = null;

    // 連絡先を聞いた直後の「この番号でいいです」は、番号が無くても回答として確定させる。
    // 「折り返して」「かけ直して」は多忙(R2)の言い回しにも当たるので、ガードレールより先に見る
    if (this.askingPhone() && isCurrentNumber(text)) return this.acceptCurrentNumber(text, fired);
    // P8 で「ホームページのアドレスで」と言われたら、聞き取り失敗として聞き直さない
    // （アドレスの文字列が出てこないので、聞き直しを続けると抜けられなくなる）
    // ただしアドレスそのもの（「〜アット nifty ドットネットでお願いします」）を言っている場合は HP 参照ではない
    if (this.askingContactInP8() && isHpAddress(text) && !extractEmail(text)) {
      return this.acceptHpAddress(text, fired);
    }

    const g = this.byGuardrail(text, fired);
    if (g) return g;

    // 切り返しで聞いた従業員数が取れたら、そのまま次の質問（決算月・メール）へ進む。
    // これは断り判定より先に見る。「20名でやってます」のような回答を
    // 「やってます＝断り」と取り違えると、答えているのに会話が止まってしまう。
    if (collected === "headcount") {
      this.unknownStreak = 0;
      this.refusalStreak = 0;
      return this.askFiscalEmail(fired, "切り返しへの回答から H5 を取得");
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

    // 「担当者のお名前は？」「誰に繋げば？」は用件確認でもヒアリングでもない。
    // 概要説明・人数確認・挨拶の繰り返しに落とさず、部署と役職で取次ぎ先を示す
    if (this.isContactGuard(text)) return this.handleContactUnknown(fired);

    // 「ホームページに載っています」は資料請求ではなく回避。
    // 断り判定より先に見て、メールアドレスの催促に入らないようにする
    if (this.isHpReference(text)) return this.handleHpReference(fired);

    // 断り・導入済みの申し出は、ヒアリングの進行より先に判定する
    if (this.isDecline(text)) {
      this.refusalStreak++;
      return this.handleDecline(fired);
    }

    // 担当者が電話口に出た直後は、いきなりヒアリングに入らず名乗り直して用件を伝える
    if (this.isArrival(text, resumed)) {
      return this.reintroduce(
        fired,
        resumed === "transfer"
          ? "取次ぎの保留が明けて担当者が応答 → 名乗り直して用件を伝える"
          : "担当者が電話を代わった → 名乗り直して用件を伝える",
      );
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
        return this.speakPhrases(["endThanks"], "END", fired, "締め完了");
      default:
        return this.speakPhrases(["endShort"], "END", fired, "終話");
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
    // 公的機関との誤認は他制度用の録音（r5_misunderstanding）とは別の一言で、立場の切り分けを必ず行う。
    if (has("R5")) {
      this.unknownStreak = 0;
      if (PUBLIC_BODY_CONFUSION.test(text) && !this.publicBodyCorrected) {
        this.publicBodyCorrected = true;
        return this.speakPhrases(
          ["r5PublicBody"],
          this.state.phase,
          fired,
          "R5: 公的機関との誤認を即座に訂正",
        );
      }
      const reply = this.guardrailReply(
        "r5OtherScheme",
        this.state.phase,
        fired,
        "R5: iDeCo・個人年金との勘違いを訂正",
      );
      if (reply) return reply;
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
    // R1: 「制度がない」は断りではなく最も見込みが高いホットサイン。
    // ただし P8 では「iDeCo はされていますか」「退職金制度は？」への回答として
    // 「特にやってません」が返ってくるのが普通なので、切り返しを流さず回答として受け取る
    // （流すと取得済みの従業員数を聞き直すことになり、ヒアリングが止まる）
    if (has("R1") && this.state.phase !== "P8") {
      this.unknownStreak = 0;
      this.expecting = "headcount";
      const reply = this.guardrailReply(
        "r1NoSystem",
        this.toPhase("P3"),
        fired,
        "R1: 断り判定を禁止し、未導入企業向けの訴求＋人数確認へ",
      );
      if (reply) return reply;
    }
    // R3: 専門家を否定せず、セカンドオピニオンの位置に回る
    if (has("R3")) {
      this.unknownStreak = 0;
      const reply = this.guardrailReply(
        "r3Expert",
        this.state.phase,
        fired,
        "R3: 専門家を否定せずセカンドオピニオンとして提案",
      );
      if (reply) return reply;
    }
    // R4: 資料送付で終わらせず、送付先メールアドレスの確定をセットで取る。
    // ただし「ホームページを見て」は送ってほしいという話ではないので、
    // 送付先の催促に入らず HP 参照として扱う
    if (has("R4") && (this.hpReferenced || this.isHpReference(text))) {
      return this.handleHpReference(fired);
    }
    if (has("R4")) {
      this.unknownStreak = 0;
      this.expecting = "contact";
      const reply = this.guardrailReply(
        "r4Document",
        this.state.phase,
        fired,
        "R4: 送付を受けたうえで送付先メールアドレスを確定",
      );
      if (reply) return reply;
    }
    // R2: 忙しい相手には要点だけを短く伝え、人数確認まで一気に運ぶ。
    // ただし再生は1通話1回だけ（2回目以降は afterBusy で質問側へ進める）
    // P8 で前日の連絡先・時間帯を聞いている場面の「折り返し」「かけ直し」は多忙ではなく回答
    const answeringCallback =
      this.state.phase === "P8" && (this.pending === "callbackPhone" || this.pending === "callbackWindow");
    if (has("R2") && !this.busyPitchDone && !answeringCallback) {
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
    // 取次ぎの申し出でも用件確認でも、次に話すのは法改正の概要（収録台本どおり）。
    // 「少々お待ちください」のような保留の合図は、ここに来る前に hold で扱っている
    if (TRANSFER.test(text) || ASK_PURPOSE.test(text)) {
      this.unknownStreak = 0;
      return this.say(
        "overview",
        "P1",
        fired,
        TRANSFER.test(text) ? "取次ぎ発生 → 法改正の概要" : "用件を問われた → 法改正の概要",
      );
    }
    // 「私です」など本人が出た合図は、受付突破として概要説明へ進む
    if (SELF_IDENTIFIED.test(text)) {
      this.unknownStreak = 0;
      this.personOnLine = true;
      return this.say("overview", "P1", fired, "本人が応答（受付突破） → 法改正の概要");
    }
    // 「はい、○○です」「もしもし」など、相手が電話口に出た合図には概要を伝える
    if (YES.test(text) || ANSWERED_CALL.test(text)) {
      this.unknownStreak = 0;
      return this.say("overview", "P1", fired, "相手が応答 → 法改正の概要");
    }
    return this.repair(fired, "受付の反応を判定できず");
  }

  private p1(text: string, fired: GuardrailId[]): DialogReply {
    // 名乗り直しの直後は、代わって出た担当者に概要を伝える（受付に伝えた分は担当者に届いていない）
    if (!this.said.has("overview") || this.briefingOwed) {
      this.briefingOwed = false;
      return this.say("overview", "P1", fired, "担当者接続 → 法改正の概要");
    }
    this.unknownStreak = 0;
    // 「どうぞ」「はい」は聞く姿勢を示しただけで、何かに答えたわけではない。
    // 「ご回答ありがとうございます！」から入る台本は使わず、「恐れ入ります、」から人数を伺う
    if (isPromptOnly(text)) return this.askHeadcountAfterPrompt(fired);
    return this.say("hearingAgeCount", "P3", fired, "概要への回答 → 年齢層と人数のヒアリング");
  }

  /**
   * 相槌・促しを受けて人数を伺う。
   * 収録台本（hearingAgeCount）は「ご回答ありがとうございます！」から入るので、答えていない相手には流さない。
   * この後の言い直しでもこの台本に戻らないよう、言い直し・要点の聞き直しとも使用済みにしておく。
   */
  private askHeadcountAfterPrompt(fired: GuardrailId[]): DialogReply {
    this.replayed.add("hearingAgeCount");
    this.recapped.add("hearingAgeCount");
    return this.speakPhrases(
      ["recapHearingAgeCount"],
      "P3",
      fired,
      "概要への相槌・促し（回答ではない）→ お礼の定型を使わず「恐れ入ります」から人数のヒアリング",
    );
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

    // 相槌だけで人数が分からないまま次に進むと、聞くべきことを聞き逃す
    const known = this.state.hearing.H3 ?? this.state.hearing.H4 ?? this.state.hearing.H5;
    if (got.length === 0 && (!YES.test(text) || !known)) {
      return this.repair(fired, "年齢層・人数の回答として読み取れず");
    }
    this.unknownStreak = 0;
    this.expecting = null;
    const note = got.length > 0 ? `${[...new Set(got)].join("・")} を取得` : "反応を確認";
    return this.askFiscalEmail(fired, note);
  }

  /**
   * 決算月と送付先メールアドレスを伺う（P5 へ）。
   * 収録台本（hearingFiscalEmail）は「決算月と、送付先のメールアドレス」を両方聞くので、
   * 片方をすでに聞けているときは、残りの片方だけを聞く録音に切り替える（聞けていることを聞き直さない）。
   * 両方とも聞けていれば、そのまま日程打診へ進む。
   */
  private askFiscalEmail(fired: GuardrailId[], note: string): DialogReply {
    const fiscal = Boolean(this.state.hearing.H7);
    const email = Boolean(this.state.email);
    if (fiscal && email && this.toPhase("P7") === "P7") {
      return this.say("schedule", "P7", fired, `${note} → 決算月・メールアドレスとも取得済みのため日程打診へ`);
    }
    if (fiscal === email) {
      return this.say("hearingFiscalEmail", this.toPhase("P5"), fired, `${note} → 決算月と送付先メールアドレスへ`);
    }
    // 決算月だけ取得済みなら送付先メールアドレスのみを伺う。P8 用の askEmail は「オンライン会議のURL」に触れていて
    // 日程を決める前には先走るので、recapDocument（「恐れ入ります、送付先のメールアドレスを…」）を使う
    const ask: PhraseId = fiscal ? "recapDocument" : "askH7";
    this.fiscalEmailAsk = ask;
    // この後の言い直しで、両方を聞く台本に戻らないようにする
    this.replayed.add("hearingFiscalEmail");
    this.recapped.add("hearingFiscalEmail");
    return this.speakPhrases(
      [ask],
      this.toPhase("P5"),
      fired,
      `${note} → ${fiscal ? "決算月は取得済みのため送付先メールアドレスのみ" : "メールアドレスは取得済みのため決算月のみ"}`,
    );
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
    if (this.state.email && !got.includes("email") && extractEmail(text)) {
      got.push("email");
    }

    // 郵送への切り替えは1回だけ。二度言われたら同じ案内を繰り返さず先へ進める
    if (got.length === 0 && EMAIL_UNAVAILABLE.test(text) && !this.postalOffered) {
      this.postalOffered = true;
      this.unknownStreak = 0;
      return this.speakPhrases(
        [this.state.hearing.H7 ? "postal" : "postalFiscal"],
        this.state.phase,
        fired,
        "メールが使えない → 郵送に切り替えて決算月のみ確認",
      );
    }
    if (got.length === 0 && !YES.test(text)) {
      // 片方だけを聞いた場合は、同じ質問を前置きを付けて1回だけ聞き直す（両方を聞く台本には戻らない）
      if (this.fiscalEmailAsk && !this.fiscalEmailReasked) {
        this.fiscalEmailReasked = true;
        const ask = this.fiscalEmailAsk;
        // 質問が「恐れ入ります、」から入るときは、前置きで「恐れ入ります」を重ねない
        const prefix: PhraseId = PHRASES[ask].text.startsWith("恐れ入ります") ? "reask2" : "reask1";
        return this.speakPhrases(
          [prefix, ask],
          this.state.phase,
          fired,
          `${ask === "askH7" ? "決算月" : "メールアドレス"}が聞き取れず再質問`,
        );
      }
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
      return this.speakPhrases(
        ["onlineHowto"],
        "P7",
        fired,
        "条件分岐: オンライン商談の説明",
      );
    }
    // 「そちらは遠い」という誤解も、移動不要であることだけ伝える
    if (/(遠い|距離|来られ|お越し|伺うの)/.test(text)) {
      this.unknownStreak = 0;
      return this.speakPhrases(
        ["noTravel"],
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
      // P8 から HP 参照の切り返しで戻ってきた場合は、連絡先の確認をやり直さず残りの確認事項へ進める
      if (this.resumeP8) {
        this.resumeP8 = false;
        return this.advanceP8(["日程を再確認"], fired);
      }
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
    const spokenEmail = extractEmail(text);
    if (spokenEmail?.partial && this.state.email === spokenEmail.address) {
      notes.push(`メールアドレスをドメインで取得（${spokenEmail.address}。ユーザー名は送付前に要確認）`);
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
          // 取れなかった項目は次へ進めず聞き直す（G2 の担保）。
          // 前置きを変えて、同じ言い回しが続かないようにする
          const attempt = this.reasked.get(this.pending) ?? 0;
          this.reasked.set(this.pending, attempt + 1);
          const prefix = REASK_PREFIX[attempt % REASK_PREFIX.length] ?? "reask1";
          return this.speakPhrases(
            [prefix, ...this.askParts(this.pending)],
            "P8",
            fired,
            `${this.pending} が聞き取れず再質問`,
          );
        }
      }
    }
    this.unknownStreak = 0;
    return this.advanceP8(notes, fired);
  }

  /**
   * P8 で次に聞く項目へ進める。全部揃っていればカレンダー登録依頼 → 締め(P9)。
   * lead は次の質問の前に添える一言（「こちらの番号宛にご連絡します」など）。
   * 締めは録音をそのまま流す（表示テキストと音声を食い違わせないため lead は付けない）。
   */
  private advanceP8(notes: string[], fired: GuardrailId[], lead?: PhraseId): DialogReply {
    // メールアドレスは復唱しない（アドレスの読み上げは音声合成になり、録音だけで通話できなくなる）。
    // 取得できた時点で送付先として確定し、復唱なしで確定したことを記録に残す
    if (this.state.email && !this.state.emailConfirmed) {
      applyExtracted(this.state, { email_confirmed: true });
      this.state.emailReadBackSkipped = true;
    }
    const leadParts: Part[] = lead ? [lead] : [];
    const nextSlot = this.nextSlot();
    if (!nextSlot) {
      this.pending = null;
      // 収録台本の締めにはカレンダー登録依頼が含まれていない。
      // 実データで53%しか実施されていない項目で、このデモの主張そのものなので、
      // 録音が無くても必ず1回入れる（DoD の「カレンダー登録を依頼した」を満たす）。
      if (!this.state.calendarRequested) {
        return this.speakPhrases(
          [...leadParts, "calendarRequest"],
          "P8",
          fired,
          `${notes.join(" / ") || "取得完了"} → カレンダー登録依頼`,
        );
      }
      return this.say(
        "closing",
        "P9",
        fired,
        `${notes.join(" / ") || "取得完了"} → 7項目＋連絡先が揃ったので締め(P9)`,
      );
    }
    // 連絡先の確認から詳細ヒアリングへ移るときは、いきなり質問せず前置きを挟む（1通話1回）。
    // 受け止めの一言（なければ「承知いたしました。」）＋「念のため確認させてください。」＋最初の質問を、
    // すべて収録済みの音源の連続再生で組み立てる（音声合成に落とさない）
    if (isHearingSlot(nextSlot) && !this.hearingCushioned) {
      this.hearingCushioned = true;
      this.pending = nextSlot;
      return this.speakPhrases(
        [...(leadParts.length > 0 ? leadParts : (["r7Ack"] as Part[])), "reask3", ...this.askParts(nextSlot)],
        "P8",
        fired,
        `${notes.length > 0 ? notes.join(" / ") + " → " : ""}前置きを挟んで ${nextSlot} へ`,
      );
    }
    this.pending = nextSlot;
    return this.speakPhrases(
      [...leadParts, ...this.askParts(nextSlot)],
      "P8",
      fired,
      `${notes.length > 0 ? notes.join(" / ") + " → " : ""}次は ${nextSlot}`,
    );
  }

  /** 折り返し先の電話番号を聞いている場面か（P8 の連絡先確認・不在時の折り返し先確認）。 */
  private askingPhone(): boolean {
    if (this.state.callbackPhone || this.state.ended) return false;
    return (this.state.phase === "P8" && this.pending === "callbackPhone") || this.absentMode;
  }

  /**
   * 「この番号でいいです」を受けて、発信先の番号を連絡先として確定する。
   * 聞き直しはせず、メールアドレスが未取得ならそれを、取得済みなら残りの確認事項へ進む。
   */
  private acceptCurrentNumber(text: string, fired: GuardrailId[]): DialogReply {
    applyExtracted(this.state, { callback_phone: CURRENT_NUMBER_LABEL, is_current_number: true });
    this.unknownStreak = 0;
    this.expecting = null;
    // 不在対応中は、戻り時間の確認と折り返しの約束へそのまま進める
    if (this.absentMode) return this.absentFollowUp(text, fired);

    const note = "発信番号の指定 → この番号で連絡先を確定";
    if (!this.state.email) {
      this.pending = "email";
      return this.speakPhrases(
        ["currentNumberAck", "currentNumberEmail"],
        "P8",
        fired,
        `${note} → 送付先メールアドレスへ`,
      );
    }
    return this.advanceP8([note], fired, "currentNumberAck");
  }

  /** P8 で連絡先（メールアドレス・前日連絡の番号）を聞いている場面か。 */
  private askingContactInP8(): boolean {
    if (this.state.phase !== "P8" || this.state.ended) return false;
    return this.pending === "email" || this.pending === "callbackPhone";
  }

  /**
   * P8 で「ホームページのアドレスで」と指定されたときの処理。
   *
   * アドレスの文字列が無いので抽出の失敗として扱うと、同じ質問を聞き直し続けて抜けられなくなる。
   * 指定された連絡先はこちらでサイトから確認するものとして確定する。
   *
   * この後に詳細ヒアリングへ入る場合は、承諾の一言（「承知いたしました。」）→
   * 前置き（「念のため確認させてください。」）→ 最初の質問の順に進め、唐突に質問を始めない。
   * それ以外は HP参照の切り返し（r_hp_reference）を流して日程調整（P7）へ戻し、承諾されたら P8 の残りから再開する。
   * 切り返しは1通話1回まで。すでに流していれば流し直さず、承諾の一言から残りの確認事項へ進める。
   */
  private acceptHpAddress(text: string, fired: GuardrailId[]): DialogReply {
    // 前日連絡の番号を聞いている場面で、アドレスは取得済みか番号の話をしているなら、番号の指定として受け取る
    const number = this.pending === "callbackPhone" && (Boolean(this.state.email) || /(番号|電話)/.test(text));
    if (number) applyExtracted(this.state, { callback_phone: HP_NUMBER_LABEL });
    else applyExtracted(this.state, { email: HP_ADDRESS_LABEL });
    this.hpReferenced = true;
    this.pending = null;
    this.unknownStreak = 0;
    this.expecting = null;
    const note = number ? "前日連絡の番号をHP掲載のもので指定" : "送付先をHP掲載のアドレスで指定";

    // 詳細ヒアリングへ入る場合・切り返しを流し済みの場合は、日程の打診を挟まず承諾の一言から P8 を続ける
    // （meetingOfferedAt は HP 参照の切り返しを流したときにだけ入る）
    const intoHearing = isHearingSlot(this.nextSlot()) && !this.hearingCushioned;
    if (intoHearing || this.meetingOfferedAt >= 0) {
      return this.advanceP8([`${note} → 承諾の一言から続ける`], fired, "r7Ack");
    }
    this.meetingOfferedAt = this.state.turns.length;
    this.resumeP8 = true;
    return this.speakPhrases(
      ["hpReference"],
      this.toPhase("P7"),
      fired,
      `${note} → 聞き直さずHP参照の切り返しを流し、日程調整(P7)へ戻る`,
    );
  }
  /** そのスロットがすでに埋まっているか。 */
  private isFilled(slot: PendingSlot): boolean {
    switch (slot) {
      case "email":
        return Boolean(this.state.email);
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
    if (!this.state.callbackPhone) return "callbackPhone";
    if (!this.state.callbackWindow) return "callbackWindow";
    return null;
  }

  /** その項目を尋ねる発話（すべて録音）。 */
  private askParts(slot: PendingSlot): Part[] {
    return [SLOT_QUESTION[slot]];
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
        const found = extractEmail(text);
        return { facts: { email: found?.address ?? null }, ok: Boolean(found) };
      }
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
    // 途中で本人に代わってもらえた場合は不在対応をやめて通常の会話に戻す。
    // 代わって出た本人には名乗り直してから用件を伝える
    if (TOOK_OVER.test(text) || HOLD_OVER.test(text)) {
      return this.reintroduce(fired, "不在から担当者に代わった → 名乗り直して用件を伝える");
    }
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
      return this.speakPhrases(
        ["r7Thanks", tts(`${window}頃に`), "r7CallbackClosing"],
        this.toPhase("P0X"),
        fired,
        "不在: 戻り時間と折り返し先を確保 → 折り返しを約束して終話",
      );
    }
    // 同じ質問を繰り返さない。聞けていない方を1回ずつ聞き、それでも取れなければ終話する
    const askedWindow = this.absentAsked.has("window");
    const askedContact = this.absentAsked.has("contact");
    if (!window && !askedWindow) {
      this.absentAsked.add("window");
      return this.speakPhrases(
        ["r7AskReturnTime"],
        this.state.phase,
        fired,
        "不在: 戻り時間の確認",
      );
    }
    if (!hasContact && !askedContact) {
      this.absentAsked.add("contact");
      this.expecting = "contact";
      return this.speakPhrases(
        window ? ["r7Ack", tts(`${window}頃に`), "r7CallbackAskContact"] : ["r7AskContact"],
        this.state.phase,
        fired,
        "不在: 折り返し先の確認",
      );
    }
    return this.say("reject", this.toPhase("P0X"), fired, "不在: 確認が取れないため粘らず終話");
  }

  // ---------- 取次ぎ（保留 → 担当者が電話口に出る） ----------

  /**
   * 保留の合図かどうか。
   * 取次ぎ先・用件を尋ねられている場合や、誤認（R5）を口にしている場合は黙らずに答える。
   */
  private isHold(text: string, fired: GuardrailId[]): boolean {
    if (!HOLD.test(text) || TOOK_OVER.test(text) || HOLD_OVER.test(text)) return false;
    return !this.isContactGuard(text) && !ASK_PURPOSE.test(text) && !fired.includes("R5");
  }

  /**
   * 保留中は何も言わずに待つ。
   * 受付の段階（P0/P1）の保留は取次ぎとみなし、明けたら名乗り直す。
   * 本人と話している最中の保留は、「担当に代わります」のように人が替わる場合だけ取次ぎとみなす。
   */
  private hold(text: string, fired: GuardrailId[]): DialogReply {
    const reception = this.state.phase === "P0" || this.state.phase === "P1";
    const transfer = reception && (!this.personOnLine || HANDOFF_VERB.test(text));
    this.holding = transfer ? "transfer" : "check";
    this.unknownStreak = 0;
    // 不在と言われたあとでも、代わってもらえるなら不在対応はやめる
    if (transfer) this.absentMode = false;
    return {
      utterance: "",
      phase: this.state.phase,
      guardrails: fired,
      matched: transfer
        ? "取次ぎの保留 → 担当者が出るまで発話せずに待つ"
        : "保留 → 相手が戻るまで発話せずに待つ",
      blocked: [],
      segments: [],
      holding: true,
    };
  }

  /**
   * 担当者が電話口に出た直後か。
   * 取次ぎの保留が明けた最初の発話は、名乗りの有無にかかわらず担当者のものとみなす。
   * 保留の合図が聞き取れていなくても、「お電話代わりました」は担当者の第一声とみなす。
   * 受付の段階（P0/P1）だけを見る。
   */
  private isArrival(text: string, resumed: Hold): boolean {
    const phase = this.state.phase;
    if (phase !== "P0" && phase !== "P1") return false;
    // 戻ってきた受付の「営業はお断り」は撤退として扱う
    if (REFUSE_SALES.test(text)) return false;
    if (resumed === "transfer" || TOOK_OVER.test(text)) return true;
    // 本人に待たされたあとの「お待たせしました」は、相手が替わっていないので名乗り直さない
    return resumed === null && !this.personOnLine && HOLD_OVER.test(text);
  }

  /**
   * 代わって出た担当者への第一声。
   * 受付に名乗った内容は担当者に届いていないので、いきなりヒアリングに入らず、
   * 名乗り直して用件を一言伝える。概要は相手の返事を受けてから P1 で伝える。
   */
  private reintroduce(fired: GuardrailId[], matched: string): DialogReply {
    this.personOnLine = true;
    this.absentMode = false;
    this.absentTurns = 0;
    this.unknownStreak = 0;
    this.briefingOwed = this.said.has("overview");
    return this.speakPhrases(["handoffReintro"], this.toPhase("P1"), fired, matched);
  }

  // ---------- 受付ガード（担当者名の確認・取次ぎ先不明） ----------

  /**
   * 「担当者のお名前は分かりますか」「誰に繋げばいいですか」への切り返し。
   *
   * こちらは特定の個人名を持っていないので、名前で答えることはできない。
   * 部署（人事・総務・福利厚生）と役職（代表者）で取次ぎ先を示して、
   * 相手が動ける形にして返す。フェーズは進めない（まだ担当者に届いていないため）。
   */
  /** 受付ガードとして扱う場面か（ヒアリング中は質問への回答なので見ない）。 */
  private isContactGuard(text: string): boolean {
    const phase = this.state.phase;
    if (phase === "P8" || phase === "P9" || phase === "END" || phase === "P0X") return false;
    return isContactGuard(text);
  }

  private handleContactUnknown(fired: GuardrailId[]): DialogReply {
    this.contactUnknownAsks++;
    this.unknownStreak = 0;
    if (this.contactUnknownAsks >= 2) {
      return this.say("reject", this.toPhase("P0X"), fired, "取次ぎ先が決まらず → 粘らず丁寧に終話");
    }
    return this.speakPhrases(
      ["contactDepartment"],
      this.state.phase,
      fired,
      "担当者名の確認・取次ぎ先不明 → 部署と役職で取次ぎ先を示して再依頼",
    );
  }

  // ---------- 「ホームページを見て」への対応 ----------

  /** 「ホームページに載っている」型の回避かどうか。 */
  private isHpReference(text: string): boolean {
    const phase = this.state.phase;
    // ヒアリング中（P8 以降）は質問への回答なので、回避としては見ない
    if (phase === "P8" || phase === "P9" || phase === "END" || phase === "P0X") return false;
    return HP_REFERENCE.test(text) || POSTED_ELSEWHERE.test(text);
  }

  /**
   * 「ホームページを見てください」と言われたときの切り返し。
   *
   * 送付先を聞き返すのは禁止（相手は送ってほしいと言っていない）。
   * 資料を送る理由が消えているので、受け止めたうえで直接オンラインでの接点に切り替える。
   * 2回続けて同じ回避をされたら食い下がらずに終話する。
   */
  private handleHpReference(fired: GuardrailId[]): DialogReply {
    this.hpReferenced = true;
    this.hpDeflections++;
    this.unknownStreak = 0;

    if (this.hpDeflections >= 2 || this.refusalStreak >= 1) {
      return this.say("reject", this.toPhase("P0X"), fired, "2回続けてHP参照で回避 → 粘らず丁寧に終話");
    }
    this.refusalStreak++;
    this.meetingOfferedAt = this.state.turns.length;
    return this.speakPhrases(
      ["hpReference"],
      this.toPhase("P7"),
      fired,
      "HP参照 → 送付先は聞かず、オンラインでの日程打診に切り替え",
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
      // 「大丈夫です、どうぞ」は続きを促している（断りではない）
      if (GO_AHEAD.test(text)) return false;
      // オンラインでのご挨拶を打診した直後の「大丈夫です」は、日程の可否への返事として読む
      const scheduling = phase === "P6" || phase === "P7" || this.justOfferedMeeting();
      return !scheduling && !SCHEDULE_CONTEXT.test(text);
    }
    return false;
  }

  /** 直前の AI 発話が、HP 参照の切り返し（オンラインでのご挨拶の打診）だったか。 */
  private justOfferedMeeting(): boolean {
    for (let i = this.state.turns.length - 1; i >= 0; i--) {
      if (this.state.turns[i]?.speaker !== "agent") continue;
      return i === this.meetingOfferedAt;
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

  /**
   * 言い直しの基準にする台本。
   *
   * 「実際に最後に流した質問」を使う。フェーズの主質問を使うと、切り返しで
   * フェーズが進んでいない場面で冒頭の挨拶まで巻き戻ってしまうため。
   * 挨拶は、まだ挨拶しかしていないときだけ言い直しの対象にする。
   */
  private repairAnchor(): VoiceLineId | undefined {
    const last = this.lastLine;
    // 読み上げだけの応答は said に入らないため、実際の発話数で数える
    const spoken = this.state.turns.filter((t) => t.speaker === "agent").length;
    const onlyGreeted = spoken <= 1;
    if (last && !CLOSING_LINES.has(last) && (last !== "greeting" || onlyGreeted)) return last;
    const phaseAnchor = PHASE_ANCHOR[this.state.phase];
    if (phaseAnchor === "greeting" && !onlyGreeted) return undefined;
    return phaseAnchor;
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
    const anchor = this.repairAnchor();

    // 1回目: 直前に流した質問をもう一度（電話では自然な立て直し）
    if (this.unknownStreak === 1 && anchor && !this.replayed.has(anchor)) {
      this.replayed.add(anchor);
      if (!this.justSaid(VOICE_LINES[anchor].text)) {
        return this.say(anchor, this.state.phase, fired, `${reason} → 直前の質問を言い直す`);
      }
      // たった今流したばかりの台本は繰り返さず、同じ内容を一言で聞き直す
      const recap = this.recapReply(
        anchor,
        this.state.phase,
        fired,
        `${reason} → 直前の質問を短く聞き直す`,
      );
      if (recap) return recap;
    }
    // 会話が始まっているのに概要をまだ伝えていなければ、そこから仕切り直す
    if (!this.said.has("overview")) {
      return this.say("overview", this.toPhase("P1"), fired, `${reason} → 概要から仕切り直す`);
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
  private say(id: VoiceLineId, proposed: PhaseId, fired: GuardrailId[], matched: string): DialogReply {
    this.said.add(id);
    this.lastLine = id;
    // 同じ通話で2回目に言う台本も録音で流す。
    // 同じ文言を続けて流さない制御は分岐側（言い直し・要点だけの聞き直し）で行っている。
    // ここで録音を外すと、同じ文言が合成音声で読まれて声だけが変わってしまう。
    const reply = this.emit([clip(VOICE_LINES[id])], proposed, fired, matched);
    // 締め（P9）も「失礼いたします」まで言い切る台本なので、P0X と同じく終話扱いにする
    if (id === "closing") this.state.ended = true;
    return reply;
  }

  /**
   * 切り返しを流す。すでに同じ台本を流していれば、同じ文言を繰り返さず要点だけ聞き直す。
   * 同じ切り返しが何度も流れると会話が進まなくなるため。
   */
  private guardrailReply(
    id: VoiceLineId,
    proposed: PhaseId,
    fired: GuardrailId[],
    matched: string,
  ): DialogReply | null {
    if (!this.said.has(id)) return this.say(id, proposed, fired, matched);
    return this.recapReply(id, proposed, fired, `${matched}（再掲のため要点のみ）`);
  }

  /**
   * 台本の要点だけを一言で聞き直す。
   * 1つの台本につき1回まで。直前と同じ文言になる場合は出さない（言えることが尽きたら次へ進める）。
   */
  private recapReply(
    id: VoiceLineId,
    proposed: PhaseId,
    fired: GuardrailId[],
    matched: string,
  ): DialogReply | null {
    const recap = RECAP[id];
    if (!recap || this.recapped.has(id) || this.justSaid(PHRASES[recap].text)) return null;
    this.recapped.add(id);
    return this.speakPhrases([recap], proposed, fired, matched);
  }

  /**
   * 主台本以外の発話（P8 の個別質問・前置き・差し込みのある一言など）。
   * 部品ごとに録音があれば MP3、無ければ音声合成で鳴らす。
   */
  private speakPhrases(parts: Part[], proposed: PhaseId, fired: GuardrailId[], matched: string): DialogReply {
    // 主台本ではないので、言い直しの基準（lastLine）は持ち越さない
    this.lastLine = null;
    const segments = parts.map((p) => (typeof p === "string" ? clip(PHRASES[p]) : p));
    return this.emit(segments, proposed, fired, matched);
  }

  private emit(segments: SpeechSegment[], proposed: PhaseId, fired: GuardrailId[], matched: string): DialogReply {
    // 出力前フィルタ（設計書 §6）。定型文ベースでも必ず通す。
    const raw = segments.map((s) => s.text).join("");
    const blocked = checkForbidden(raw).filter((v) => v.fixable);
    const spoken = segments.map(filterSegment);
    const utterance = spoken.map((s) => s.text).join("");

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
      segments: spoken,
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
