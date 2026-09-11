import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bulkExtract,
  DialogEngine,
  extractEmail,
  GUARDRAIL_LINE,
  HP_ADDRESS_LABEL,
  HP_NUMBER_LABEL,
  isPromptOnly,
  type DialogReply,
} from "./dialogEngine.js";
import { AUDIO_BASE, PHRASES, VOICE_LINES, audioFiles } from "./voiceLines.js";
import { detectGuardrails } from "../domain/guardrails.js";
import type { GuardrailId } from "../domain/types.js";
import { applyExtracted, createCallState } from "../domain/state.js";
import { evaluateDod } from "../domain/dod.js";
import { autoFix, checkForbidden } from "../domain/forbidden.js";

function fresh() {
  const state = createCallState();
  return { state, dialog: new DialogEngine(state) };
}

// ---------- 収録台本と画面表示テキストの一致 ----------

test("応答の表示テキストは収録台本と完全一致し、対応する MP3 が付く", () => {
  const { dialog } = fresh();
  const g = dialog.greeting();
  assert.equal(g.utterance, VOICE_LINES.greeting.text);
  assert.deepEqual(audioFiles(g.segments), [`${AUDIO_BASE}${VOICE_LINES.greeting.file}`]);

  const r = dialog.respond("どういったご用件でしょうか？");
  assert.equal(r.utterance, VOICE_LINES.overview.text);
  assert.deepEqual(audioFiles(r.segments), [`${AUDIO_BASE}${VOICE_LINES.overview.file}`]);
});

// ---------- ガードレール ----------

test("R2 多忙は新台本どおり要点＋人数確認まで一気に運ぶ", () => {
  const { state, dialog } = fresh();
  state.phase = "P5";
  const r = dialog.respond("今ちょっと忙しいんですよ");
  assert.ok(r.guardrails.includes("R2"));
  assert.equal(r.utterance, VOICE_LINES.r2Busy.text);
  assert.deepEqual(audioFiles(r.segments), [`${AUDIO_BASE}r2_busy.mp3`]);
  assert.match(r.utterance, /御社の現在の従業員数だけお伺いできますでしょうか/);
  // 続けて言われた人数は、フェーズに関係なくその場で回収する
  dialog.respond("うちは20人くらいですね");
  assert.equal(state.hearing.H5, "20名");
});

test("R1 制度なしはホットサインとして扱い、人数確認へ進む", () => {
  const { state, dialog } = fresh();
  state.phase = "P1";
  const r = dialog.respond("うち、退職金制度は何もないんですよ");
  assert.ok(r.guardrails.includes("R1"));
  assert.equal(r.phase, "P3");
  assert.equal(r.utterance, VOICE_LINES.r1NoSystem.text);
  assert.notEqual(state.phase, "END");
});

test("R3 専門家任せはセカンドオピニオンとして提案し、専門家を下げない", () => {
  const { state, dialog } = fresh();
  state.phase = "P3";
  const r = dialog.respond("そのへんは顧問税理士に任せているので");
  assert.equal(r.utterance, VOICE_LINES.r3Expert.text);
  assert.match(r.utterance, /セカンドオピニオン/);
  assert.doesNotMatch(r.utterance, /詳しくない|わかっていない/);
});

test("R4 資料請求は送付先メールアドレスの確定をセットで取る", () => {
  const { state, dialog } = fresh();
  state.phase = "P5";
  const r = dialog.respond("とりあえず資料だけ送ってください");
  assert.equal(r.utterance, VOICE_LINES.r4Document.text);
  assert.match(r.utterance, /メールアドレス/);
  // 続けて言われたアドレスをその場で回収する
  dialog.respond("nakamura@sample-kogyo.co.jp です");
  assert.equal(state.email, "nakamura@sample-kogyo.co.jp");
});

test("R5 は誤認の種類で切り返しを分ける（他制度は録音、公的機関は立場の切り分け）", () => {
  const { state: s1, dialog: d1 } = fresh();
  s1.phase = "P3";
  const other = d1.respond("それってiDeCoのことですよね？");
  assert.ok(other.guardrails.includes("R5"));
  assert.equal(other.utterance, VOICE_LINES.r5OtherScheme.text);
  assert.deepEqual(audioFiles(other.segments), [`${AUDIO_BASE}r5_misunderstanding.mp3`]);

  const { state: s2, dialog: d2 } = fresh();
  s2.phase = "P3";
  const publicBody = d2.respond("お国がやるなら手数料もかからんのでしょう");
  assert.ok(publicBody.guardrails.includes("R5"));
  // 立場の切り分けは実データ由来の必須ルール。他制度用の録音ではなく専用の一言で必ず言う
  assert.match(publicBody.utterance, /民間の導入支援事業者/);
  assert.deepEqual(publicBody.segments.map((s) => s.text), [PHRASES.r5PublicBody.text]);
});

test("R7 決裁者不在は連絡先の確保に切り替える", () => {
  const { state, dialog } = fresh();
  state.phase = "P8";
  const r = dialog.respond("代表は外出しております");
  assert.ok(r.guardrails.includes("R7"));
  assert.equal(r.utterance, VOICE_LINES.r7Absent.text);
  assert.match(r.utterance, /お戻りの際/);
});

test("拡充した判定辞書が実際の言い回しのゆれを拾う", () => {
  const cases: [string, GuardrailId][] = [
    ["退職金は特に設けておりませんね", "R1"],
    ["そういうのはこれから考えようかと思ってまして", "R1"],
    ["すみません、今打ち合わせ中でして", "R2"],
    ["また後日改めてもらえますか", "R2"],
    ["顧問の先生に全部見てもらってるので", "R3"],
    ["パンフレットだけ郵送してもらえますか", "R4"],
    ["商工会議所の方ですか？", "R5"],
    ["それは個人で入る年金のやつでしょう", "R5"],
    ["社長は出張でおりません", "R7"],
    ["私では判断できないんですよ", "R7"],
  ];
  for (const [text, expected] of cases) {
    assert.ok(
      detectGuardrails(text).includes(expected),
      `「${text}」で ${expected} が発火しない（検知: ${detectGuardrails(text).join(",") || "なし"}）`,
    );
  }
});

test("ガードレールの切り返しにはすべて対応する録音が紐づく", () => {
  for (const [id, lineId] of Object.entries(GUARDRAIL_LINE)) {
    assert.ok(VOICE_LINES[lineId], `${id} の録音定義が無い`);
  }
});

// ---------- 取次ぎ（保留 → 担当者が電話口に出る） ----------

const REINTRO = "お電話代わっていただきありがとうございます！私、企業型確定拠出年金相談センターと申します。2026年12月の法改正の件でご連絡いたしました。";

