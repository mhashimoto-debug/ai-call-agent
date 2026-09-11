/**
 * デモ前検証スイート（タイプA / タイプB）。
 *
 * デモで相手役が実際に言いそうな受け答えを1通話ずつ通しで流し、
 * 画面の応答・再生する録音・到達状態が崩れないことを確認する。
 * 対象シナリオ: 正常突破 / 担当名ガード / HP参照 / 本人応答 / 不在 / 重ねての質問 / 断り
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CURRENT_NUMBER_LABEL, DialogEngine, type DialogReply } from "./dialogEngine.js";
import { AUDIO_BASE, PHRASES, VOICE_LINES, audioFiles, type SpeechSegment } from "./voiceLines.js";
import { TransferEngine, type TransferReply } from "./transferEngine.js";
import { createCallState, type CallState } from "../domain/state.js";
import { evaluateDod } from "../domain/dod.js";

const AUDIO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/audio");

/** 応答が参照している録音が、配信物（public/audio/）に実在すること。 */
function assertAudioExists(segments: readonly SpeechSegment[], label: string): void {
  for (const audioFile of audioFiles(segments)) {
    assert.ok(audioFile.startsWith(AUDIO_BASE), `${label}: 録音のパスが想定外: ${audioFile}`);
    assert.ok(
      fs.existsSync(path.join(AUDIO_DIR, path.basename(audioFile))),
      `${label}: 録音ファイルが存在しない: ${audioFile}`,
    );
  }
}

// ============================================================
// タイプA（アポ獲得）
// ============================================================

/** タイプA の1通話。 */
class CallA {
  readonly state: CallState = createCallState();
  readonly replies: DialogReply[] = [];
  private engine = new DialogEngine(this.state);

  constructor() {
    this.replies.push(this.engine.greeting());
  }

  say(text: string): DialogReply {
    const r = this.engine.respond(text);
    this.replies.push(r);
    return r;
  }
}

/**
 * 挨拶への巻き戻り・判定失敗・同じ応答の連続が無く、録音がすべて揃っていること。
 * 保留中の無言（holding）は発話に数えない。
 */
function assertHealthyA(call: CallA, label: string): void {
  let previous: string | undefined;
  call.replies.forEach((r, i) => {
    if (r.holding) {
      assert.equal(r.utterance, "", `${label}: ${i}ターン目の保留中に発話している`);
      assert.deepEqual(r.segments, [], `${label}: ${i}ターン目の保留中に音声を再生しようとしている`);
      return;
    }
    assert.ok(r.utterance.length > 0, `${label}: ${i}ターン目の発話が空`);
    assertAudioExists(r.segments, `${label}: ${i}ターン目`);
    assert.equal(
      r.segments.map((s) => s.text).join(""),
      r.utterance,
      `${label}: ${i}ターン目で再生する区間と表示テキストが食い違う`,
    );
    if (i > 0) {
      assert.notEqual(r.utterance, VOICE_LINES.greeting.text, `${label}: ${i}ターン目で冒頭の挨拶に巻き戻っている`);
      assert.doesNotMatch(r.matched, /判定できず|読み取れず/, `${label}: ${i}ターン目で判定に失敗（${r.matched}）`);
      assert.notEqual(r.utterance, previous, `${label}: ${i}ターン目で同じ応答を続けている`);
    }
    previous = r.utterance;
  });
}

/**
 * 受付の取次ぎ（保留 → 担当者が応答 → 名乗り直し → 概要）を経て、年齢層・人数を尋ねるまで。
 * 期待する応答が空文字のターンは「発話せずに待つ」。
 */
const HANDOFF_TURNS: [string, string][] = [
  ["少々お待ちください、代わります", ""],
  ["はい、代表の中村です", PHRASES.handoffReintro.text],
  ["はい、どういったお話でしょう", VOICE_LINES.overview.text],
  // 相槌は回答ではないので「ご回答ありがとうございます」ではなく「恐れ入ります、」から人数を伺う
  ["なるほど、そうなんですね", PHRASES.recapHearingAgeCount.text],
];

