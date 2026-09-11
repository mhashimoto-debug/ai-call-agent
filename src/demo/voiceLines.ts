/**
 * 収録音声とその読み上げ内容（Vrew 台本 = 画面表示テキスト = 音声）。
 *
 * 画面に出す文字列と再生する音声を必ずここから取り出すことで、
 * 「表示テキストと音声が食い違う」ことが構造的に起きないようにしている。
 * 台本を直すときはここだけを直す（対応する MP3 の録り直しも必要）。
 *
 * 応答は区間（SpeechSegment）の並びで組み立てる。区間ごとに録音があれば MP3、
 * 無ければその区間だけ音声合成で鳴らすので、「前置き＋質問」のような連結や、
 * メールアドレス・時刻のような差し込みがあっても固定部分は録音のまま再生できる。
 */
import { autoFix } from "../domain/forbidden.js";
import { HEARING_SLOT_MAP } from "../domain/hearing.js";
import type { HearingId } from "../domain/types.js";
import { DEMO_SCENARIO } from "./scenario.js";

/**
 * 録音の置き場所。ページからの相対パスにしてあるので、
 * ローカルの静的サーバでも GitHub Pages（/<repo>/ 配下）でも同じ指定で解決できる。
 */
export const AUDIO_BASE = "public/audio/";

export const audioUrl = (file: string): string => `${AUDIO_BASE}${file}`;

export interface VoiceLine {
  /** public/audio/ 内のファイル名 */
  readonly file: string;
  /** 収録した読み上げ内容そのもの */
  readonly text: string;
}

/** 応答を鳴らす単位。 */
export interface SpeechSegment {
  /** 画面表示と読み上げに使うテキスト */
  text: string;
  /** この区間の録音。無ければこの区間だけ音声合成で読み上げる */
  audioFile?: string;
}

/**
 * フェーズ・ガードレールの主台本。
 * 想定外の発話で立て直すときは、直前に流したこの台本を基準に言い直す。
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

/** ヒアリング項目の質問文。末尾の補足（括弧書き）は口に出さないので落とす。 */
function hearingQuestion(id: HearingId): string {
  return (HEARING_SLOT_MAP.get(id)?.question ?? "").replace(/（[^）]*）\s*$/, "");
}

const sc = DEMO_SCENARIO;

/**
 * 主台本の間を埋める短い発話（個別の質問・前置き・聞き直し・条件分岐の一言など）。
 * 言い直しの基準にはならず、複数を組み合わせて1つの応答にすることがある。
 *
 * デモ先の名前・日時を含むもの（hpReference・calendarRequest・askH3/H4/H6）は
 * DEMO_SCENARIO と hearing.ts から組み立てている。シナリオを変えたら MP3 も録り直すこと。
 */
