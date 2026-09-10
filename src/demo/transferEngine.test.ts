import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectAbsence,
  detectContactGuard,
  detectHandover,
  TransferEngine,
  type TransferReply,
} from "./transferEngine.js";
import { VOICE_LINES } from "./dialogEngine.js";

function fresh(): { engine: TransferEngine; first: TransferReply } {
  const engine = new TransferEngine();
  return { engine, first: engine.greeting() };
}

// ---------- 取次ぎ検知 ----------

const HANDOVER_CASES = [
  "少々お待ちください",
  "少々お待ちくださいませ",
  "少しお待ちくださいね",
  "しばらくお待ちください",
  "ただいまお繋ぎいたします",
  "おつなぎします",
  "担当に代わります",
  "代わりました",
  "お電話代わりました",
  "はい、私ですが",
  "担当の田中です",
  "責任者の佐藤でございます",
  "確認してまいります",
  "確認してきます",
  "呼んでまいります",
  "代表の中村です",
];

for (const text of HANDOVER_CASES) {
  test(`タイプB 取次ぎ検知: 「${text}」で引き継ぎに移る`, () => {
    assert.ok(detectHandover(text), "取次ぎのサインとして検知されない");

    const { engine } = fresh();
    const r = engine.respond(text);
    assert.equal(r.handover, true, `引き継ぎ状態になっていない: ${r.matched}`);
    assert.equal(r.outcome, "handover");
    // 人間が話す前に AI の声が被らないよう、AI は何も喋らない
    assert.equal(r.utterance, "", "引き継ぎ時に AI が発話している");
    assert.equal(r.audioFile, undefined, "引き継ぎ時に音声を再生しようとしている");
    assert.equal(engine.finished, true);
  });
}

test("タイプB 取次ぎ検知: 通常の応答では引き継がない", () => {
  for (const text of ["はい、山田商事です", "どういったご用件でしょうか", "結構です"]) {
    assert.ok(!detectHandover(text), `誤って取次ぎと判定している: ${text}`);
  }
});

// ---------- 用件確認 ----------

test("タイプB: 用件を問われたら1回だけ説明する", () => {
  const { engine } = fresh();
  const first = engine.respond("どういったご用件でしょうか？");
  assert.equal(first.utterance, VOICE_LINES.overview.text);
  assert.equal(first.outcome, "calling");
  assert.equal(engine.finished, false);

  // 2回目は勝手に終話せず、内容を一言で示して取次ぎを促し直す
  const second = engine.respond("どんな確認ですか？");
  assert.notEqual(second.utterance, VOICE_LINES.overview.text);
  assert.notEqual(second.utterance, VOICE_LINES.reject.text);
  assert.match(second.utterance, /制度導入状況/);
  assert.match(second.utterance, /お繋ぎいただけ/);
  assert.equal(engine.finished, false);

  // それでも取次ぎに至らなければ、粘らずに終話する
  const third = engine.respond("具体的な内容は何ですか");
  assert.equal(third.utterance, VOICE_LINES.reject.text);
  assert.equal(engine.finished, true);
});

test("タイプB: 用件説明のあとに取次いでもらえたら引き継ぐ", () => {
  const { engine } = fresh();
  engine.respond("ご用件は何でしょうか");
  const r = engine.respond("少々お待ちください");
  assert.equal(r.handover, true);
  assert.equal(engine.result, "handover");
});

// ---------- 不在・営業お断り ----------

const ABSENT_CASES = ["今不在にしてます", "席を外しております", "出張中です", "本日は休みです"];

for (const text of ABSENT_CASES) {
  test(`タイプB 不在: 「${text}」は引き延ばさず記録して終話する`, () => {
    assert.ok(detectAbsence(text), "不在として検知されない");
    const { engine } = fresh();
    const r = engine.respond(text);
    assert.equal(r.outcome, "absent");
    assert.equal(r.utterance, VOICE_LINES.reject.text);
    assert.equal(r.audioFile, "public/audio/reject_closing.mp3");
    assert.equal(engine.finished, true);
    assert.equal(engine.absenceRecord?.said, text);
  });
}