/** 受付の取次ぎを経て、担当者に年齢層・人数を尋ねるところまで進める。 */
function passReception(call: CallA): void {
  for (const [text, expected] of HANDOFF_TURNS) {
    const r = call.say(text);
    assert.equal(r.utterance, expected, `取次ぎ「${text}」への応答が違う: ${r.matched}`);
  }
}

// ---------- A-1. 正常突破 → アポ確定 ----------

/** 受付突破のしかた（取次ぎ／本人応答）ごとに、最後まで通るかを見る。 */
const A_OPENINGS: { label: string; opening: [string, string][] }[] = [
  { label: "取次ぎ", opening: HANDOFF_TURNS },
  {
    label: "本人応答",
    opening: [
      ["私です", VOICE_LINES.overview.text],
      ["はい、聞いてますよ", PHRASES.recapHearingAgeCount.text],
    ],
  },
];

for (const { label, opening } of A_OPENINGS) {
  test(`デモA 正常突破(${label}): 締め(P9)まで通り、DoD が全項目○になる`, () => {
    const call = new CallA();
    const steps: [string, string | RegExp][] = [
      ...opening,
      ["50代で、役員2名と社員18名の20人です", VOICE_LINES.hearingFiscalEmail.text],
      ["決算は3月で、メールは nakamura@example.co.jp です", VOICE_LINES.schedule.text],
      ["はい、その時間なら大丈夫です", VOICE_LINES.contact.text],
      // 連絡先の確認から詳細ヒアリングへ移るときは、前置きを挟んでから H1 を聞く
      ["090-1234-5678 です", /念のため確認させてください。現在 iDeCo/],
      // 「特にやっていません」は制度なし(R1)の言い回しでもあるが、P8 では質問への回答として受け取る
      ["いえ、特にやっていません", /退職金制度/],
      ["特にないです", /ご判断で決められますか/],
      // メールアドレスは復唱せず（録音だけで通話する）、前日連絡の時間帯へ進む
      ["はい、私が決めます", /何時頃が繋がりやすい/],
      ["午前中なら繋がります", /カレンダー/],
      ["はい、入れておきます", VOICE_LINES.closing.text],
    ];
    for (const [text, expected] of steps) {
      const r = call.say(text);
      if (typeof expected === "string") {
        assert.equal(r.utterance, expected, `「${text}」への応答が違う: ${r.matched}`);
      } else {
        assert.match(r.utterance, expected, `「${text}」への応答が違う: ${r.matched}`);
      }
    }
    assert.equal(call.state.phase, "P9");
    const dod = evaluateDod(call.state);
    assert.ok(
      dod.passed,
      `DoD 未達: ${dod.items.filter((i) => !i.ok).map((i) => `${i.label}(${i.detail})`).join(", ")}`,
    );
    assertHealthyA(call, `正常突破(${label})`);
  });
}

test("デモA 正常突破: P8 で「制度はない」と答えても従業員数の聞き直しに戻らない", () => {
  const call = new CallA();
  passReception(call);
  call.say("50代で、役員2名と社員18名の20人です");
  call.say("決算は3月で、メールは nakamura@example.co.jp です");
  call.say("はい、その時間なら大丈夫です");
  call.say("090-1234-5678 です"); // → 前置き＋H1（iDeCo・投資）
  for (const text of ["特にやっていません", "何もしてないです", "退職金制度はないです"]) {
    const r = call.say(text);
    assert.notEqual(r.utterance, VOICE_LINES.r1NoSystem.text, `P8 で R1 の切り返しを流している: ${r.matched}`);
    assert.doesNotMatch(r.utterance, /従業員数/, `取得済みの従業員数を聞き直している: ${r.matched}`);
    assert.equal(r.phase, "P8");
  }
  assert.equal(call.state.hearing.H1, "iDeCo・投資ともになし");
  assert.ok(call.state.hearing.H2, "H2（既存の退職金制度）が取れていない");
});

// ---------- A-2. 担当名ガード ----------

