import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreVoice, speechText, splitForSpeech } from "./speech.js";

const voice = (name: string, localService = true, isDefault = false) =>
  ({ name, lang: "ja-JP", localService, default: isDefault }) as SpeechSynthesisVoice;

test("曜日の括弧は「水曜日」に展開する", () => {
  assert.equal(
    speechText("では9月17日（水）14時から30分でいかがでしょうか？"),
    "では9月17日水曜日、14時から30分でいかがでしょうか？",
  );
});

test("操作メモ以外の括弧書きは読み上げない", () => {
  assert.equal(
    speechText("全額会社の経費（損金）で資産形成ができます。"),
    "全額会社の経費で資産形成ができます。",
  );
});

test("メールアドレスは記号を読み下す", () => {
  const out = speechText("nakamura@sample-kogyo.co.jp でお間違いないでしょうか？");
  assert.match(out, /アットマーク/);
  assert.match(out, /ドット/);
  assert.match(out, /ハイフン/);
  assert.doesNotMatch(out, /@/);
});

test("電話番号のハイフンは「の」で読む", () => {
  assert.match(speechText("090-1234-5678 です。"), /090の1234の5678/);
});

test("英略語はカタカナに寄せる", () => {
  const out = speechText("Zoom の URL をタップしてください。iDeCo は対象外です。");
  assert.match(out, /ズーム/);
  assert.match(out, /ユーアールエル/);
  assert.match(out, /イデコ/);
});

test("金額は桁区切りを外して漢数字で読ませる", () => {
  const out = speechText("月55,000円から62,000円に引き上げられます。");
  assert.match(out, /五万五千円/);
  assert.match(out, /六万二千円/);
  assert.doesNotMatch(out, /,/);
});

test("接続表現のあとに読点を入れて間を作る", () => {
  assert.match(speechText("実は保険と企業年金制度は別のものです。"), /^実は、保険と/);
  assert.match(speechText("つまりコストを増やさずに済みます。"), /^つまり、コスト/);
});

test("すでに読点があるものは二重に付けない", () => {
  assert.equal(
    speechText("さらに、2026年12月1日に施行されます。"),
    "さらに、2026年12月1日に施行されます。",
  );
});

test("文単位に分割し、短すぎる断片は前の文に結合する", () => {
  assert.deepEqual(splitForSpeech("はい。承知しました。ありがとうございます。"), [
    "はい。承知しました。",
    "ありがとうございます。",
  ]);
});

test("ニューラル音声を最優先で選ぶ", () => {
  const list = [
    voice("Kyoko"),
    voice("Microsoft Nanami Online (Natural) - Japanese (Japan)", false),
    voice("Google 日本語", false),
    voice("Kyoko (Enhanced)"),
  ];
  const best = [...list].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
  assert.match(best!.name, /Natural/);
  // 素の Kyoko が最下位になること
  const worst = [...list].sort((a, b) => scoreVoice(a) - scoreVoice(b))[0];
  assert.equal(worst!.name, "Kyoko");
});

test("日本語どうしの間の空白は詰める（不自然な間を作らない）", () => {
  assert.equal(
    speechText("情報収集の一環として30分ほど、Zoom で御社の費用対効果をお伝えします。"),
    "情報収集の一環として30分ほど、ズームで御社の費用対効果をお伝えします。",
  );
});

test("メールの読み下しでは区切りの空白を残す", () => {
  const out = speechText("nakamura@sample-kogyo.co.jp です。");
  assert.match(out, /アットマーク sample/);
  assert.match(out, /シーオー/);
  assert.match(out, /ジェイピー/);
});

test("曜日の直後に時刻が続くときは読点で区切る", () => {
  assert.match(speechText("9月17日（水）14時から30分でいかがでしょうか？"), /水曜日、14時/);
});
