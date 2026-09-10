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
import { DialogEngine, VOICE_LINES, AUDIO_BASE, type DialogReply } from "./dialogEngine.js";
import { TransferEngine, type TransferReply } from "./transferEngine.js";
import { createCallState, type CallState } from "../domain/state.js";
import { evaluateDod } from "../domain/dod.js";

const AUDIO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/audio");

/** 応答が参照している録音が、配信物（public/audio/）に実在すること。 */
function assertAudioExists(audioFile: string | undefined, label: string): void {
  if (!audioFile) return;
  assert.ok(audioFile.startsWith(AUDIO_BASE), `${label}: 録音のパスが想定外: ${audioFile}`);
  assert.ok(
    fs.existsSync(path.join(AUDIO_DIR, path.basename(audioFile))),
    `${label}: 録音ファイルが存在しない: ${audioFile}`,
  );
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

/** 挨拶への巻き戻り・判定失敗・同じ応答の連続が無く、録音がすべて揃っていること。 */
function assertHealthyA(call: CallA, label: string): void {
  call.replies.forEach((r, i) => {
    assert.ok(r.utterance.length > 0, `${label}: ${i}ターン目の発話が空`);
    assertAudioExists(r.audioFile, `${label}: ${i}ターン目`);
    if (i === 0) return;
    assert.notEqual(r.utterance, VOICE_LINES.greeting.text, `${label}: ${i}ターン目で冒頭の挨拶に巻き戻っている`);
    assert.doesNotMatch(r.matched, /判定できず|読み取れず/, `${label}: ${i}ターン目で判定に失敗（${r.matched}）`);
    assert.notEqual(r.utterance, call.replies[i - 1]?.utterance, `${label}: ${i}ターン目で同じ応答を続けている`);
  });
}

// ---------- A-1. 正常突破 → アポ確定 ----------

/** 受付突破のしかた（取次ぎ／本人応答）ごとに、最後まで通るかを見る。 */
const A_OPENINGS: { label: string; turns: [string, string] }[] = [
  { label: "取次ぎ", turns: ["少々お待ちください、代わります", "はい、代表の中村です"] },
  { label: "本人応答", turns: ["私です", "はい、聞いてますよ"] },
];

for (const { label, turns } of A_OPENINGS) {
  test(`デモA 正常突破(${label}): 締め(P9)まで通り、DoD が全項目○になる`, () => {
    const call = new CallA();
    const steps: [string, string | RegExp][] = [
      [turns[0], VOICE_LINES.overview.text],
      [turns[1], VOICE_LINES.hearingAgeCount.text],
      ["50代で、役員2名と社員18名の20人です", VOICE_LINES.hearingFiscalEmail.text],
      ["決算は3月で、メールは nakamura@example.co.jp です", VOICE_LINES.schedule.text],
      ["はい、その時間なら大丈夫です", VOICE_LINES.contact.text],
      ["090-1234-5678 です", /iDeCo/],
      // 「特にやっていません」は制度なし(R1)の言い回しでもあるが、P8 では質問への回答として受け取る
      ["いえ、特にやっていません", /退職金制度/],
      ["特にないです", /ご判断で決められますか/],
      ["はい、私が決めます", /復唱させていただきます/],
      ["はい、合っています", /何時頃が繋がりやすい/],
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
  call.say("少々お待ちください、代わります");
  call.say("はい、代表の中村です");
  call.say("50代で、役員2名と社員18名の20人です");
  call.say("決算は3月で、メールは nakamura@example.co.jp です");
  call.say("はい、その時間なら大丈夫です");
  call.say("090-1234-5678 です"); // → H1（iDeCo・投資）
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
  test(`デモA 担当名ガード: 「${text}」→ 部署・役職で返し、取次ぎ後は概要説明へ進む`, () => {
    const call = new CallA();
    const guard = call.say(text);
    assert.match(guard.utterance, /特定の個人名ではなく/);
    assert.match(guard.utterance, /(人事|総務)/);
    assert.match(guard.utterance, /代表者様/);
    assert.equal(guard.phase, "P0", "取次ぎ前にフェーズが進んでいる");

    const overview = call.say("では社長に代わりますね");
    assert.equal(overview.utterance, VOICE_LINES.overview.text, `取次ぎ後に概要へ進まない: ${overview.matched}`);
    assert.equal(overview.audioFile, `${AUDIO_BASE}p1_overview.mp3`);
    assert.equal(call.say("はい、社長の中村です").utterance, VOICE_LINES.hearingAgeCount.text);
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
  call.say("少々お待ちください、代わります");
  call.say("はい、代表の中村です");
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
  call.say("少々お待ちください、代わります");
  call.say("はい、代表の中村です");
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
    assert.equal(r.audioFile, `${AUDIO_BASE}p1_overview.mp3`);
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
  assert.equal(closed.audioFile, `${AUDIO_BASE}reject_closing.mp3`);
  assert.equal(call.state.ended, true);
});

test("デモA 断り: 受付の営業電話ブロックは食い下がらず撤退する", () => {
  const call = new CallA();
  const r = call.say("営業電話はお断りしております");
  assert.equal(r.utterance, VOICE_LINES.reject.text);
  assert.equal(r.phase, "P0X");
  assert.equal(call.state.ended, true);
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
    assertAudioExists(r.audioFile, `タイプB「${text}」`);
    return r;
  }
}

/** 人間へ引き継いだこと（AI は喋らず、音声も再生しない）。 */
function assertHandover(call: CallB, r: TransferReply, label: string): void {
  assert.equal(r.handover, true, `${label}: 引き継ぎになっていない（${r.matched}）`);
  assert.equal(r.outcome, "handover");
  assert.equal(r.utterance, "", `${label}: 引き継ぎ時に AI が発話している`);
  assert.equal(r.audioFile, undefined, `${label}: 引き継ぎ時に音声を再生しようとしている`);
  assert.equal(call.engine.finished, true);
}

// ---------- B-1. 正常突破 ----------

for (const text of ["少々お待ちください", "担当に代わります", "お電話代わりました", "代表の中村です"]) {
  test(`デモB 正常突破: 「${text}」で人間へ引き継ぐ`, () => {
    const call = new CallB();
    assert.equal(call.replies[0]?.audioFile, `${AUDIO_BASE}p0_greeting.mp3`);
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
  assert.equal(r.audioFile, `${AUDIO_BASE}reject_closing.mp3`);
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