test("『少々お待ちください』の後に担当者が出た際、再名乗り/概要説明を経てからヒアリングへ進む", () => {
  const { state, dialog } = fresh();
  dialog.greeting();

  // 保留中は喋らない（保留中の受付に向かって概要や質問を話し始めない）
  const hold = dialog.respond("少々お待ちください、代表に代わります");
  assert.equal(hold.holding, true, `保留中に発話している: ${hold.matched}`);
  assert.equal(hold.utterance, "");
  assert.deepEqual(hold.segments, []);
  assert.equal(hold.phase, "P0");
  assert.equal(state.turns.filter((t) => t.speaker === "agent").length, 1, "保留中の無言を AI の発話として積んでいる");

  // 担当者が出たら、いきなりヒアリング（P3）に入らず名乗り直して用件を伝える
  const reintro = dialog.respond("はい、お電話代わりました。中村です。");
  assert.equal(reintro.utterance, REINTRO, `名乗り直していない: ${reintro.matched}`);
  assert.equal(PHRASES.handoffReintro.text, REINTRO);
  assert.notEqual(reintro.utterance, VOICE_LINES.hearingAgeCount.text, "担当者にいきなり人数を聞いている");
  assert.equal(reintro.phase, "P1");

  // 相手の返事を受けて法改正の概要（P1）を伝え、そのあとでヒアリング（P3）へ進む
  const overview = dialog.respond("はい、どういったお話でしょう");
  assert.equal(overview.utterance, VOICE_LINES.overview.text, `概要を伝えていない: ${overview.matched}`);
  assert.equal(overview.phase, "P1");
  const hearing = dialog.respond("なるほど、そうなんですね");
  assert.equal(hearing.utterance, PHRASES.recapHearingAgeCount.text);
  assert.doesNotMatch(hearing.utterance, /ご回答ありがとうございます/, "相槌に回答のお礼を言っている");
  assert.equal(hearing.phase, "P3");
});

for (const arrival of ["お電話代わりました", "はい、代わりました", "お待たせしました", "お待たせいたしました、中村です", "はい、代表の中村です", "もしもし"]) {
  test(`取次ぎ: 保留のあとの「${arrival}」には名乗り直してから概要へ進む`, () => {
    const { dialog } = fresh();
    dialog.greeting();
    assert.equal(dialog.respond("少々お待ちください").holding, true);
    const r = dialog.respond(arrival);
    assert.equal(r.utterance, REINTRO, `名乗り直していない: ${r.matched}`);
    assert.equal(dialog.respond("はい").utterance, VOICE_LINES.overview.text);
  });
}

for (const arrival of ["お電話代わりました、中村です", "はい、代わりました", "お待たせしました"]) {
  test(`取次ぎ: 保留の合図が聞き取れていなくても「${arrival}」は担当者の第一声として名乗り直す`, () => {
    const { dialog } = fresh();
    dialog.greeting();
    const r = dialog.respond(arrival);
    assert.equal(r.utterance, REINTRO, `名乗り直していない: ${r.matched}`);
    assert.equal(r.phase, "P1");
  });
}

test("取次ぎ: 受付に概要を伝えたあとの保留でもヒアリングへ進まず、担当者に名乗り直して概要を伝え直す", () => {
  const { dialog } = fresh();
  dialog.greeting();
  assert.equal(dialog.respond("どういったご用件でしょうか？").utterance, VOICE_LINES.overview.text);

  const hold = dialog.respond("かしこまりました、少々お待ちください。代表に代わります。");
  assert.equal(hold.holding, true, `保留中の受付に向かって話している: ${hold.matched}`);
  assert.notEqual(hold.utterance, VOICE_LINES.hearingAgeCount.text);

  assert.equal(dialog.respond("お電話代わりました、中村です").utterance, REINTRO);
  // 受付に伝えた概要は担当者に届いていないので、もう一度伝える
  const overview = dialog.respond("はい");
  assert.equal(overview.utterance, VOICE_LINES.overview.text, `担当者に概要を伝えていない: ${overview.matched}`);
  assert.equal(dialog.respond("なるほど").utterance, PHRASES.recapHearingAgeCount.text);
});

test("取次ぎ: 保留の合図に制度なし(R1)が混じっても、保留中の受付には切り返さない", () => {
  const { state, dialog } = fresh();
  dialog.greeting();
  const r = dialog.respond("積立の制度ですか…。特に何もしていないと思いますが、少々お待ちください。代表に代わります。");
  assert.equal(r.holding, true, `保留中に切り返している: ${r.matched}`);
  assert.ok(state.firedGuardrails.includes("R1"), "R1 の検知自体は記録する");
  assert.equal(dialog.respond("はい、お電話代わりました。中村です。").utterance, REINTRO);
});

test("取次ぎ: 本人が手元の確認で待たせただけなら、戻ったあとに名乗り直さない", () => {
  const { dialog } = fresh();
  dialog.greeting();
  assert.equal(dialog.respond("私です").utterance, VOICE_LINES.overview.text);
  assert.equal(dialog.respond("ちょっと待ってくださいね").holding, true);
  const back = dialog.respond("お待たせしました、どうぞ");
  assert.notEqual(back.utterance, REINTRO, "相手が替わっていないのに名乗り直している");
  assert.equal(back.utterance, PHRASES.recapHearingAgeCount.text);
});

test("取次ぎ: 保留のあとに受付が不在を伝えたら、名乗り直さず不在対応に切り替える", () => {
  const { dialog } = fresh();
  dialog.greeting();
  dialog.respond("少々お待ちください");
  const r = dialog.respond("申し訳ございません、あいにく代表は外出しております");
  assert.equal(r.utterance, VOICE_LINES.r7Absent.text, `不在対応になっていない: ${r.matched}`);
});

test("取次ぎ: ヒアリング中の「少々お待ちください」も黙って待ち、戻ってからの回答をそのまま受け取る", () => {
  const { state, dialog } = fresh();
  state.phase = "P5";
  assert.equal(dialog.respond("決算月ですね、少々お待ちください").holding, true);
  const r = dialog.respond("お待たせしました、3月です");
  assert.equal(state.hearing.H7, "3月");
  assert.equal(r.utterance, VOICE_LINES.schedule.text);
});

// ---------- 概要のあとの相槌・促し ----------

const PROMPTS = [
  "どうぞ",
  "はい",
  "はい、どうぞ",
  "どうぞ教えてください",
  "ええ、お願いします",
  "なるほど",
  "はい、聞いてますよ",
  "大丈夫です、どうぞ",
  "詳しく話してください",
  "詳しく教えて",
  "もう少し詳しくお願いします",
  "詳しく聞かせてください",
];

