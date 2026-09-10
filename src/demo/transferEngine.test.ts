import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectAbsence,
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

  // 2回目は食い下がらずに終話する
  const second = engine.respond("ですから、何のご用件ですか");
  assert.notEqual(second.utterance, VOICE_LINES.overview.text);
  assert.equal(second.utterance, VOICE_LINES.reject.text);
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