for (const text of ["担当者のお名前はお分かりでしょうか", "担当者名 お分かりでしょうか", "誰に繋げばいいですか"]) {
  test(`デモA 担当名ガード: 「${text}」→ 部署・役職で返し、取次ぎ後は名乗り直してから概要説明へ進む`, () => {
    const call = new CallA();
    const guard = call.say(text);
    assert.match(guard.utterance, /特定の個人名ではなく/);
    assert.match(guard.utterance, /(人事|総務)/);
    assert.match(guard.utterance, /代表者様/);
    assert.equal(guard.phase, "P0", "取次ぎ前にフェーズが進んでいる");

    const hold = call.say("では社長に代わりますね");
    assert.equal(hold.holding, true, `取次ぎの保留中に発話している: ${hold.matched}`);
    assert.equal(call.say("はい、社長の中村です").utterance, PHRASES.handoffReintro.text);
    const overview = call.say("はい、どういったお話でしょう");
    assert.equal(overview.utterance, VOICE_LINES.overview.text, `名乗り直しの後に概要へ進まない: ${overview.matched}`);
    assert.deepEqual(audioFiles(overview.segments), [`${AUDIO_BASE}p1_overview.mp3`]);
    assert.equal(call.say("なるほど").utterance, PHRASES.recapHearingAgeCount.text);
    assertHealthyA(call, `担当名ガード「${text}」`);
  });
}

test("デモA 担当名ガード: 部署を示しても決まらなければ粘らず終話する", () => {
  const call = new CallA();
  call.say("担当者のお名前はお分かりでしょうか");
  const closed = call.say("いや、誰に繋げばいいか分からないですね");
  assert.equal(closed.utterance, VOICE_LINES.reject.text);
  assert.equal(call.state.ended, true);
});

// ---------- A-3. HP参照 ----------

test("デモA HP参照: ヒアリング中に言われたらオンライン打診へ切り替え、承諾で連絡先確認(P8)へ進む", () => {
  const call = new CallA();
  passReception(call);
  call.say("50代で20人です");
  const pitch = call.say("ホームページに載ってるので見てください");
  assert.match(pitch.utterance, /サイトより確認/);
  assert.doesNotMatch(pitch.utterance, /メールアドレス/, "送付先を催促している");
  assert.equal(pitch.phase, "P7");

  const ok = call.say("まあ、15分くらいならいいですよ");
  assert.equal(ok.utterance, VOICE_LINES.contact.text, `承諾が日程確定にならない: ${ok.matched}`);
  assert.equal(ok.phase, "P8");
  assertHealthyA(call, "HP参照(ヒアリング中)");
});

test("デモA HP参照: 受付で言われて打診を承諾されたら、断りと取り違えず会話を続ける", () => {
  const call = new CallA();
  const pitch = call.say("ホームページを見てください");
  assert.match(pitch.utterance, /サイトより確認/);
  assert.doesNotMatch(pitch.utterance, /メールアドレス/);

  const next = call.say("はい、それなら大丈夫です");
  assert.notEqual(next.utterance, VOICE_LINES.reject.text, `承諾を断りと取り違えて終話している: ${next.matched}`);
  assert.equal(call.state.ended, false);
  assert.equal(next.utterance, VOICE_LINES.overview.text);
  assertHealthyA(call, "HP参照(受付)");
});

test("デモA HP参照: 打診のあとに断られたら粘らず終話する", () => {
  const call = new CallA();
  call.say("ホームページを見てください");
  const closed = call.say("いえ、結構です");
  assert.equal(closed.utterance, VOICE_LINES.reject.text);
  assert.equal(call.state.ended, true);
});

test("デモA HP参照: 2回続けて言われたら丁寧に終話する", () => {
  const call = new CallA();
  passReception(call);
  call.say("50代で20人です");
  call.say("ホームページに載ってるので見てください");
  const closed = call.say("それもホームページに載ってます");
  assert.equal(closed.utterance, VOICE_LINES.reject.text);
  assert.equal(call.state.ended, true);
});

// ---------- A-4. 本人応答 ----------

/** 本人が電話口に出た合図。音声認識の区切り・かな表記の揺れも含める。 */
const SELF_IDENTIFY_PHRASES: string[] = [
  "私です",
  "私ですが",
  "自分が担当です",
  "僕です",
  "私 です",
  "私、ですが",
  "僕 です",
  "ぼくです",
  "ワタシです",
  "わたくしでございます",
  "私がそうです",
  "自分 が 担当です",
];