for (const text of PROMPTS) {
  test(`相手が『${text}』と促した場合に『ご回答ありがとうございます』と言わずにヒアリングへ進む`, () => {
    const { dialog } = fresh();
    dialog.greeting();
    assert.equal(dialog.respond("私です").utterance, VOICE_LINES.overview.text);

    const r = dialog.respond(text);
    assert.doesNotMatch(r.utterance, /ご回答ありがとうございます/, `促しに回答のお礼を言っている: ${r.matched}`);
    assert.equal(r.utterance, PHRASES.recapHearingAgeCount.text, `人数のヒアリングへ進んでいない: ${r.matched}`);
    assert.match(r.utterance, /^恐れ入ります、/);
    assert.deepEqual(audioFiles(r.segments), [`${AUDIO_BASE}recap_p2_p3_hearing.mp3`]);
    assert.equal(r.phase, "P3");

    // 続けて人数を答えてもらえれば、そのまま次の質問へ進む
    assert.equal(dialog.respond("20人くらいです").utterance, VOICE_LINES.hearingFiscalEmail.text);
  });
}

test("概要への実のある回答には、これまでどおり「ご回答ありがとうございます」から人数を伺う", () => {
  const { dialog } = fresh();
  dialog.greeting();
  dialog.respond("私です");
  const r = dialog.respond("社長の退職金は前から気になってたんですよ");
  assert.equal(r.utterance, VOICE_LINES.hearingAgeCount.text);
  assert.equal(r.phase, "P3");
});

test("促しのあとに聞き取れない返事が続いても、「ご回答ありがとうございます」の台本に戻らない", () => {
  const { dialog } = fresh();
  dialog.greeting();
  dialog.respond("私です");
  dialog.respond("どうぞ");
  const r = dialog.respond("えーっと、なんでしたっけ");
  assert.doesNotMatch(r.utterance, /ご回答ありがとうございます/, `答えていない相手に回答のお礼を言っている: ${r.matched}`);
  assert.notEqual(r.utterance, PHRASES.recapHearingAgeCount.text, "同じ聞き直しを続けている");
  assert.match(r.utterance, /従業員数/);
});

test("相槌・促しの判定: 相槌だけの発話と、中身のある回答を切り分ける", () => {
  for (const text of [...PROMPTS, "で？", "お待たせしました、どうぞ", "ええと、はい"]) {
    assert.ok(isPromptOnly(text), `相槌・促しとして判定されない: ${text}`);
  }
  for (const text of ["役員は2人です", "うちは保険でやってます", "どういうことですか", "特に考えてないですね", ""]) {
    assert.ok(!isPromptOnly(text), `回答を相槌と誤判定している: ${text}`);
  }
});

// ---------- P8: 送付先を「ホームページのアドレスで」と指定された ----------

const ALL_HEARING = {
  H1: "iDeCo・投資ともになし",
  H2: "保険のみ",
  H3: "56歳",
  H4: "2名",
  H5: "10名",
  H6: "代表の判断で決裁可能",
  H7: "3月",
};

/** 日程を確定させ、連絡先の確認（電話番号またはメールアドレス）まで進める。ヒアリング7項目は取得済みとする。 */
function atContact() {
  const ctx = fresh();
  ctx.state.phase = "P7";
  applyExtracted(ctx.state, ALL_HEARING);
  assert.equal(ctx.dialog.respond("はい、その時間で大丈夫です").utterance, VOICE_LINES.contact.text);
  return ctx;
}

/** さらに前日連絡の番号を答え、P8 でメールアドレスを尋ねるところまで進める。 */
function atEmailSlot() {
  const ctx = atContact();
  assert.equal(ctx.dialog.respond("090-1234-5678 です").utterance, PHRASES.askEmail.text);
  return ctx;
}

test("P8で『ホームページのでいいです』と回答した際に r_hp_reference が再生されて日程調整へ移行する", () => {
  const { state, dialog } = atEmailSlot();
  const r = dialog.respond("ホームページのでいいです");
  assert.doesNotMatch(r.matched, /聞き取れず/, `聞き取れずの再質問に落ちている: ${r.matched}`);
  assert.equal(r.utterance, PHRASES.hpReference.text);
  assert.deepEqual(audioFiles(r.segments), [`${AUDIO_BASE}r_hp_reference.mp3`]);
  assert.equal(r.phase, "P7");
  assert.equal(state.email, HP_ADDRESS_LABEL);

  // 日程調整に戻って承諾されたら、メールアドレスを聞き直さずに P8 の残りへ進む
  const back = dialog.respond("はい、大丈夫です");
  assert.equal(back.phase, "P8");
  assert.doesNotMatch(back.utterance, /メールアドレス/, `メールアドレスを聞き直している: ${back.matched}`);
  assert.equal(back.utterance, PHRASES.askCallbackWindow.text);

  // 最後まで進めば締め(P9)に届き、アポ成立の条件も満たす
  assert.match(dialog.respond("午前中なら繋がります").utterance, /カレンダー/);
  assert.equal(dialog.respond("はい、入れておきます").utterance, VOICE_LINES.closing.text);
  assert.ok(evaluateDod(state).passed, "DoD を満たしていない");
});

for (const text of [
  "HPに載ってるアドレスで",
  "サイトを見てください",
  "ホームページに載ってるメールに送ってください",
  "Webのアドレスでお願いします",
  "ホームページに出てますので",
]) {
  test(`P8 HP参照: 「${text}」はメールアドレスの聞き取り失敗にせず、HP参照の切り返しへ進む`, () => {
    const { state, dialog } = atEmailSlot();
    const r = dialog.respond(text);
    assert.doesNotMatch(r.matched, /聞き取れず/, `聞き取れずの再質問に落ちている: ${r.matched}`);
    assert.equal(r.utterance, PHRASES.hpReference.text);
    assert.equal(r.phase, "P7");
    assert.equal(state.email, HP_ADDRESS_LABEL);
  });
}

test("P8 HP参照: 番号もホームページのでと言われたら、切り返しを流し直さず聞き直しにも落ちずに先へ進む", () => {
  const { state, dialog } = atContact();
  const first = dialog.respond("ホームページのでいいです");
  assert.equal(first.utterance, PHRASES.hpReference.text);
  assert.equal(state.email, HP_ADDRESS_LABEL);
  assert.equal(dialog.respond("はい、大丈夫です").utterance, PHRASES.askCallbackPhone.text);

  const second = dialog.respond("それもホームページに載ってる番号で");
  assert.notEqual(second.utterance, PHRASES.hpReference.text, "HP参照の切り返しを繰り返している");
  assert.doesNotMatch(second.matched, /聞き取れず/, `聞き取れずの再質問に落ちている: ${second.matched}`);
  assert.equal(state.callbackPhone, HP_NUMBER_LABEL);
  // 打診は繰り返さず、承諾の一言を添えて次の確認へ進む
  assert.equal(second.utterance, `${PHRASES.r7Ack.text}${PHRASES.askCallbackWindow.text}`);
  assert.equal(state.ended, false);
});