test("タイプB 不在: 戻り時間が言われていれば記録に残す", () => {
  const { engine } = fresh();
  engine.respond("担当は外出しておりまして、戻りは夕方になります");
  assert.equal(engine.absenceRecord?.returnTime, "夕方");
});

test("タイプB: 営業お断りは即座に終話する", () => {
  const { engine } = fresh();
  const r = engine.respond("営業のお電話はお断りしております");
  assert.equal(r.outcome, "rejected");
  assert.equal(r.utterance, VOICE_LINES.reject.text);
  assert.equal(engine.finished, true);
});

// ---------- 進行 ----------

test("タイプB: 第一声は取次ぎ依頼で、録音が紐づく", () => {
  const { first } = fresh();
  assert.equal(first.utterance, VOICE_LINES.greeting.text);
  assert.equal(first.audioFile, "public/audio/p0_greeting.mp3");
  assert.equal(first.outcome, "calling");
});

test("タイプB: 取次ぎに至らなければ言い直しは1回だけで終話する", () => {
  const { engine } = fresh();
  const again = engine.respond("うーん");
  assert.equal(again.utterance, VOICE_LINES.greeting.text);
  assert.equal(engine.finished, false);

  const closed = engine.respond("......");
  assert.equal(closed.utterance, VOICE_LINES.reject.text);
  assert.equal(engine.finished, true);
});

test("タイプB: 応答は必ず禁止ワードフィルタを通る", () => {
  const { engine } = fresh();
  for (const text of ["ご用件は？", "少々お待ちください"]) {
    const r = engine.respond(text);
    assert.deepEqual(r.blocked, []);
  }
});

// ---------- 担当不明 ----------

const UNKNOWN_CONTACT_CASES = [
  "担当が誰かわからないんですが",
  "担当者が分かりません",
  "どこの部署でしょうか",
  "どちらの部署におつなぎすれば？",
  "誰に繋げばいいですか",
  "担当部署が分からないのですが",
  "どなたにお伝えすればよいですか",
  "担当窓口はどこになりますか",
];

for (const text of UNKNOWN_CONTACT_CASES) {
  test(`タイプB 担当不明: 「${text}」に具体的な部署・役職を挙げて再依頼する`, () => {
    const { engine, first } = fresh();
    const r = engine.respond(text);

    // 冒頭の挨拶をオウム返ししない
    assert.notEqual(r.utterance, first.utterance, "冒頭の挨拶を繰り返している");
    assert.notEqual(r.utterance, VOICE_LINES.greeting.text);
    // 具体的な取次ぎ先を挙げる
    assert.match(r.utterance, /総務/);
    assert.match(r.utterance, /人事/);
    assert.match(r.utterance, /代表者/);
    assert.match(r.utterance, /お繋ぎいただけ/);
    assert.equal(engine.finished, false, "終話してしまっている");
  });
}

test("タイプB 担当不明: 部署提示のあとに取次いでもらえたら引き継ぐ", () => {
  const { engine } = fresh();
  engine.respond("担当が誰かわからないんですが");
  const r = engine.respond("では社長に代わりますね");
  assert.equal(r.handover, true);
});

test("タイプB 担当不明: 部署を挙げても決まらなければ粘らず終話する", () => {
  const { engine } = fresh();
  engine.respond("担当が誰かわからないんですが");
  const closed = engine.respond("うーん、誰に繋げばいいのか…");
  assert.equal(closed.utterance, VOICE_LINES.reject.text);
  assert.equal(engine.finished, true);
});

// ---------- 本人応答 ----------

