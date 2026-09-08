import { test } from "node:test";
import assert from "node:assert/strict";
import { DialogEngine } from "./dialogEngine.js";
import { createCallState } from "../domain/state.js";
import { evaluateDod } from "../domain/dod.js";
import { checkForbidden } from "../domain/forbidden.js";

function fresh() {
  const state = createCallState();
  return { state, dialog: new DialogEngine(state) };
}

test("R1「制度がない」は断りではなくホットサインとして P3 へ進む", () => {
  const { state, dialog } = fresh();
  state.phase = "P1";
  const r = dialog.respond("うち、退職金制度は何もないんですよ");
  assert.ok(r.guardrails.includes("R1"));
  assert.equal(r.phase, "P3");
  assert.match(r.matched, /R1/);
  assert.notEqual(state.phase, "END");
});

test("R2「忙しい」には制度説明を被せず仮押さえに切り替える", () => {
  const { state, dialog } = fresh();
  state.phase = "P5";
  const r = dialog.respond("今ちょっと忙しいんですよ");
  assert.ok(r.guardrails.includes("R2"));
  assert.equal(r.phase, "P6");
  assert.match(r.utterance, /仮押さえ/);
});

test("R3「税理士に任せている」は専門家を否定しない", () => {
  const { state, dialog } = fresh();
  state.phase = "P3";
  const r = dialog.respond("そのへんは顧問税理士に任せているので");
  assert.ok(r.guardrails.includes("R3"));
  assert.match(r.utterance, /判断材料/);
  assert.doesNotMatch(r.utterance, /詳しくない|わかっていない/);
});

test("R4「資料だけ送って」は送付手段と再架電をセットで取る", () => {
  const { state, dialog } = fresh();
  state.phase = "P5";
  const r = dialog.respond("とりあえず資料だけ送ってください");
  assert.ok(r.guardrails.includes("R4"));
  assert.match(r.utterance, /(メール|SMS|郵送)/);
  assert.match(r.utterance, /どちらがご都合/);
});

test("R5 公的機関との誤認は即座に立場を訂正する", () => {
  const { state, dialog } = fresh();
  state.phase = "P3";
  const r = dialog.respond("お国がやるなら手数料もかからんのでしょう");
  assert.ok(r.guardrails.includes("R5"));
  assert.match(r.utterance, /民間の導入支援事業者/);
});

test("R7 決裁者不在ならヒアリングを続けず次回接触条件に切り替える", () => {
  const { state, dialog } = fresh();
  state.phase = "P8";
  const r = dialog.respond("代表は外出しております");
  assert.ok(r.guardrails.includes("R7"));
  assert.match(r.utterance, /(お戻り|時間帯)/);
});

test("P8 は聞き取れなかった項目を次に進めず聞き直す", () => {
  const { state, dialog } = fresh();
  state.phase = "P7";
  dialog.respond("はい、大丈夫です"); // 日時確定 → P8（許可取得）
  dialog.respond("はい、どうぞ"); // → H1
  dialog.respond("やっていません"); // H1 取得 → H2
  dialog.respond("保険だけです"); // H2 取得 → H3（年齢）
  const again = dialog.respond("うーん、どうでしょうね"); // 年齢が取れない
  assert.equal(again.phase, "P8");
  assert.match(again.matched, /H3 が聞き取れず再質問/);
  assert.equal(state.hearing.H3, null);
});

test("自由発話だけで通しても DoD が全項目○になる", () => {
  const { state, dialog } = fresh();
  const say = (t: string) => dialog.respond(t);

  say("はい、サンプル工業でございます。どういったご用件でしょうか？");
  say("少々お待ちください。代表に代わります");
  say("はい、中村です");
  say("うち、退職金は保険でやってるので");
  say("私自身の分は把握してないですね");
  say("へえ、経費で落とせるんですか");
  say("来年また変わるんですね");
  say("うーん、妻とも相談してからかな");
  say("まあ、仮押さえなら大丈夫です");
  say("午後の方がいいかな");
  say("はい、それで大丈夫です");
  say("はい、どうぞ");
  say("iDeCoはやっていません");
  say("退職金は保険だけです");
  say("今年で56になります");
  say("役員は私と妻の2名です");
  say("社会保険は10名です");
  say("決めるのは私です");
  say("決算は3月です");
  say("nakamura@sample-kogyo.co.jp です");
  say("はい、合っています");
  say("090-1234-5678 です");
  const last = say("午前中がつながりやすいです");

  const dod = evaluateDod(state);
  assert.equal(
    dod.passed,
    true,
    `未充足: ${dod.items.filter((i) => !i.ok).map((i) => i.label).join(", ")}`,
  );
  assert.equal(last.phase, "P9");
  assert.equal(state.hearing.H5, "10名");
  assert.equal(state.email, "nakamura@sample-kogyo.co.jp");
});

test("自由発話の応答も禁止ワードフィルタを必ず通る", () => {
  const { state, dialog } = fresh();
  const inputs = [
    "どういったご用件ですか",
    "保険でやってます",
    "把握してないですね",
    "経費で落ちるんですか",
    "そうなんですね",
    "忙しいんですよ",
    "仮押さえなら大丈夫",
    "午後がいいです",
    "はい大丈夫です",
  ];
  for (const i of inputs) {
    const r = dialog.respond(i);
    assert.deepEqual(checkForbidden(r.utterance), [], `違反: ${r.utterance}`);
  }
  assert.equal(state.blockedViolationCount, 0);
});