// ---------- P8: 連絡先の確認から詳細ヒアリング（H1〜）への移り方 ----------

const segTexts = (r: DialogReply): string[] => r.segments.map((s) => s.text);

/** 前置き＋最初の質問（受け止め → 「念のため確認させてください。」→ H1）を鳴らす録音。 */
const CUSHION_H1_FILES = [`${AUDIO_BASE}r7_ack.mp3`, `${AUDIO_BASE}p8_reask_3.mp3`, `${AUDIO_BASE}p8_h1_ideco.mp3`];

/** すべての区間に録音が付いていること（音声合成に落ちない）。 */
function assertFullyRecorded(r: DialogReply, label: string): void {
  for (const s of r.segments) {
    assert.ok(s.audioFile, `${label}: 「${s.text}」が録音ではなく音声合成で読まれる`);
  }
}

test("P8完了/HP参照後に前置きメッセージを経てから H1 質問へ進む", () => {
  // 連絡先の確認を終えたら、いきなり H1 を聞かずに前置きを挟む
  const { state, dialog } = fresh();
  state.phase = "P7";
  dialog.respond("はい、その時間で大丈夫です"); // → 連絡先の確認
  const r = dialog.respond("090-1234-5678 です");
  assert.equal(r.utterance, "承知いたしました。念のため確認させてください。現在 iDeCo やその他の投資はされていますか？");
  assert.deepEqual(segTexts(r), [PHRASES.r7Ack.text, PHRASES.reask3.text, PHRASES.askH1.text]);
  assert.deepEqual(audioFiles(r.segments), CUSHION_H1_FILES);
  assertFullyRecorded(r, "連絡先→H1");
  assert.equal(r.phase, "P8");

  // HP参照から入る場合も、承諾の一言 → 前置き → H1 の順。日程の打診には戻らない
  const hp = fresh();
  hp.state.phase = "P7";
  hp.dialog.respond("はい、その時間で大丈夫です");
  const ack = hp.dialog.respond("ホームページに載ってるので");
  assert.deepEqual(segTexts(ack), [PHRASES.r7Ack.text, PHRASES.reask3.text, PHRASES.askH1.text]);
  assert.deepEqual(audioFiles(ack.segments), CUSHION_H1_FILES);
  assertFullyRecorded(ack, "HP参照→H1");
  assert.notEqual(ack.utterance, PHRASES.hpReference.text, "詳細ヒアリングの前に日程の打診へ戻っている");
  assert.equal(ack.phase, "P8");
  assert.equal(hp.state.email, HP_ADDRESS_LABEL);
});

test("P8 前置き: 受け止めの言葉が違っても、前置き＋最初の質問はすべて録音で鳴らす", () => {
  const { state, dialog } = fresh();
  state.phase = "P7";
  applyExtracted(state, { email: "nakamura@example.co.jp", email_confirmed: true });
  dialog.respond("はい、その時間で大丈夫です");
  const r = dialog.respond("この番号でいいです");
  assert.deepEqual(segTexts(r), [PHRASES.currentNumberAck.text, PHRASES.reask3.text, PHRASES.askH1.text]);
  assertFullyRecorded(r, "発信番号→H1");
});

test("P8 前置き: 前置きは1回しか挟まない", () => {
  const { state, dialog } = fresh();
  state.phase = "P7";
  dialog.respond("はい、その時間で大丈夫です");
  dialog.respond("090-1234-5678 です"); // → 前置き＋H1
  const next = dialog.respond("やってないです");
  assert.deepEqual(segTexts(next), [PHRASES.askH2.text], "前置きを繰り返している");
  assertFullyRecorded(next, "H2");
});

// ---------- P8: 日本語混じりのメールアドレス指定 ----------

/** 復唱の区間（前置き・アドレス・確認）。 */
const confirmParts = (address: string): string[] => [
  PHRASES.emailConfirmPre.text,
  `${address} `,
  PHRASES.emailConfirmPost.text,
];

test("P8で『会社名の後に@gmail.comです』と回答した際にメアド取得成功となりP9へ進む", () => {
  const { state, dialog } = atEmailSlot();
  const r = dialog.respond("会社名の後に@gmail.comです");
  assert.doesNotMatch(r.matched, /聞き取れず/, `聞き取れずの再質問に落ちている: ${r.matched}`);
  assert.equal(state.email, "会社名@gmail.com");
  // ユーザー名は説明のまま残し、復唱で確認してもらう
  assert.deepEqual(segTexts(r), confirmParts("会社名@gmail.com"));
  assert.equal(r.phase, "P8");

  assert.equal(dialog.respond("はい、それで合っています").utterance, PHRASES.askCallbackWindow.text);
  assert.equal(state.emailConfirmed, true);
  assert.match(dialog.respond("午前中なら繋がります").utterance, /カレンダー/);
  const closing = dialog.respond("はい、入れておきます");
  assert.equal(closing.utterance, VOICE_LINES.closing.text);
  assert.equal(closing.phase, "P9");
  assert.ok(evaluateDod(state).passed, "DoD を満たしていない");
});

const SPOKEN_EMAILS: [string, string][] = [
  ["社名のアットマークgmail.comです", "社名@gmail.com"],
  ["会社名のあとにアットマーク ジーメール ドット コムです", "会社名@gmail.com"],
  ["メールは会社名の後に@yahoo.co.jpです", "会社名@yahoo.co.jp"],
  ["sample-kogyo アット gmail ドット com です", "sample-kogyo@gmail.com"],
  ["nakamura あっと ヤフー ドット シーオー ドット ジェーピー", "nakamura@yahoo.co.jp"],
  ["ＮＡＫＡＭＵＲＡ＠ｅｘａｍｐｌｅ．ｃｏ．ｊｐ", "NAKAMURA@example.co.jp"],
  ["sample-kogyoの後に@gmail.comです", "sample-kogyo@gmail.com"],
];

for (const [text, expected] of SPOKEN_EMAILS) {
  test(`P8 メール: 「${text}」をアドレスとして受け取り、聞き直さずに復唱へ進む`, () => {
    const { state, dialog } = atEmailSlot();
    const r = dialog.respond(text);
    assert.doesNotMatch(r.matched, /聞き取れず/, `聞き取れずの再質問に落ちている: ${r.matched}`);
    assert.equal(state.email, expected);
    assert.deepEqual(segTexts(r), confirmParts(expected));
  });
}