export const PHRASES = {
  // ---- 受付ガード（取次ぎ先・用件の確認） ----
  contactDepartment: {
    file: "p0_contact_department.mp3",
    text: "恐れ入ります、特定の個人名ではなく、現在御社で人事・総務や福利厚生をご担当されている方、あるいは代表者様にお繋ぎいただけますでしょうか？",
  },
  transferContactName: {
    file: "b_contact_name.mp3",
    text: "失礼いたしました！特定のお名前ではなく、人事・総務のご担当者様か代表者様にお繋ぎいただけますでしょうか？",
  },
  transferContactDepartment: {
    file: "b_contact_department.mp3",
    text: "失礼いたしました！総務や人事のご担当者様、あるいは代表者様（社長様）にお繋ぎいただけますでしょうか？",
  },
  transferPurposeFollowup: {
    file: "b_purpose_followup.mp3",
    text: "はい、御社の現在の制度導入状況についての簡単な確認でございます。恐れ入りますが、ご担当者様にお繋ぎいただけますでしょうか？",
  },

  // ---- ガードレールの切り返し ----
  r5PublicBody: {
    file: "r5_public_body.mp3",
    text: "紛らわしくて申し訳ございません。制度は厚生労働省の管轄ですが、私どもは民間の導入支援事業者でございます。",
  },
  hpReference: {
    file: "r_hp_reference.mp3",
    text: `承知いたしました！では弊社にてサイトより確認させていただきますね。差し支えなければ、${sc.contactTitle}様と一度${sc.meetingMinutes}分ほどオンラインでご挨拶だけでもお時間いただけないでしょうか？`,
  },

  // ---- R7 不在（{戻り時間} を挟むものは前後で分けて収録する） ----
  r7AskReturnTime: {
    file: "r7_ask_return_time.mp3",
    text: "恐れ入ります、何時頃でしたらお戻りになりますでしょうか。改めてこちらからお電話いたします。",
  },
  r7AskContact: {
    file: "r7_ask_contact.mp3",
    text: "恐れ入ります、ご担当者様のお電話番号かメールアドレスだけ伺えますでしょうか？",
  },
  /** 「承知いたしました。」＋{戻り時間}頃に＋r7CallbackAskContact */
  r7Ack: { file: "r7_ack.mp3", text: "承知いたしました。" },
  r7CallbackAskContact: {
    file: "r7_callback_ask_contact.mp3",
    text: "改めてお電話いたします。念のため、ご担当者様のお電話番号かメールアドレスを伺えますでしょうか？",
  },
  /** 「ありがとうございます。それでは」＋{戻り時間}頃に＋r7CallbackClosing */
  r7Thanks: { file: "r7_thanks.mp3", text: "ありがとうございます。それでは" },
  r7CallbackClosing: {
    file: "r7_callback_closing.mp3",
    text: "改めてお電話いたします。お忙しいところ失礼いたしました。",
  },

  // ---- P4/P5 メールが使えない ----
  postal: { file: "p5_postal.mp3", text: "承知いたしました。それでは資料は郵送でお送りいたします。" },
  postalFiscal: {
    file: "p5_postal_fiscal.mp3",
    text: "承知いたしました。それでは、御社の決算月だけ伺えますでしょうか？資料は郵送でもお送りできます。",
  },

  // ---- P7 条件分岐 ----
  onlineHowto: {
    file: "p7_online_howto.mp3",
    text: "スマートフォンでも参加できます。メールでお送りするURLをタップいただくだけですので、難しい操作はございません。",
  },
  noTravel: { file: "p7_no_travel.mp3", text: "オンラインですので、ご移動やご来社は不要でございます。" },

  // ---- P8 ヒアリング（未取得の項目を上から順に聞く） ----
  askH1: { file: "p8_h1_ideco.mp3", text: hearingQuestion("H1") },
  askH2: { file: "p8_h2_retirement.mp3", text: hearingQuestion("H2") },
  askH3: { file: "p8_h3_age.mp3", text: hearingQuestion("H3") },
  askH4: { file: "p8_h4_officers.mp3", text: hearingQuestion("H4") },
  askH5: { file: "p8_h5_insured.mp3", text: hearingQuestion("H5") },
  askH6: { file: "p8_h6_authority.mp3", text: hearingQuestion("H6") },
  askH7: { file: "p8_h7_fiscal.mp3", text: hearingQuestion("H7") },
  askEmail: {
    file: "p8_email.mp3",
    text: "資料とオンライン会議のURLをお送りしたいのですが、メールアドレスを伺えますでしょうか？",
  },
  /** 「復唱させていただきます。」＋{メールアドレス}＋emailConfirmPost */
  emailConfirmPre: { file: "p8_email_confirm_pre.mp3", text: "復唱させていただきます。" },
  emailConfirmPost: { file: "p8_email_confirm_post.mp3", text: "でお間違いないでしょうか？" },
  askCallbackPhone: {
    file: "p8_callback_phone.mp3",
    text: "前日に確認のご連絡を差し上げたいのですが、お電話番号を伺えますでしょうか？",
  },
  askCallbackWindow: { file: "p8_callback_window.mp3", text: "前日のご連絡は、何時頃が繋がりやすいでしょうか？" },
  /** 「この番号でいいです」への返事。次の質問の前に添える */
  currentNumberAck: {
    file: "p8_current_number_ack.mp3",
    text: "承知いたしました！ではこちらの番号宛にご連絡を差し上げますね。",
  },
  currentNumberEmail: {
    file: "p8_current_number_email.mp3",
    text: "差し支えなければ送付先のメールアドレスもお伺いできますでしょうか？",
  },
  calendarRequest: {
    file: "p8_calendar_request.mp3",
    text: `担当の予定の兼ね合いで、もし日程変更になりますと次回のご案内がかなり先になる可能性がございます。お手数ですが${sc.proposedDate}${sc.proposedTime}で、一旦カレンダーにご予定だけ入れておいていただけますと助かります。`,
  },
  /**
   * 聞き取れなかったときの前置き（質問の頭に付ける）。
   * 同じ質問を一字一句同じ言い方で繰り返すと機械的に聞こえるため、聞き直すたびに変える。
   */
  reask1: { file: "p8_reask_1.mp3", text: "恐れ入ります、もう一度お伺いできますでしょうか。" },
  reask2: { file: "p8_reask_2.mp3", text: "お手数をおかけいたします。" },
  reask3: { file: "p8_reask_3.mp3", text: "念のため確認させてください。" },

  // ---- 終話 ----
  endThanks: { file: "end_thanks.mp3", text: "本日はお時間をいただきありがとうございました。失礼いたします。" },
  endShort: { file: "end_short.mp3", text: "ありがとうございました。失礼いたします。" },

  // ---- 短い聞き直し（直前と同じ主台本を繰り返す代わりに、要点だけを一言で聞く） ----
  recapGreeting: {
    file: "recap_p0_greeting.mp3",
    text: "恐れ入ります、2026年12月の法改正の件で、ご担当者様にお繋ぎいただけますでしょうか？",
  },
  recapOverview: {
    file: "recap_p1_overview.mp3",
    text: "恐れ入ります、御社では役員様の退職金のご準備は何かされていますでしょうか？",
  },
  recapHearingAgeCount: {
    file: "recap_p2_p3_hearing.mp3",
    text: "恐れ入ります、役員様と従業員様を合わせて、おおよそ何名様でいらっしゃいますか？",
  },
  recapHearingFiscalEmail: {
    file: "recap_p4_p5_hearing.mp3",
    text: "恐れ入ります、御社の決算月はいつになりますでしょうか？",
  },
  recapSchedule: {
    file: "recap_p7_schedule.mp3",
    text: "恐れ入ります、来週の水曜日14時頃でしたら、ご都合いかがでしょうか？",
  },
  recapReschedule: {
    file: "recap_reschedule.mp3",
    text: "恐れ入ります、木曜日の15時頃でしたら、ご都合いかがでしょうか？",
  },
  recapContact: {
    file: "recap_p8_recovery.mp3",
    text: "恐れ入ります、ご担当者様のお電話番号かメールアドレスを伺えますでしょうか？",
  },
  recapHeadcount: {
    file: "recap_headcount.mp3",
    text: "恐れ入ります、御社の現在の従業員数だけ伺えますでしょうか？",
  },
  recapExpert: {
    file: "recap_r3_expert.mp3",
    text: "恐れ入ります、セカンドオピニオンとして情報のご確認だけでもいかがでしょうか？",
  },
  recapDocument: { file: "recap_r4_document.mp3", text: "恐れ入ります、送付先のメールアドレスを伺えますでしょうか？" },
  recapAbsent: { file: "recap_r7_absent.mp3", text: "恐れ入ります、何時頃でしたらお戻りになりますでしょうか？" },
} as const satisfies Record<string, VoiceLine>;

