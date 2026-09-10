import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUDIO_BASE,
  bulkExtract,
  DialogEngine,
  GUARDRAIL_AUDIO,
  PHASE_AUDIO,
} from "./dialogEngine.js";
import { detectGuardrails } from "../domain/guardrails.js";
import type { GuardrailId } from "../domain/types.js";
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

// ---------- 判定辞書の拡充 ----------

test("拡充した判定辞書が実際の言い回しのゆれを拾う", () => {
  const cases: [string, GuardrailId][] = [
    ["退職金は特に設けておりませんね", "R1"],
    ["そういうのはこれから考えようかと思ってまして", "R1"],
    ["すみません、今打ち合わせ中でして", "R2"],
    ["また後日改めてもらえますか", "R2"],
    ["顧問の先生に全部見てもらってるので", "R3"],
    ["そのへんは社労士に一任してます", "R3"],
    ["パンフレットだけ郵送してもらえますか", "R4"],
    ["まずホームページを見せてもらえますか", "R4"],
    ["商工会議所の方ですか？", "R5"],
    ["それは補助金か何かですか", "R5"],
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

test("日程NGは開いた質問に戻さず別週の2択で出し直す", () => {
  const { state, dialog } = fresh();
  state.phase = "P7";
  const r = dialog.respond("その週は予定が入っておりまして");
  assert.equal(r.phase, "P7");
  assert.match(r.matched, /日程NG/);
  assert.match(r.utterance, /前半と後半/);
});

test("日程OKの言い回しでも日時確定に進む", () => {
  const { state, dialog } = fresh();
  state.phase = "P7";
  const r = dialog.respond("その時間なら空いてます");
  assert.equal(r.phase, "P8");
  assert.equal(state.appointmentDate, "9月17日（水）");
});

// ---------- 一括情報抽出（まとめ聞き） ----------

test("人数・決算月・年齢を1発話からまとめて抽出する", () => {
  assert.deepEqual(bulkExtract("役員は私を入れて3名、社会保険は10名、決算は3月です"), {
    officers: 3,
    insured: 10,
    fiscalMonth: 3,
  });
  assert.deepEqual(bulkExtract("役員が二名で、従業員は十二名ですね"), { officers: 2, insured: 12 });
  assert.deepEqual(bulkExtract("私は今年で56歳になります"), { age: 56 });
  assert.deepEqual(bulkExtract("9月が決算ですね"), { fiscalMonth: 9 });
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

  say("はい、それで大丈夫です"); // 日時確定 → P8
  const bulk = say("はい、どうぞ。役員は私を入れて3名、社会保険は10名、決算は3月です");

  assert.match(bulk.matched, /まとめ聞きで H4・H5・H7 を同時取得/);
  assert.match(state.hearing.H4 ?? "", /^3名/);
  assert.equal(state.hearing.H5, "10名");
  assert.equal(state.hearing.H7, "3月");
  assert.match(bulk.matched, /次は H1/);

  say("iDeCoはやっていません");
  say("退職金は保険だけです");
  say("私は56歳です");
  say("決めるのは私です");

  // 取得済みの3項目は一度も質問していない
  for (const slot of ["H4", "H5", "H7"]) {
    assert.ok(
      !asked.some((m) => m.includes(`次は ${slot}`)),
      `${slot} を質問してしまっている: ${asked.join(" | ")}`,
    );
  }
  assert.ok(asked.at(-1)?.includes("次は email"), `メール質問へ進んでいない: ${asked.at(-1)}`);
});

test("質問中の項目がまとめ回答で埋まっていたら聞き直さない", () => {
  const { state, dialog } = fresh();
  state.phase = "P7";
  dialog.respond("はい、それで大丈夫です");
  dialog.respond("はい、どうぞ"); // → H1 を質問中
  const r = dialog.respond("iDeCoはやっていません。役員は2名、社会保険は8名です");
  assert.equal(state.hearing.H1, "iDeCo・投資ともになし");
  assert.equal(state.hearing.H5, "8名");
  assert.match(r.matched, /次は H2/);
});

// ---------- MP3 の紐付け ----------

test("フェーズ・ガードレールに対応する録音が紐づく", () => {
  const { dialog } = fresh();
  assert.equal(dialog.greeting().audioFile, "public/audio/p0_greeting.mp3");

  const { state: s2, dialog: d2 } = fresh();
  s2.phase = "P1";
  assert.equal(d2.respond("うち、退職金制度はないんですよ").audioFile, "public/audio/r1_no_system.mp3");

  const { state: s3, dialog: d3 } = fresh();
  s3.phase = "P5";
  assert.equal(d3.respond("今ちょっと忙しくて").audioFile, "public/audio/r2_busy.mp3");
});

test("同じ録音は1通話で二度流さない（2回目は読み上げにフォールバック）", () => {
  const { state, dialog } = fresh();
  state.phase = "P5";
  assert.equal(dialog.respond("今ちょっと忙しくて").audioFile, "public/audio/r2_busy.mp3");
  assert.equal(dialog.respond("やっぱりバタバタしてまして").audioFile, undefined);
});

test("その場で組み立てる質問文には録音を紐づけない", () => {
  const { state, dialog } = fresh();
  state.phase = "P7";
  dialog.respond("はい、それで大丈夫です"); // P8 の許可取得（録音あり）
  const slotQuestion = dialog.respond("はい、どうぞ");
  assert.equal(slotQuestion.audioFile, undefined);
});

test("録音ファイルはすべて public/audio/ に実在する", async () => {
  const fs = await import("node:fs");
  const url = await import("node:url");
  const path = await import("node:path");
  const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
  const files = [...Object.values(PHASE_AUDIO), ...Object.values(GUARDRAIL_AUDIO)];
  for (const f of files) {
    assert.ok(fs.existsSync(path.join(root, AUDIO_BASE, f!)), `${AUDIO_BASE}${f} が存在しない`);
  }
});