test("P8 メール: 英字でユーザー名が取れたものは完全なアドレス、説明のままのものは要確認として区別する", () => {
  assert.deepEqual(extractEmail("会社名の後に@gmail.comです"), { address: "会社名@gmail.com", partial: true });
  assert.deepEqual(extractEmail("tanaka@example.com です"), { address: "tanaka@example.com", partial: false });
  for (const text of ["アットホームな会社です", "ホームページのアドレスで", "インターネットで見てください", "3月です"]) {
    assert.equal(extractEmail(text), null, `メールアドレスでない発話を拾っている: ${text}`);
  }
});

test("P8 メール: 復唱したアドレスを言い直されたら、新しいアドレスで復唱し直す", () => {
  const { state, dialog } = atEmailSlot();
  dialog.respond("会社名の後に@gmail.comです"); // → 復唱
  const again = dialog.respond("いえ、sample-kogyo@gmail.com です");
  assert.equal(state.email, "sample-kogyo@gmail.com");
  assert.deepEqual(segTexts(again), confirmParts("sample-kogyo@gmail.com"));
  assert.equal(state.emailConfirmed, false);
  dialog.respond("はい、合っています");
  assert.equal(state.emailConfirmed, true);
});

test("P8 メール: 「〜ドットネットでお願いします」はアドレスとして受け取り、HP参照と取り違えない", () => {
  const { state, dialog } = atEmailSlot();
  const r = dialog.respond("nakamura アット nifty ドット ネットでお願いします");
  assert.notEqual(r.utterance, PHRASES.hpReference.text, "HP参照として扱っている");
  assert.equal(state.email, "nakamura@nifty.net");
  assert.deepEqual(segTexts(r), confirmParts("nakamura@nifty.net"));
});

// ---------- P5: 決算月・メールアドレスのうち、聞けていない方だけを尋ねる ----------

/** 概要のあと人数のヒアリング（P3）まで進める。 */
function atHeadcount() {
  const ctx = fresh();
  ctx.dialog.greeting();
  ctx.dialog.respond("私です"); // → 概要
  assert.equal(ctx.dialog.respond("どうぞ").utterance, PHRASES.recapHearingAgeCount.text); // → 人数(P3)
  return ctx;
}

test("P3で決算月を先に答えていれば、P5では決算月を聞き直さずメールアドレスだけを尋ねる", () => {
  const { state, dialog } = atHeadcount();
  const r = dialog.respond("20人くらいで、決算は3月です");
  assert.equal(state.hearing.H7, "3月");
  assert.notEqual(r.utterance, VOICE_LINES.hearingFiscalEmail.text, "取得済みの決算月を聞き直している");
  assert.doesNotMatch(r.utterance, /決算月/);
  assert.equal(r.utterance, PHRASES.askEmail.text);
  assert.deepEqual(audioFiles(r.segments), [`${AUDIO_BASE}p8_email.mp3`]);
  assert.equal(r.phase, "P5");

  // メールアドレスを答えれば日程打診へ
  assert.equal(dialog.respond("nakamura@example.co.jp です").utterance, VOICE_LINES.schedule.text);
});

test("P5 メールアドレスだけを聞いて聞き取れなかったときは、決算月と両方を聞く台本に戻らず同じ質問を聞き直す", () => {
  const { dialog } = atHeadcount();
  dialog.respond("20人くらいで、決算は3月です"); // → メールアドレスのみ
  const again = dialog.respond("えーっと");
  assert.deepEqual(segTexts(again), [PHRASES.reask1.text, PHRASES.askEmail.text]);
  assert.doesNotMatch(again.utterance, /決算月/);
});

test("P3でメールアドレスを先に答えていれば、P5では決算月だけを尋ねる", () => {
  const { state, dialog } = atHeadcount();
  const r = dialog.respond("20人です。メールは nakamura@example.co.jp です");
  assert.equal(state.email, "nakamura@example.co.jp");
  assert.equal(r.utterance, PHRASES.askH7.text);
  assert.deepEqual(audioFiles(r.segments), [`${AUDIO_BASE}p8_h7_fiscal.mp3`]);
  assert.equal(dialog.respond("3月です").utterance, VOICE_LINES.schedule.text);
});

test("P3で決算月もメールアドレスも答えていれば、P5を飛ばして日程打診へ進む", () => {
  const { dialog } = atHeadcount();
  const r = dialog.respond("20人で、決算は3月、メールは nakamura@example.co.jp です");
  assert.equal(r.utterance, VOICE_LINES.schedule.text);
  assert.equal(r.phase, "P7");
});

test("P3で何も先に答えていなければ、これまでどおり決算月と送付先メールアドレスを両方尋ねる", () => {
  const { dialog } = atHeadcount();
  assert.equal(dialog.respond("20人くらいです").utterance, VOICE_LINES.hearingFiscalEmail.text);
});

// ---------- 想定外発話のフォールバック ----------

test("想定外の発話でも読み上げに落とさず、録音で会話を立て直す", () => {
  const { dialog } = fresh();
  dialog.greeting();
  dialog.respond("少々お待ちください、代わります"); // → 保留（発話しない）
  dialog.respond("はい、代表の中村です"); // → 名乗り直し(P1)
  dialog.respond("はい"); // → 概要(P1)
  const asked = dialog.respond("社長の退職金は前から気になってたんですよ"); // → 回答を受けて年齢層・人数(P3)
  assert.equal(asked.utterance, VOICE_LINES.hearingAgeCount.text);

  // 1回目: 直前に聞いた内容をそのまま短く聞き直す（長い台本は繰り返さない）
  const first = dialog.respond("えーっと、それで何の話でしたっけ");
  assert.match(first.utterance, /何名様/);
  assert.match(first.matched, /聞き直す/);

  // 2回目: 答えやすい最小の質問（人数だけ）に切り替える
  const second = dialog.respond("いやー、どうもよく分からないですね");
  assert.equal(second.utterance, VOICE_LINES.r1NoSystem.text);
  assert.deepEqual(audioFiles(second.segments), [`${AUDIO_BASE}r1_no_system.mp3`]);
  assert.match(second.matched, /最小の質問/);

  // 3回目: 内容を離れて日程の話に振る
  const third = dialog.respond("うーん");
  assert.equal(third.utterance, VOICE_LINES.schedule.text);
  assert.match(third.matched, /日程打診/);

  // それでも噛み合わなければ丁寧に終話する
  const fourth = dialog.respond("......");
  assert.equal(fourth.utterance, VOICE_LINES.reject.text);
  assert.equal(fourth.phase, "P0X");
});