for (const text of SELF_IDENTIFY_PHRASES) {
  test(`デモA 本人応答: 「${text}」→ 受付突破として概要説明(P1)へ進む`, () => {
    const call = new CallA();
    const r = call.say(text);
    assert.equal(r.utterance, VOICE_LINES.overview.text, `概要説明へ進んでいない: ${r.matched}`);
    assert.deepEqual(audioFiles(r.segments), [`${AUDIO_BASE}p1_overview.mp3`]);
    assert.equal(r.phase, "P1");
    assert.match(r.matched, /本人が応答/);
    assertHealthyA(call, `本人応答「${text}」`);
  });
}

test("デモA 本人応答: 「私では分かりません」は本人応答ではなく決裁権なし(R7)", () => {
  const call = new CallA();
  const r = call.say("私では分かりません");
  assert.equal(r.utterance, VOICE_LINES.r7Absent.text);
});

// ---------- A-5. 不在 ----------

test("デモA 不在: 戻り時間と折り返し先を確保し、折り返しを約束して終話する", () => {
  const call = new CallA();
  assert.equal(call.say("担当は今不在にしてます").utterance, VOICE_LINES.r7Absent.text);
  assert.match(call.say("夕方には戻ります").utterance, /お電話番号かメールアドレス/);
  const closed = call.say("090-1234-5678 です");
  assert.match(closed.utterance, /夕方頃に改めてお電話/);
  assert.equal(call.state.callbackWindow, "夕方");
  assert.equal(call.state.callbackPhone, "090-1234-5678");
  assert.equal(call.state.ended, true);
  assertHealthyA(call, "不在");
});

// ---------- A-6. 重ねての質問 ----------

const A_REPEATED_QUESTIONS: [string, string][] = [
  ["どういったご用件でしょうか", "具体的にはどういう内容ですか"],
  ["どちら様ですか", "どちら様ですか"],
];

for (const [first, second] of A_REPEATED_QUESTIONS) {
  test(`デモA 重ねての質問: 「${first}」→「${second}」で巻き戻り・同じ説明の繰り返し・終話が起きない`, () => {
    const call = new CallA();
    assert.equal(call.say(first).utterance, VOICE_LINES.overview.text);
    const again = call.say(second);
    assert.notEqual(again.utterance, VOICE_LINES.overview.text, "概要説明をそのまま繰り返している");
    assert.equal(call.state.ended, false, "重ねて聞かれただけで終話している");
    assertHealthyA(call, `重ねての質問「${first}」→「${second}」`);
  });
}

// ---------- A-7. 断り ----------

test("デモA 断り: 1回目は別枠の制度であることを伝え、2回目で丁寧に終話する", () => {
  const call = new CallA();
  assert.equal(call.say("うちはもう対策してるので").utterance, VOICE_LINES.r5OtherScheme.text);
  const closed = call.say("いや、間に合ってます");
  assert.equal(closed.utterance, VOICE_LINES.reject.text);
  assert.deepEqual(audioFiles(closed.segments), [`${AUDIO_BASE}reject_closing.mp3`]);
  assert.equal(call.state.ended, true);
});

test("デモA 断り: 受付の営業電話ブロックは食い下がらず撤退する", () => {
  const call = new CallA();
  const r = call.say("営業電話はお断りしております");
  assert.equal(r.utterance, VOICE_LINES.reject.text);
  assert.equal(r.phase, "P0X");
  assert.equal(call.state.ended, true);
});

// ---------- A-8. P8 連絡先: 発信番号の指定（「この番号でいいです」） ----------

/** 連絡先の確認（p8_recovery.mp3）まで進めた通話。 */
function callAtContact(opts: { withEmail: boolean }): CallA {
  const call = new CallA();
  passReception(call);
  call.say("50代で、役員2名と社員18名の20人です");
  call.say(opts.withEmail ? "決算は3月で、メールは nakamura@example.co.jp です" : "決算は3月です");
  assert.equal(call.say("はい、その時間なら大丈夫です").utterance, VOICE_LINES.contact.text);
  return call;
}