const SELF_IDENTIFY_CASES = [
  "私です",
  "私ですが",
  "はい、私ですけど",
  "自分が担当です",
  "私が担当です",
  "私でお伺いします",
  "僕です",
  "当方です",
  "担当ですが",
  "担当です",
];

for (const text of SELF_IDENTIFY_CASES) {
  test(`タイプB 本人応答: 「${text}」を接続成功として引き継ぐ`, () => {
    assert.ok(detectHandover(text), "取次ぎ成功として検知されない");
    const { engine } = fresh();
    const r = engine.respond(text);
    assert.equal(r.handover, true, `引き継ぎ状態になっていない: ${r.matched}`);
    assert.equal(r.outcome, "handover");
    assert.equal(r.utterance, "", "引き継ぎ時に AI が発話している");
    assert.equal(r.audioFile, undefined, "引き継ぎ時に音声を再生しようとしている");
  });
}

test("タイプB 本人応答: 「私では分かりません」は引き継ぎにしない", () => {
  assert.ok(!detectHandover("私では分かりません"), "決裁権なしを接続成功と誤判定している");
  assert.ok(!detectHandover("担当ではありません"), "担当外を接続成功と誤判定している");
});

// ---------- 担当者名の確認 ----------

const NAME_ASK_CASES = [
  "担当者のお名前はお分かりでしょうか",
  "お名前はお分かりですか",
  "担当者様のお名前を教えていただけますか",
  "誰宛てになりますか",
];

for (const text of NAME_ASK_CASES) {
  test(`タイプB 担当者名: 「${text}」に概要説明を流さず部署・役職で返す`, () => {
    const { engine, first } = fresh();
    const r = engine.respond(text);

    assert.notEqual(r.utterance, VOICE_LINES.overview.text, `概要説明に流れている: ${r.matched}`);
    assert.notEqual(r.utterance, first.utterance, "冒頭の挨拶を繰り返している");
    assert.match(r.utterance, /特定のお名前ではなく/);
    assert.match(r.utterance, /(人事|総務)/);
    assert.match(r.utterance, /代表者様/);
    assert.equal(engine.finished, false);
  });
}

test("タイプB 担当者名: 提示のあとに本人が出たら引き継ぐ", () => {
  const { engine } = fresh();
  engine.respond("担当者のお名前はお分かりでしょうか");
  const r = engine.respond("あ、私が担当ですが");
  assert.equal(r.handover, true);
});

// ---------- 助詞なし・スペース区切り ----------

const LOOSE_NAME_CASES = [
  "担当者名 お分かりでしょうか",
  "担当者名お分かりですか",
  "担当者名は",
  "名前わかりますか",
  "お名前 教えてください",
  "担当者わかりません",
  "担当 誰",
  "誰か分かりますか",
  "部署 分かりますか",
];

for (const text of LOOSE_NAME_CASES) {
  test(`タイプB 受付ガード(助詞なし): 「${text}」で挨拶を繰り返さない`, () => {
    assert.ok(detectContactGuard(text), "担当名確認として検知されない");

    const { engine, first } = fresh();
    const r = engine.respond(text);
    assert.notEqual(r.utterance, first.utterance, `挨拶を繰り返している: ${r.matched}`);
    assert.notEqual(r.utterance, VOICE_LINES.greeting.text);
    assert.notEqual(r.utterance, VOICE_LINES.overview.text, `概要説明に流れている: ${r.matched}`);
    assert.doesNotMatch(r.matched, /取次ぎに至らず/, `取次ぎ失敗として扱っている: ${r.matched}`);
    assert.match(r.utterance, /(人事|総務)/);
    assert.match(r.utterance, /代表者様/);
    assert.equal(engine.finished, false);
  });
}

test("タイプB 受付ガード: 担当者名を聞かれた場合は「特定のお名前ではなく」と返す", () => {
  const { engine } = fresh();
  const r = engine.respond("担当者名 お分かりでしょうか");
  assert.match(r.utterance, /特定のお名前ではなく/);
});
