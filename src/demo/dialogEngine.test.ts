import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUDIO_BASE,
  bulkExtract,
  DialogEngine,
  GUARDRAIL_LINE,
  VOICE_LINES,
} from "./dialogEngine.js";
import { detectGuardrails } from "../domain/guardrails.js";
import type { GuardrailId } from "../domain/types.js";
import { createCallState } from "../domain/state.js";
import { evaluateDod } from "../domain/dod.js";
import { autoFix, checkForbidden } from "../domain/forbidden.js";

function fresh() {
  const state = createCallState();
  return { state, dialog: new DialogEngine(state) };
}

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// ---------- 収録台本と画面表示テキストの一致 ----------

test("収録台本は出力前フィルタで書き換えられない（表示テキストと音声が食い違わない）", () => {
  for (const [id, line] of Object.entries(VOICE_LINES)) {
    assert.equal(autoFix(line.text).text, line.text, `${id} が自動修正で書き換わる`);
    assert.deepEqual(checkForbidden(line.text), [], `${id} に禁止表現がある`);
  }
});

test("録音ファイルはすべて public/audio/ に実在する", () => {
  for (const [id, line] of Object.entries(VOICE_LINES)) {
    assert.ok(fs.existsSync(path.join(REPO, AUDIO_BASE, line.file)), `${id}: ${line.file} が無い`);
  }
});

test("応答の表示テキストは収録台本と完全一致し、対応する MP3 が付く", () => {
  const { dialog } = fresh();
  const g = dialog.greeting();
  assert.equal(g.utterance, VOICE_LINES.greeting.text);
  assert.equal(g.audioFile, `${AUDIO_BASE}${VOICE_LINES.greeting.file}`);

  const r = dialog.respond("どういったご用件でしょうか？");
  assert.equal(r.utterance, VOICE_LINES.overview.text);
  assert.equal(r.audioFile, `${AUDIO_BASE}${VOICE_LINES.overview.file}`);
});

// ---------- ガードレール ----------

test("R2 多忙は新台本どおり要点＋人数確認まで一気に運ぶ", () => {
  const { state, dialog } = fresh();
  state.phase = "P5";
  const r = dialog.respond("今ちょっと忙しいんですよ");
  assert.ok(r.guardrails.includes("R2"));
  assert.equal(r.utterance, VOICE_LINES.r2Busy.text);
  assert.equal(r.audioFile, `${AUDIO_BASE}r2_busy.mp3`);
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
  assert.equal(other.audioFile, `${AUDIO_BASE}r5_misunderstanding.mp3`);

  const { state: s2, dialog: d2 } = fresh();
  s2.phase = "P3";
  const publicBody = d2.respond("お国がやるなら手数料もかからんのでしょう");
  assert.ok(publicBody.guardrails.includes("R5"));
  // 立場の切り分けは実データ由来の必須ルール。収録が無くても必ず言う
  assert.match(publicBody.utterance, /民間の導入支援事業者/);
  assert.equal(publicBody.audioFile, undefined);
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

// ---------- 想定外発話のフォールバック ----------

test("想定外の発話でも読み上げに落とさず、録音で会話を立て直す", () => {
  const { state, dialog } = fresh();
  state.phase = "P3"; // 年齢層・人数を聞いた直後
  dialog.greeting();

  // 1回目: 同じ質問を録音で言い直す
  const first = dialog.respond("えーっと、それで何の話でしたっけ");
  assert.equal(first.utterance, VOICE_LINES.hearingAgeCount.text);
  assert.equal(first.audioFile, `${AUDIO_BASE}p2_p3_hearing.mp3`);
  assert.match(first.matched, /言い直す/);

  // 2回目: 答えやすい最小の質問（人数だけ）に切り替える
  const second = dialog.respond("いやー、どうもよく分からないですね");
  assert.equal(second.utterance, VOICE_LINES.r1NoSystem.text);
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
  assert.equal(answered.audioFile, `${AUDIO_BASE}p4_p5_hearin.mp3`);
});

test("日程NGは開いた質問に戻さず収録済みの代替日程で出し直す", () => {
  const { state, dialog } = fresh();
  state.phase = "P7";
  const r = dialog.respond("その日は予定が入っておりまして");
  assert.equal(r.utterance, VOICE_LINES.reschedule.text);
  assert.equal(r.audioFile, `${AUDIO_BASE}reschedule.mp3`);
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
  // ここから先は収録台本に無い項目（音声合成で補う）
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

test("R2 の次のターンは従業員数の確認、その次は概要確認へ進む", () => {
  const { dialog } = fresh();
  dialog.greeting();

  const busy = dialog.respond("ちょっと今忙しいんだよね");
  assert.equal(busy.utterance, VOICE_LINES.r2Busy.text);
  assert.equal(busy.audioFile, `${AUDIO_BASE}r2_busy.mp3`);

  // 2ターン目: 同じ切り返しではなく従業員数の確認（P3相当）
  const headcount = dialog.respond("だから今バタバタしてるんだって");
  assert.equal(headcount.utterance, VOICE_LINES.r1NoSystem.text);
  assert.match(headcount.utterance, /従業員数/);
  assert.match(headcount.matched, /連続再生を抑止/);

  // 3ターン目: 概要確認（P1相当）
  const overview = dialog.respond("いや、時間がないんだよ");
  assert.equal(overview.utterance, VOICE_LINES.overview.text);
  assert.equal(overview.phase, "P1");
});

test("多忙が続いても同じセリフが2回連続せず、必ず録音で会話が進む", () => {
  const { dialog } = fresh();
  dialog.greeting();
  const inputs = [
    "ちょっと今忙しいんだよね",
    "いや、だから今バタバタしてて",
    "うーん、時間ないんだよ",
    "だから時間がないって",
    "今は無理だよ、立て込んでる",
    "忙しいんだって",
  ];

  let previous = "";
  for (const input of inputs) {
    const r = dialog.respond(input);
    assert.notEqual(r.utterance, previous, `同じセリフが連続している: ${r.utterance.slice(0, 24)}`);
    assert.ok(r.audioFile, `録音ではなく音声合成に落ちている: ${r.matched}`);
    previous = r.utterance;
  }
});

test("R2 の直後に人数を答えられたら、そのまま回収して通常進行に戻る", () => {
  const { state, dialog } = fresh();
  state.phase = "P1";
  dialog.respond("すみません、今ちょっと立て込んでまして");
  const answered = dialog.respond("うちは20人くらいですね");
  assert.equal(state.hearing.H5, "20名");
  assert.notEqual(answered.utterance, VOICE_LINES.r2Busy.text);
});