const CURRENT_NUMBER_ACK = "承知いたしました！ではこちらの番号宛にご連絡を差し上げますね。";

const CURRENT_NUMBER_PHRASES: string[] = [
  "この番号でいいです",
  "今かけてもらってるこの番号です",
  "こちらの番号で大丈夫です",
  "この電話で大丈夫です",
  "今かかってる番号でお願いします",
  "この番号に折り返してください",
  "この番号にかけ直してください",
  "表示されてる番号でいいですよ",
  "発信の番号で",
];

for (const text of CURRENT_NUMBER_PHRASES) {
  test(`デモA P8 発信番号: 「${text}」→ 再質問せず、この番号で確定して次の確認へ進む`, () => {
    const call = callAtContact({ withEmail: true });
    const r = call.say(text);
    assert.doesNotMatch(r.matched, /聞き取れず/, `電話番号を再催促している: ${r.matched}`);
    assert.notEqual(r.utterance, VOICE_LINES.r2Busy.text, `多忙(R2)と取り違えている: ${r.matched}`);
    assert.ok(r.utterance.startsWith(CURRENT_NUMBER_ACK), `受け止めの一言が無い: ${r.utterance}`);
    assert.equal(call.state.isCurrentNumber, true);
    assert.equal(call.state.callbackPhone, CURRENT_NUMBER_LABEL);
    assert.equal(r.phase, "P8");
    assertHealthyA(call, `発信番号「${text}」`);
  });
}

test("P8で「今かけてもらってるこの番号です」と言われた場合、再質問せず発信番号確定で次へ進む", () => {
  const call = callAtContact({ withEmail: true });
  const r = call.say("今かけてもらってるこの番号です");
  assert.doesNotMatch(r.matched, /callbackPhone が聞き取れず/);
  assert.equal(call.state.isCurrentNumber, true);
  assert.equal(call.state.callbackPhone, CURRENT_NUMBER_LABEL);
  // メールアドレスは取得済みなので、受け止めてから前置きを挟んで未取得のヒアリングへ進む
  assert.equal(r.utterance, `${CURRENT_NUMBER_ACK}${PHRASES.reask3.text}${PHRASES.askH1.text}`);

  // 残りの確認を済ませれば締め(P9)まで進み、DoD も満たす
  const steps: [string, string | RegExp][] = [
    ["いえ、特にやっていません", /退職金制度/],
    ["特にないです", /ご判断で決められますか/],
    ["はい、私が決めます", /何時頃が繋がりやすい/],
    ["午前中なら繋がります", /カレンダー/],
    ["はい、入れておきます", VOICE_LINES.closing.text],
  ];
  for (const [text, expected] of steps) {
    const next = call.say(text);
    if (typeof expected === "string") assert.equal(next.utterance, expected, `「${text}」: ${next.matched}`);
    else assert.match(next.utterance, expected, `「${text}」: ${next.matched}`);
  }
  assert.equal(call.state.phase, "P9");
  assert.ok(evaluateDod(call.state).passed, "DoD を満たしていない");
  assertHealthyA(call, "発信番号→締め");
});

test("デモA P8 発信番号: メールアドレス未取得なら、続けて送付先メールアドレスを伺う", () => {
  const call = callAtContact({ withEmail: false });
  const r = call.say("この番号でいいです");
  assert.equal(
    r.utterance,
    `${CURRENT_NUMBER_ACK}差し支えなければ送付先のメールアドレスもお伺いできますでしょうか？`,
  );
  assert.equal(call.state.isCurrentNumber, true);

  const next = call.say("nakamura@example.co.jp です");
  assert.equal(call.state.email, "nakamura@example.co.jp");
  assert.match(next.utterance, /iDeCo/, `メールアドレスの次の確認へ進んでいない: ${next.matched}`);
  assertHealthyA(call, "発信番号→メールアドレス");
});

test("デモA P8 発信番号: 「この番号じゃなくて携帯に」は発信番号として確定しない", () => {
  const call = callAtContact({ withEmail: true });
  call.say("この番号じゃなくて携帯にお願いします");
  assert.equal(call.state.isCurrentNumber, false);
  assert.equal(call.state.callbackPhone, null);

  const r = call.say("090-1234-5678 です");
  assert.equal(call.state.callbackPhone, "090-1234-5678");
  assert.match(r.utterance, /iDeCo/);
});