export type PhraseId = keyof typeof PHRASES;

/**
 * まだ収録していない MP3。ここにあるファイルは取りに行かず、最初から音声合成で読み上げる
 * （存在しないファイルを取りに行くと、404 を待つあいだ連続再生が途切れるため）。
 *
 * 収録したら public/audio/ に置き、ここから外す。
 * 置いたのに外し忘れていると npm test が落ちて知らせる（逆も同じ）。
 */
export const UNRECORDED: ReadonlySet<string> = new Set([
  "p0_contact_department.mp3",
  "b_contact_name.mp3",
  "b_contact_department.mp3",
  "b_purpose_followup.mp3",
  "r5_public_body.mp3",
  "r_hp_reference.mp3",
  "r7_ask_return_time.mp3",
  "r7_ask_contact.mp3",
  "r7_ack.mp3",
  "r7_callback_ask_contact.mp3",
  "r7_thanks.mp3",
  "r7_callback_closing.mp3",
  "p5_postal.mp3",
  "p5_postal_fiscal.mp3",
  "p7_online_howto.mp3",
  "p7_no_travel.mp3",
  "p8_h1_ideco.mp3",
  "p8_h2_retirement.mp3",
  "p8_h3_age.mp3",
  "p8_h4_officers.mp3",
  "p8_h5_insured.mp3",
  "p8_h6_authority.mp3",
  "p8_h7_fiscal.mp3",
  "p8_email.mp3",
  "p8_email_confirm_pre.mp3",
  "p8_email_confirm_post.mp3",
  "p8_callback_phone.mp3",
  "p8_callback_window.mp3",
  "p8_current_number_ack.mp3",
  "p8_current_number_email.mp3",
  "p8_calendar_request.mp3",
  "p8_reask_1.mp3",
  "p8_reask_2.mp3",
  "p8_reask_3.mp3",
  "end_thanks.mp3",
  "end_short.mp3",
  "recap_p0_greeting.mp3",
  "recap_p1_overview.mp3",
  "recap_p2_p3_hearing.mp3",
  "recap_p4_p5_hearing.mp3",
  "recap_p7_schedule.mp3",
  "recap_reschedule.mp3",
  "recap_p8_recovery.mp3",
  "recap_headcount.mp3",
  "recap_r3_expert.mp3",
  "recap_r4_document.mp3",
  "recap_r7_absent.mp3",
]);

/** 収録済みの発話を1区間にする。未収録なら録音を付けない（音声合成で読む）。 */
export function clip(line: VoiceLine): SpeechSegment {
  return UNRECORDED.has(line.file) ? { text: line.text } : { text: line.text, audioFile: audioUrl(line.file) };
}

/** 差し込み（メールアドレス・時刻など）の区間。常に音声合成で読む。 */
export const tts = (text: string): SpeechSegment => ({ text });

/**
 * 区間に出力前フィルタ（設計書 §6）を通す。
 * 書き換えが入った区間は録音と文言がずれるので、その区間だけ音声合成に切り替える
 * （禁止表現を録音のまま相手に届けないため）。
 */
export function filterSegment(s: SpeechSegment): SpeechSegment {
  const text = autoFix(s.text).text;
  return text === s.text ? s : { text };
}

/** 応答が鳴らす録音のパスを順に並べる。 */
export function audioFiles(segments: readonly SpeechSegment[]): string[] {
  return segments.flatMap((s) => (s.audioFile ? [s.audioFile] : []));
}