test("立て直しの途中で回答が得られたら通常の進行に戻る", () => {
  const { state, dialog } = fresh();
  state.phase = "P3";
  const repaired = dialog.respond("すみません、聞き取れませんでした");
  assert.match(repaired.matched, /言い直す/);

  const answered = dialog.respond("40代から50代で、全部で20人ですね");
  assert.equal(state.hearing.H3, "40代");
  assert.equal(state.hearing.H5, "20名");
  assert.equal(answered.utterance, VOICE_LINES.hearingFiscalEmail.text);
  assert.deepEqual(audioFiles(answered.segments), [`${AUDIO_BASE}p4_p5_hearin.mp3`]);
});

test("日程NGは開いた質問に戻さず収録済みの代替日程で出し直す", () => {
  const { state, dialog } = fresh();
  state.phase = "P7";
  const r = dialog.respond("その日は予定が入っておりまして");
  assert.equal(r.utterance, VOICE_LINES.reschedule.text);
  assert.deepEqual(audioFiles(r.segments), [`${AUDIO_BASE}reschedule.mp3`]);
  assert.equal(r.phase, "P7");
});

// ---------- 一括情報抽出（まとめ聞き） ----------

test("人数・決算月・年齢・連絡先を1発話からまとめて抽出する", () => {
  assert.deepEqual(bulkExtract("役員は私を入れて3名、社会保険は10名、決算は3月です"), {
    officers: 3,
    insured: 10,
    fiscalMonth: 3,
  });
  assert.deepEqual(bulkExtract("役員が二名で、従業員は十二名ですね"), { officers: 2, insured: 12 });
  assert.deepEqual(bulkExtract("決算は9月で、メールは info@example.co.jp です"), {
    fiscalMonth: 9,
    email: "info@example.co.jp",
  });
  assert.deepEqual(bulkExtract("090-1234-5678 にお願いします"), { phone: "090-1234-5678" });
});

test("文脈語のない数字は人数・決算月として拾わない（質問を飛ばさない）", () => {
  assert.deepEqual(bulkExtract("9月17日でお願いします"), {});
  assert.deepEqual(bulkExtract("14時から30分ですね"), {});
  assert.deepEqual(bulkExtract("そちらは3名くらいですか"), {});
});

test("まとめ聞きで答えられた項目は再質問せずスキップして進む", () => {
  const { state, dialog } = fresh();
  state.phase = "P7";
  const asked: string[] = [];
  const say = (t: string) => {
    const r = dialog.respond(t);
    asked.push(r.matched);
    return r;
  };

  say("はい、その時間で大丈夫です"); // 日程確定 → P8（連絡先確認）
  const bulk = say("090-1234-5678 です。役員は私を入れて3名、社会保険は10名、決算は3月です");

  assert.match(bulk.matched, /まとめ聞きで H4・H5・H7 を同時取得/);
  assert.equal(state.callbackPhone, "090-1234-5678");
  assert.equal(state.hearing.H5, "10名");
  assert.equal(state.hearing.H7, "3月");

  for (const slot of ["H4", "H5", "H7"]) {
    assert.ok(
      !asked.some((m) => m.includes(`次は ${slot}`)),
      `${slot} を質問してしまっている: ${asked.join(" | ")}`,
    );
  }
});

// ---------- 通し ----------

test("新台本の自由発話で通しても DoD が全項目○になる", () => {
  const { state, dialog } = fresh();
  const say = (t: string) => dialog.respond(t);

  dialog.greeting();
  say("はい、サンプル工業でございます。どういったご用件でしょうか？");
  say("うちは退職金制度、まだ何も導入していないんですよ");
  say("40代から50代が中心で、役員2名と社員18名の合わせて20人ですね");
  say("決算は3月です。メールは nakamura@sample-kogyo.co.jp でお願いします");
  say("はい、その時間なら大丈夫です");
  say("090-1234-5678 です");
  // ここから先は主台本に無い項目（PHRASES の個別質問）
  say("iDeCoはやっていません");
  say("退職金は保険だけです");
  say("私は56歳です");
  say("決めるのは私です");
  say("はい、そのアドレスで合っています");
  const calendar = say("午前中がつながりやすいです");
  const last = say("わかりました、入れておきます");

  assert.match(calendar.utterance, /カレンダー/);
  assert.equal(last.utterance, VOICE_LINES.closing.text);
  assert.equal(last.phase, "P9");

  const dod = evaluateDod(state);
  assert.equal(
    dod.passed,
    true,
    `未充足: ${dod.items.filter((i) => !i.ok).map((i) => i.label).join(", ")}`,
  );
});

test("自由発話の応答も禁止ワードフィルタを必ず通る", () => {
  const { state, dialog } = fresh();
  const inputs = [
    "どういったご用件ですか",
    "保険でやってます",
    "把握してないですね",
    "20人くらいです",
    "決算は3月です",
    "はい大丈夫です",
    "090-1234-5678 です",
  ];
  for (const i of inputs) {
    const r = dialog.respond(i);
    assert.deepEqual(checkForbidden(r.utterance), [], `違反: ${r.utterance}`);
  }
  assert.equal(state.blockedViolationCount, 0);
});

// ---------- R2（多忙）の連続発火防止 ----------

test("R2 の切り返しは1通話で一度しか再生されない", () => {
  const { dialog } = fresh();
  dialog.greeting();
  const replies = ["ちょっと今忙しいんだよね", "いや、だから今バタバタしてて", "うーん、時間ないんだよ"].map(
    (t) => dialog.respond(t),
  );

  const busyCount = replies.filter((r) => r.utterance === VOICE_LINES.r2Busy.text).length;
  assert.equal(busyCount, 1, `R2 のセリフが ${busyCount} 回再生されている`);
});

test("2回連続の多忙は食い下がらず、収録済みの終話へ直接つなぐ", () => {
  const { state, dialog } = fresh();
  dialog.greeting();

  // 1回目: 30秒だけ要点を伝えて食い下がる
  const busy = dialog.respond("ちょっと今忙しいんだよね");
  assert.equal(busy.utterance, VOICE_LINES.r2Busy.text);
  assert.deepEqual(audioFiles(busy.segments), [`${AUDIO_BASE}r2_busy.mp3`]);

  // 2回目: 別の話題に引き延ばさず丁寧に終話する
  const closed = dialog.respond("だから今バタバタしてるんだって");
  assert.equal(closed.utterance, VOICE_LINES.reject.text);
  assert.deepEqual(audioFiles(closed.segments), [`${AUDIO_BASE}reject_closing.mp3`]);
  assert.match(closed.matched, /2回連続の多忙/);
  assert.equal(state.ended, true);

  // 人数確認や概要説明に引き延ばしていないこと
  assert.notEqual(closed.utterance, VOICE_LINES.r1NoSystem.text);
  assert.notEqual(closed.utterance, VOICE_LINES.overview.text);
});