test("デモA P8: 番号に「折り返して」と添えられても多忙(R2)と取り違えない", () => {
  const call = callAtContact({ withEmail: true });
  const r = call.say("090-1234-5678 に折り返してください");
  assert.notEqual(r.utterance, VOICE_LINES.r2Busy.text, `多忙(R2)と取り違えている: ${r.matched}`);
  assert.equal(call.state.callbackPhone, "090-1234-5678");
  assert.equal(call.state.isCurrentNumber, false);
  assert.match(r.utterance, /iDeCo/);
});

test("デモA 不在: 「この番号に折り返してください」は発信番号で確定し、戻り時間を伺って終話する", () => {
  const call = new CallA();
  call.say("担当は今不在にしてます");
  const r = call.say("この番号に折り返してください");
  assert.notEqual(r.utterance, VOICE_LINES.r2Busy.text, `多忙(R2)と取り違えている: ${r.matched}`);
  assert.equal(call.state.isCurrentNumber, true);
  assert.match(r.utterance, /何時頃/);

  const closed = call.say("夕方には戻ります");
  assert.match(closed.utterance, /夕方頃に改めてお電話/);
  assert.equal(call.state.ended, true);
  assertHealthyA(call, "不在→発信番号");
});

// ============================================================
// タイプB（受付突破・人間引き継ぎ）
// ============================================================

/** タイプB の1通話。 */
class CallB {
  readonly engine = new TransferEngine();
  readonly replies: TransferReply[] = [];

  constructor() {
    this.replies.push(this.engine.greeting());
  }

  say(text: string): TransferReply {
    const r = this.engine.respond(text);
    this.replies.push(r);
    assertAudioExists(r.segments, `タイプB「${text}」`);
    return r;
  }
}

/** 人間へ引き継いだこと（AI は喋らず、音声も再生しない）。 */
function assertHandover(call: CallB, r: TransferReply, label: string): void {
  assert.equal(r.handover, true, `${label}: 引き継ぎになっていない（${r.matched}）`);
  assert.equal(r.outcome, "handover");
  assert.equal(r.utterance, "", `${label}: 引き継ぎ時に AI が発話している`);
  assert.deepEqual(r.segments, [], `${label}: 引き継ぎ時に音声を再生しようとしている`);
  assert.equal(call.engine.finished, true);
}

// ---------- B-1. 正常突破 ----------

for (const text of ["少々お待ちください", "担当に代わります", "お電話代わりました", "代表の中村です"]) {
  test(`デモB 正常突破: 「${text}」で人間へ引き継ぐ`, () => {
    const call = new CallB();
    assert.deepEqual(audioFiles(call.replies[0]?.segments ?? []), [`${AUDIO_BASE}p0_greeting.mp3`]);
    assertHandover(call, call.say(text), `正常突破「${text}」`);
  });
}

test("デモB 正常突破: 用件を1回説明したあとの取次ぎも引き継ぐ", () => {
  const call = new CallB();
  assert.equal(call.say("ご用件は何でしょうか").utterance, VOICE_LINES.overview.text);
  assertHandover(call, call.say("少々お待ちください"), "用件説明→取次ぎ");
});

// ---------- B-2. 担当名ガード ----------

for (const text of ["担当者のお名前はお分かりでしょうか", "担当者名 お分かりでしょうか", "名前わかりますか"]) {
  test(`デモB 担当名ガード: 「${text}」→ 部署・役職で返し、取次ぎ後は引き継ぐ`, () => {
    const call = new CallB();
    const guard = call.say(text);
    assert.match(guard.utterance, /特定のお名前ではなく/);
    assert.match(guard.utterance, /(人事|総務)/);
    assert.match(guard.utterance, /代表者様/);
    assert.notEqual(guard.utterance, VOICE_LINES.greeting.text, "冒頭の挨拶を繰り返している");
    assert.equal(call.engine.finished, false);
    assertHandover(call, call.say("では社長に代わりますね"), `担当名ガード「${text}」→取次ぎ`);
  });
}