test("多忙が続いても同じセリフが2回連続せず、2ターンで終話に着地する", () => {
  const { state, dialog } = fresh();
  dialog.greeting();
  const inputs = ["ちょっと今忙しいんだよね", "いや、だから今バタバタしてて"];

  let previous = "";
  for (const input of inputs) {
    const r = dialog.respond(input);
    assert.notEqual(r.utterance, previous, `同じセリフが連続している: ${r.utterance.slice(0, 24)}`);
    assert.ok(audioFiles(r.segments).length > 0, `録音ではなく音声合成に落ちている: ${r.matched}`);
    previous = r.utterance;
  }
  assert.equal(state.ended, true);
});

test("謝罪から入る台本が続けて再生されない（多忙・日程NG・想定外の流れ）", () => {
  const opensWithApology = (t: string): boolean =>
    /^(あ、|ああ、)?(大変|誠に)?(失礼(いた)?しました|申し訳|すみません)/.test(t);

  const scenarios: { phase: "P0" | "P3" | "P7"; inputs: string[] }[] = [
    { phase: "P0", inputs: ["ちょっと今忙しいんだよね", "いや、だから今バタバタしてて"] },
    { phase: "P7", inputs: ["その日は都合が悪いですね", "それも難しいですね", "うーん"] },
    { phase: "P3", inputs: ["えーっと", "よく分からないですね", "うーん", "……"] },
  ];

  for (const { phase, inputs } of scenarios) {
    const { state, dialog } = fresh();
    state.phase = phase;
    const said: string[] = [dialog.greeting().utterance];
    for (const input of inputs) said.push(dialog.respond(input).utterance);

    for (let i = 1; i < said.length; i++) {
      const prev = said[i - 1] ?? "";
      const now = said[i] ?? "";
      assert.ok(
        !(opensWithApology(prev) && opensWithApology(now)),
        `謝罪が連続している（${phase}）: 「${prev.slice(0, 16)}」→「${now.slice(0, 16)}」`,
      );
    }
  }
});

test("代替日程も断られたら同じ提案を繰り返さない", () => {
  const { state, dialog } = fresh();
  state.phase = "P7";
  const first = dialog.respond("その日は予定が入っておりまして");
  assert.equal(first.utterance, VOICE_LINES.reschedule.text);
  const second = dialog.respond("その日も厳しいですね");
  assert.notEqual(second.utterance, VOICE_LINES.reschedule.text);
  assert.match(second.matched, /代替日程も合わず/);
});

test("R2 の直後に人数を答えられたら、そのまま回収して通常進行に戻る", () => {
  const { state, dialog } = fresh();
  state.phase = "P1";
  dialog.respond("すみません、今ちょっと立て込んでまして");
  const answered = dialog.respond("うちは20人くらいですね");
  assert.equal(state.hearing.H5, "20名");
  assert.notEqual(answered.utterance, VOICE_LINES.r2Busy.text);
});

// ---------- R7（不在）の判定と切り返し ----------

test("主語のない不在の言い回しを R7 として検知する", () => {
  const absent = [
    "今不在にしてます",
    "不在です",
    "ただいま席を外しております",
    "出かけております",
    "出張しております",
    "本日は休みを取っております",
    "夕方には戻ります",
    "外出中です",
    "あいにく外出しております",
    "今おりません",
    "留守にしております",
  ];
  for (const text of absent) {
    assert.ok(
      detectGuardrails(text).includes("R7"),
      `「${text}」が R7 として検知されない（検知: ${detectGuardrails(text).join(",") || "なし"}）`,
    );
  }
});

test("不在の言い回しを制度未導入(R1)と取り違えない", () => {
  // 「設けておりません」は不在ではなく制度未導入
  assert.ok(detectGuardrails("退職金は特に設けておりませんね").includes("R1"));
  assert.ok(!detectGuardrails("退職金は特に設けておりませんね").includes("R7"));
});

test("不在と言われたら人数確認ではなく不在用の切り返しへ進む", () => {
  const { dialog } = fresh();
  dialog.greeting();
  const r = dialog.respond("今不在にしてます");
  assert.equal(r.utterance, VOICE_LINES.r7Absent.text);
  assert.deepEqual(audioFiles(r.segments), [`${AUDIO_BASE}r7_absent.mp3`]);
  assert.notEqual(r.utterance, VOICE_LINES.r1NoSystem.text);
  assert.doesNotMatch(r.matched, /判定できず/);
});

test("不在は戻り時間と折り返し先を確定して終話する", () => {
  const { state, dialog } = fresh();
  dialog.greeting();
  dialog.respond("担当は今不在にしてます");
  const askContact = dialog.respond("夕方には戻ります");
  assert.equal(state.callbackWindow, "夕方");
  assert.match(askContact.utterance, /(お電話番号|メールアドレス|お戻り)/);

  const closing = dialog.respond("090-1234-5678 です");
  assert.equal(state.callbackPhone, "090-1234-5678");
  assert.match(closing.utterance, /夕方頃に改めてお電話いたします/);
  assert.equal(state.ended, true);
});

test("不在の切り返しも同じ録音を繰り返さない", () => {
  const { dialog } = fresh();
  dialog.greeting();
  const first = dialog.respond("今不在にしてます");
  const second = dialog.respond("まだ戻っておりません");
  assert.equal(first.utterance, VOICE_LINES.r7Absent.text);
  assert.notEqual(second.utterance, VOICE_LINES.r7Absent.text);
});

// ---------- 断り・導入済みの判定 ----------

test("断り・導入済みの発話ではヒアリングを進めず切り返す", () => {
  const declines = [
    "うちはもう対策してるので",
    "やっていました",
    "大丈夫の意味わかってる？",
    "間に合ってます",
    "もう導入済みです",
    "十分足りてます",
    "結構です",
    "必要ありません",
  ];
  for (const text of declines) {
    const { dialog } = fresh();
    dialog.greeting();
    const r = dialog.respond(text);
    assert.equal(
      r.utterance,
      VOICE_LINES.r5OtherScheme.text,
      `「${text}」で断りとして扱われていない: ${r.matched}`,
    );
    // ヒアリングを一方的に進めていないこと
    assert.notEqual(r.utterance, VOICE_LINES.hearingAgeCount.text);
    assert.notEqual(r.utterance, VOICE_LINES.hearingFiscalEmail.text);
    assert.notEqual(r.utterance, VOICE_LINES.schedule.text);
  }
});

test("2回連続で断られたら丁寧に終話する", () => {
  const { state, dialog } = fresh();
  dialog.greeting();
  dialog.respond("うちはもう対策してるので");
  const closed = dialog.respond("いや、間に合ってます");
  assert.equal(closed.utterance, VOICE_LINES.reject.text);
  assert.deepEqual(audioFiles(closed.segments), [`${AUDIO_BASE}reject_closing.mp3`]);
  assert.equal(state.ended, true);
});