test("デモB 担当名ガード: 部署を示しても決まらなければ粘らず終話する", () => {
  const call = new CallB();
  call.say("担当が誰かわからないんですが");
  const closed = call.say("うーん、誰に繋げばいいのか…");
  assert.equal(closed.utterance, VOICE_LINES.reject.text);
  assert.equal(call.engine.result, "rejected");
});

// ---------- B-3. HP参照 ----------

test("デモB HP参照: 引き継がず、取次ぎ依頼の言い直しは1回までで粘らず終話する", () => {
  const call = new CallB();
  const first = call.say("ホームページに載ってるので見てください");
  assert.equal(first.handover, false, "HP参照を取次ぎと誤判定している");
  assert.notEqual(first.utterance, VOICE_LINES.overview.text, "頼まれていない用件説明を流している");
  assert.equal(call.engine.finished, false);

  const closed = call.say("ホームページからお問い合わせください");
  assert.equal(closed.utterance, VOICE_LINES.reject.text);
  assert.equal(call.engine.result, "rejected");
});

// ---------- B-4. 本人応答 ----------

for (const text of SELF_IDENTIFY_PHRASES) {
  test(`デモB 本人応答: 「${text}」→ 接続成功として人間へ引き継ぐ`, () => {
    const call = new CallB();
    assertHandover(call, call.say(text), `本人応答「${text}」`);
  });
}

test("デモB 本人応答: 「私では分かりません」「担当ではありません」は引き継がない", () => {
  for (const text of ["私では分かりません", "担当ではありません"]) {
    const call = new CallB();
    assert.equal(call.say(text).handover, false, `接続成功と誤判定している: ${text}`);
  }
});

// ---------- B-5. 不在 ----------

test("デモB 不在: 戻り時間を記録して引き延ばさず終話する", () => {
  const call = new CallB();
  const text = "担当は外出しておりまして、戻りは夕方になります";
  const r = call.say(text);
  assert.equal(r.outcome, "absent");
  assert.equal(r.utterance, VOICE_LINES.reject.text);
  assert.deepEqual(audioFiles(r.segments), [`${AUDIO_BASE}reject_closing.mp3`]);
  assert.deepEqual(call.engine.absenceRecord, { said: text, returnTime: "夕方" });
});

// ---------- B-6. 重ねての質問 ----------

test("デモB 重ねての質問: 1回目は概要、2回目は一言で再依頼、3回目で粘らず終話する", () => {
  const call = new CallB();
  assert.equal(call.say("どういったご用件でしょうか？").utterance, VOICE_LINES.overview.text);

  const second = call.say("どんな確認ですか？");
  assert.notEqual(second.utterance, VOICE_LINES.overview.text, "概要説明をそのまま繰り返している");
  assert.match(second.utterance, /制度導入状況/);
  assert.match(second.utterance, /お繋ぎいただけ/);
  assert.equal(call.engine.finished, false);

  const third = call.say("具体的な内容は何ですか");
  assert.equal(third.utterance, VOICE_LINES.reject.text);
  assert.equal(call.engine.result, "rejected");
});

test("デモB 重ねての質問: 2回目の説明のあとに取次がれたら引き継ぐ", () => {
  const call = new CallB();
  call.say("どういったご用件でしょうか？");
  call.say("どんな確認ですか？");
  assertHandover(call, call.say("承知しました、少々お待ちください"), "重ねての質問→取次ぎ");
});

// ---------- B-7. 断り ----------

for (const text of ["営業のお電話はお断りしております", "間に合ってます"]) {
  test(`デモB 断り: 「${text}」は食い下がらず即終話する`, () => {
    const call = new CallB();
    const r = call.say(text);
    assert.equal(r.outcome, "rejected");
    assert.equal(r.utterance, VOICE_LINES.reject.text);
    assert.equal(call.engine.finished, true);
  });
}

test("デモB 断り: 「結構です」が続けば、言い直しは1回までで終話する", () => {
  const call = new CallB();
  call.say("結構です");
  const closed = call.say("結構です");
  assert.equal(closed.utterance, VOICE_LINES.reject.text);
  assert.equal(call.engine.result, "rejected");
});