test("「大丈夫」は日程の可否を答えている場面だけ肯定として扱う", () => {
  // 日程の場面: 肯定（アポ確定へ）
  const { state: ok, dialog: okDialog } = fresh();
  ok.phase = "P7";
  const accepted = okDialog.respond("はい、その時間なら大丈夫です");
  assert.equal(accepted.phase, "P8");
  assert.equal(ok.appointmentDate, "9月17日（水）");

  // 説明中の「大丈夫」: 断り
  const { dialog: ngDialog } = fresh();
  ngDialog.greeting();
  const declined = ngDialog.respond("いや、うちは大丈夫です");
  assert.equal(declined.utterance, VOICE_LINES.r5OtherScheme.text);
});

test("ヒアリング中(P8)の回答は断りとして扱わない", () => {
  const { state, dialog } = fresh();
  state.phase = "P7";
  dialog.respond("はい、その時間なら大丈夫です"); // → P8
  const r = dialog.respond("090-1234-5678 です。今は特にやってません");
  assert.notEqual(r.utterance, VOICE_LINES.reject.text);
  assert.equal(state.callbackPhone, "090-1234-5678");
});

// ---------- 切り返し直後の回答の拾い上げ ----------

test("R2 の切り返しで聞いた従業員数は「20名です」だけでも拾って次へ進む", () => {
  const { state, dialog } = fresh();
  dialog.greeting();
  dialog.respond("ちょっと今忙しいんだよね");

  const next = dialog.respond("20名です");
  assert.equal(state.hearing.H5, "20名");
  assert.equal(next.utterance, VOICE_LINES.hearingFiscalEmail.text);
  assert.deepEqual(audioFiles(next.segments), [`${AUDIO_BASE}p4_p5_hearin.mp3`]);
  assert.doesNotMatch(next.matched, /判定できず/);

  // そのまま日程打診まで進める
  const schedule = dialog.respond("決算は3月で、メールは info@example.co.jp です");
  assert.equal(schedule.utterance, VOICE_LINES.schedule.text);
});

test("R1 の切り返しで聞いた従業員数も同じように拾える", () => {
  const { state, dialog } = fresh();
  dialog.greeting();
  dialog.respond("うちは退職金制度、何もやってないんですよ");
  const next = dialog.respond("10人くらいですね");
  assert.equal(state.hearing.H5, "10名");
  assert.equal(next.utterance, VOICE_LINES.hearingFiscalEmail.text);
});

test("言い直しは冒頭の挨拶ではなく、直前に流した質問を基準にする", () => {
  const { dialog } = fresh();
  const greeting = dialog.greeting();
  const busy = dialog.respond("ちょっと今忙しいんだよね");
  assert.equal(busy.utterance, VOICE_LINES.r2Busy.text);

  const again = dialog.respond("えーっと、なんだっけ");
  assert.notEqual(again.utterance, greeting.utterance, "冒頭の挨拶に巻き戻っている");
  assert.ok(!audioFiles(again.segments).includes(`${AUDIO_BASE}p0_greeting.mp3`));
  assert.match(again.utterance, /従業員数/);
  assert.match(again.matched, /聞き直す/);
});

// ---------- 区間（録音 or 音声合成）の組み立て ----------

const texts = (r: DialogReply): string[] => r.segments.map((s) => s.text);

test("同じ通話で2回目に言う台本も録音で流す（合成音声に落とさない）", () => {
  const { dialog } = fresh();
  dialog.greeting();
  const first = dialog.respond("はい");
  dialog.respond("社長は外出中です");
  dialog.respond("あ、戻ってきました、代わります"); // → 保留（発話しない）
  dialog.respond("はい、社長の中村です"); // → 名乗り直し
  const again = dialog.respond("はい"); // → 代わって出た社長に概要を伝え直す
  assert.equal(first.utterance, VOICE_LINES.overview.text);
  assert.equal(again.utterance, VOICE_LINES.overview.text);
  assert.deepEqual(audioFiles(again.segments), [`${AUDIO_BASE}p1_overview.mp3`]);
});

test("P8 の聞き直しは「前置き」と「質問」を別の区間として並べ、前置きは毎回変える", () => {
  const { state, dialog } = fresh();
  state.phase = "P7";
  dialog.respond("はい、その時間で大丈夫です"); // → P8（前日確認の電話番号）
  const first = dialog.respond("えーっと");
  assert.deepEqual(texts(first), [PHRASES.reask1.text, PHRASES.askCallbackPhone.text]);
  const second = dialog.respond("うーん");
  assert.deepEqual(texts(second), [PHRASES.reask2.text, PHRASES.askCallbackPhone.text]);
});

test("「この番号でいいです」への返事とメールアドレスの質問は別の区間で続けて流す", () => {
  const { state, dialog } = fresh();
  state.phase = "P7";
  dialog.respond("はい、その時間で大丈夫です");
  const r = dialog.respond("この番号でいいです");
  assert.deepEqual(texts(r), [PHRASES.currentNumberAck.text, PHRASES.currentNumberEmail.text]);
});

test("メールアドレスの復唱は、アドレスだけを差し込み区間にして前後を固定文で挟む", () => {
  const { state, dialog } = fresh();
  applyExtracted(state, {
    H1: "なし",
    H2: "保険",
    H3: "56歳",
    H4: "2名",
    H5: "12名",
    H6: "代表の判断で決裁可能",
    H7: "3月",
    email: "nakamura@sample-kogyo.co.jp",
  });
  state.phase = "P7";
  dialog.respond("はい、その時間で大丈夫です");
  const r = dialog.respond("090-1234-5678 です");
  assert.deepEqual(texts(r), [
    PHRASES.emailConfirmPre.text,
    "nakamura@sample-kogyo.co.jp ",
    PHRASES.emailConfirmPost.text,
  ]);
  assert.equal(r.segments[1]?.audioFile, undefined, "差し込みのアドレスは音声合成で読む");
  assert.equal(r.utterance, "復唱させていただきます。nakamura@sample-kogyo.co.jp でお間違いないでしょうか？");
});

test("不在時の戻り時間は差し込み区間にし、前後の固定文と分ける", () => {
  const { dialog } = fresh();
  dialog.greeting();
  dialog.respond("担当は今不在にしてます");
  const askContact = dialog.respond("夕方には戻ります");
  assert.deepEqual(texts(askContact), [PHRASES.r7Ack.text, "夕方頃に", PHRASES.r7CallbackAskContact.text]);
  const closing = dialog.respond("090-1234-5678 です");
  assert.deepEqual(texts(closing), [PHRASES.r7Thanks.text, "夕方頃に", PHRASES.r7CallbackClosing.text]);
});
