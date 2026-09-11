/**
 * 会話シミュレーションの網羅テスト。
 *
 * 実際の架電で起きた「判定漏れ → 文脈崩壊」を再発させないための回帰スイート。
 * 個別の分岐ではなく「相手がこう言ったら会話が壊れないか」を通しで確認する。
 *
 * ここで壊れているとみなす状態:
 *   1. 判定できずに立て直しへ落ちる（本来は拾えるはずの回答なのに聞き返す）
 *   2. 冒頭の挨拶に巻き戻る
 *   3. 断り・不在を無視してヒアリングを一方的に進める
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DialogEngine, isContactGuard, type DialogReply } from "../../demo/dialogEngine.js";
import { AUDIO_BASE, PHRASES, VOICE_LINES, audioFiles } from "../../demo/voiceLines.js";
import { createCallState, type CallState } from "../state.js";
import { detectGuardrails } from "../guardrails.js";
import type { PhaseId } from "../types.js";

/** 1通話ぶんのシミュレーション。 */
class Call {
  readonly state: CallState;
  readonly replies: DialogReply[] = [];
  private engine: DialogEngine;

  constructor(startPhase?: PhaseId) {
    this.state = createCallState();
    this.engine = new DialogEngine(this.state);
    this.replies.push(this.engine.greeting());
    if (startPhase) this.state.phase = startPhase;
  }

  say(text: string): DialogReply {
    const r = this.engine.respond(text);
    this.replies.push(r);
    return r;
  }

  /** 直近の応答が「立て直し」でないこと（拾えるはずの回答を聞き返していないこと）。 */
  get lastMatched(): string {
    return this.replies.at(-1)?.matched ?? "";
  }
}

const HEARING_LINES: string[] = [
  VOICE_LINES.hearingAgeCount.text,
  PHRASES.recapHearingAgeCount.text,
  VOICE_LINES.hearingFiscalEmail.text,
  VOICE_LINES.schedule.text,
];

/** 挨拶への巻き戻り・判定失敗が起きていないこと。 */
function assertNoBreakdown(call: Call, label: string): void {
  call.replies.slice(1).forEach((r, i) => {
    assert.notEqual(
      r.utterance,
      VOICE_LINES.greeting.text,
      `${label}: ${i + 1}ターン目で冒頭の挨拶に巻き戻っている`,
    );
    assert.doesNotMatch(
      r.matched,
      /判定できず|読み取れず/,
      `${label}: ${i + 1}ターン目で判定に失敗している（${r.matched}）`,
    );
  });
}

/** 受付の取次ぎ（保留 → 担当者が応答 → 名乗り直し → 概要）を経て、年齢層・人数を尋ねるところまで進める。 */
function passReception(call: Call): void {
  const hold = call.say("少々お待ちください、代わります");
  assert.equal(hold.holding, true, `取次ぎの保留中に発話している: ${hold.matched}`);
  assert.equal(call.say("はい、代表の中村です").utterance, PHRASES.handoffReintro.text);
  assert.equal(call.say("はい、どういったお話でしょう").utterance, VOICE_LINES.overview.text);
  assert.equal(call.say("なるほど").utterance, PHRASES.recapHearingAgeCount.text);
}

// ============================================================
// 1. 断り・拒絶（対策済み・間に合っている）
// ============================================================

const DECLINE_CASES: string[] = [
  "うちはもう対策してるので",
  "対策済みです",
  "間に合ってます",
  "間に合ってるので結構です",
  "大丈夫です",
  "大丈夫の意味わかってる？",
  "結構です",
  "いらないです",
  "要らないよ",
  "必要ありません",
  "十分足りてます",
  "もう導入済みです",
  "うちはやってますので",
  "前にやっていました",
  "興味ないです",
  "もういいです",
];

for (const text of DECLINE_CASES) {
  test(`断り判定: 「${text}」でヒアリングを進めない`, () => {
    const call = new Call();
    const r = call.say(text);
    assert.ok(
      !HEARING_LINES.includes(r.utterance),
      `断りを無視してヒアリングを進めている: ${r.matched}`,
    );
    assert.equal(
      r.utterance,
      VOICE_LINES.r5OtherScheme.text,
      `断りとして切り返していない: ${r.matched}`,
    );
    assertNoBreakdown(call, `断り「${text}」`);
  });
}

test("断り判定: 概要を伝えたあとの断りも拾う", () => {
  const call = new Call();
  call.say("少々お待ちください、代わります");
  call.say("はい、代表の中村です"); // → 名乗り直し
  call.say("はい、どういったお話でしょう"); // → 概要
  const r = call.say("うちはもう対策してるんで大丈夫です");
  assert.ok(!HEARING_LINES.includes(r.utterance), `一方的に進行している: ${r.matched}`);
});

// ============================================================
// 2. 不在・決裁権なし
// ============================================================

const ABSENT_CASES: string[] = [
  "今不在にしてます",
  "不在です",
  "ただいま席を外しております",
  "出かけております",
  "出張中です",
  "出張しております",
  "担当者は休みです",
  "本日は休みを取っております",
  "外出しております",
  "留守にしております",
  "今おりません",
  "戻りは夕方になります",
  "帰宅しました",
];

for (const text of ABSENT_CASES) {
  test(`不在判定: 「${text}」を R7 として扱う`, () => {
    assert.ok(
      detectGuardrails(text).includes("R7"),
      `R7 が発火しない（検知: ${detectGuardrails(text).join(",") || "なし"}）`,
    );
    const call = new Call();
    const r = call.say(text);
    assert.equal(r.utterance, VOICE_LINES.r7Absent.text, `不在用の切り返しになっていない: ${r.matched}`);
    assert.notEqual(r.utterance, VOICE_LINES.r1NoSystem.text);
    assertNoBreakdown(call, `不在「${text}」`);
  });
}

const NO_AUTHORITY_CASES: string[] = [
  "私では分かりません",
  "私では分かりかねます",
  "自分では決められないんです",
  "受付です",
  "権限がないので",
  "担当ではありません",
];

for (const text of NO_AUTHORITY_CASES) {
  test(`決裁権なし判定: 「${text}」を R7 として扱う`, () => {
    assert.ok(
      detectGuardrails(text).includes("R7"),
      `R7 が発火しない（検知: ${detectGuardrails(text).join(",") || "なし"}）`,
    );
    const call = new Call();
    const r = call.say(text);
    assert.equal(r.utterance, VOICE_LINES.r7Absent.text, `切り返しが噛み合っていない: ${r.matched}`);
  });
}

test("不在: 戻り時間と折り返し先が揃ったら折り返しを約束して終話する", () => {
  const call = new Call();
  call.say("担当は今不在にしてます");
  call.say("夕方には戻ります");
  call.say("090-1234-5678 です");
  assert.equal(call.state.callbackWindow, "夕方");
  assert.equal(call.state.callbackPhone, "090-1234-5678");
  assert.equal(call.state.ended, true);
  assertNoBreakdown(call, "不在→折り返し");
});

// ============================================================
// 3. 質問直後の単答（人数）
// ============================================================

/** 切り返しで人数を聞いた直後の回答。数字だけでも拾えなければならない。 */
const HEADCOUNT_ANSWERS: { text: string; expected: string }[] = [
  { text: "20名です", expected: "20名" },
  { text: "10人です", expected: "10人" },
  { text: "3人ですね", expected: "3人" },
  { text: "私一人です", expected: "1人" },
  { text: "二十名です", expected: "20名" },
  { text: "20人くらいかな", expected: "20人" },
  { text: "従業員は12名です", expected: "12名" },
  { text: "うちは30名ほどです", expected: "30名" },
  { text: "ざっと15人ですね", expected: "15人" },
  { text: "5名だけです", expected: "5名" },
  { text: "だいたい8人ですね", expected: "8人" },
  { text: "全部で25名になります", expected: "25名" },
];

for (const { text, expected } of HEADCOUNT_ANSWERS) {
  test(`R2(多忙)の直後の単答: 「${text}」を人数として拾って次へ進む`, () => {
    const call = new Call();
    call.say("ちょっと今忙しいんだよね");
    const r = call.say(text);
    assert.equal(
      call.state.hearing.H5,
      expected.replace(/人$/, "名"),
      `人数を取得できていない: ${r.matched}`,
    );
    assert.equal(
      r.utterance,
      VOICE_LINES.hearingFiscalEmail.text,
      `次の質問へ進んでいない: ${r.matched}`,
    );
    assertNoBreakdown(call, `多忙→「${text}」`);
  });
}

for (const { text, expected } of HEADCOUNT_ANSWERS.slice(0, 6)) {
  test(`R1(制度なし)の直後の単答: 「${text}」を人数として拾って次へ進む`, () => {
    const call = new Call();
    call.say("うちは退職金制度、何もやってないんですよ");
    const r = call.say(text);
    assert.equal(call.state.hearing.H5, expected.replace(/人$/, "名"), `人数を取得できていない: ${r.matched}`);
    assert.equal(r.utterance, VOICE_LINES.hearingFiscalEmail.text, `次の質問へ進んでいない: ${r.matched}`);
    assertNoBreakdown(call, `制度なし→「${text}」`);
  });
}

const AGE_COUNT_ANSWERS: string[] = [
  "50代で20人です",
  "40代から50代、全部で20名です",
  "役員2名と社員18名の合わせて20人です",
  "だいたい50代ですね、15人くらいです",
];

for (const text of AGE_COUNT_ANSWERS) {
  test(`P3(年齢層・人数)の回答: 「${text}」を拾って決算月の質問へ進む`, () => {
    const call = new Call();
    passReception(call);
    const r = call.say(text);
    assert.ok(call.state.hearing.H5 || call.state.hearing.H4, `人数を取得できていない: ${r.matched}`);
    assert.equal(r.utterance, VOICE_LINES.hearingFiscalEmail.text, `次の質問へ進んでいない: ${r.matched}`);
    assertNoBreakdown(call, `年齢層・人数「${text}」`);
  });
}

// ============================================================
// 4. 連続拒絶 → 終話
// ============================================================

const CONSECUTIVE_REFUSALS: { label: string; turns: [string, string] }[] = [
  { label: "多忙が2回", turns: ["ちょっと今忙しいんだよね", "だから今バタバタしてるって"] },
  { label: "断りが2回", turns: ["うちはもう対策してるので", "いや、間に合ってます"] },
  { label: "多忙のあと断り", turns: ["今忙しいんだよ", "そもそも間に合ってるから"] },
  { label: "断りのあと多忙", turns: ["結構です", "今忙しいので"] },
  { label: "大丈夫が2回", turns: ["うちは大丈夫です", "だから大丈夫だって"] },
  { label: "結構ですが2回", turns: ["結構です", "いらないです"] },
];

for (const { label, turns } of CONSECUTIVE_REFUSALS) {
  test(`連続拒絶(${label}): 2回目で丁寧に終話する`, () => {
    const call = new Call();
    call.say(turns[0]);
    const second = call.say(turns[1]);
    assert.equal(second.utterance, VOICE_LINES.reject.text, `終話していない: ${second.matched}`);
    assert.equal(call.state.ended, true, "通話が終了扱いになっていない");
  });
}

test("連続拒絶: 途中で回答が得られたら終話しない", () => {
  const call = new Call();
  call.say("今ちょっと忙しいんだよね");
  call.say("20名です");
  const third = call.say("決算は3月です");
  assert.equal(call.state.ended, false, "回答が得られているのに終話している");
  assert.notEqual(third.utterance, VOICE_LINES.reject.text);
});

test("日程NGは拒絶として終話させず、代替日程を出す", () => {
  const call = new Call("P7");
  const r = call.say("その日は都合が悪いですね");
  assert.equal(r.utterance, VOICE_LINES.reschedule.text);
  assert.equal(call.state.ended, false);
});

// ============================================================
// 5. 正常進行の非回帰
// ============================================================

test("正常進行: 取次ぎ → 名乗り直し → 概要 → 人数 → 決算月 → 日程 → 連絡先", () => {
  const call = new Call();
  passReception(call);
  assert.equal(
    call.say("50代で、役員2名と社員18名の20人です").utterance,
    VOICE_LINES.hearingFiscalEmail.text,
  );
  assert.equal(
    call.say("決算は3月で、メールは nakamura@example.co.jp です").utterance,
    VOICE_LINES.schedule.text,
  );
  assert.equal(call.say("はい、その時間なら大丈夫です").utterance, VOICE_LINES.contact.text);
  assert.equal(call.state.appointmentDate, "9月17日（水）");
  assertNoBreakdown(call, "正常進行");
});

test("正常進行: 資料請求は送付先の確定へ", () => {
  const call = new Call();
  const r = call.say("とりあえず資料だけ送ってください");
  assert.equal(r.utterance, VOICE_LINES.r4Document.text);
});

test("正常進行: 専門家任せはセカンドオピニオンへ", () => {
  const call = new Call();
  const r = call.say("そのへんは顧問税理士に任せていますので");
  assert.equal(r.utterance, VOICE_LINES.r3Expert.text);
});

test("正常進行: 他制度との勘違いは訂正する", () => {
  const call = new Call();
  const r = call.say("それってiDeCoのことですよね？");
  assert.equal(r.utterance, VOICE_LINES.r5OtherScheme.text);
});

test("正常進行: 公的機関との誤認は立場を切り分ける", () => {
  const call = new Call();
  const r = call.say("お国がやるなら手数料もかからんのでしょう");
  assert.match(r.utterance, /民間の導入支援事業者/);
});

test("正常進行: 営業電話ブロックは痕跡を残して終話", () => {
  const call = new Call();
  const r = call.say("営業電話はお断りしております");
  assert.equal(r.utterance, VOICE_LINES.reject.text);
  assert.equal(r.phase, "P0X");
});

// ============================================================
// 6. 受付が電話口に出たときの応答（挨拶に巻き戻らないこと）
// ============================================================

const ANSWERED_CASES: string[] = [
  "はい、サンプル工業です",
  "もしもし",
  "はい、社長の田中です",
  "はい、どうも",
  "はい、なんでしょう",
  "株式会社サンプル、山田でございます",
];

for (const text of ANSWERED_CASES) {
  test(`受付応答: 「${text}」で概要へ進む（挨拶に巻き戻らない）`, () => {
    const call = new Call();
    const r = call.say(text);
    assert.equal(r.utterance, VOICE_LINES.overview.text, `概要へ進んでいない: ${r.matched}`);
    assertNoBreakdown(call, `受付応答「${text}」`);
  });
}

// ============================================================
// 7. 数字を伴わない人数の答え方
// ============================================================

const PHRASE_COUNT_CASES: { text: string; expected: string }[] = [
  { text: "私と妻だけです", expected: "2名" },
  { text: "私一人です", expected: "1名" },
  { text: "夫婦だけでやっています", expected: "2名" },
  { text: "私だけですね", expected: "1名" },
];

for (const { text, expected } of PHRASE_COUNT_CASES) {
  test(`人数の言い換え: 「${text}」を ${expected} として拾う`, () => {
    const call = new Call();
    call.say("ちょっと今忙しいんだよね");
    const r = call.say(text);
    assert.equal(call.state.hearing.H5, expected, `人数を取得できていない: ${r.matched}`);
    assert.equal(r.utterance, VOICE_LINES.hearingFiscalEmail.text, `次へ進んでいない: ${r.matched}`);
  });
}

test("回答の中に「やってます」が含まれても断りと取り違えない", () => {
  const call = new Call();
  call.say("ちょっと今忙しいんだよね");
  const r = call.say("20名でやってます");
  assert.equal(call.state.hearing.H5, "20名");
  assert.notEqual(r.utterance, VOICE_LINES.reject.text);
  assert.equal(r.utterance, VOICE_LINES.hearingFiscalEmail.text);
});

// ============================================================
// 8. 条件分岐（オンライン・郵送）
// ============================================================

test("オンライン商談への不安には操作の簡単さを伝える", () => {
  const call = new Call("P7");
  const r = call.say("オンラインって何ですか");
  assert.match(r.utterance, /スマートフォンでも参加できます/);
  assert.doesNotMatch(r.matched, /判定できず/);
});

test("「そちらは遠い」には移動不要であることを伝える", () => {
  const call = new Call("P7");
  const r = call.say("そちらは遠いので伺うのは難しいです");
  assert.match(r.utterance, /移動やご来社は不要/);
});

test("前向きな保留（調整してみます）は日程確定として進める", () => {
  const call = new Call("P7");
  const r = call.say("調整してみます");
  assert.equal(r.utterance, VOICE_LINES.contact.text);
  assert.equal(call.state.appointmentDate, "9月17日（水）");
});

test("メールが使えない場合は郵送に切り替えて決算月だけ確認する", () => {
  const call = new Call("P5");
  const r = call.say("メールは苦手でして");
  assert.match(r.utterance, /郵送/);
  assert.doesNotMatch(r.matched, /読み取れず/);
});

// ============================================================
// 9. 同じ応答の繰り返し防止
// ============================================================

const REPEATED_GUARDRAILS: { label: string; text: string }[] = [
  { label: "R1 制度なし", text: "うちは何もやってないです" },
  { label: "R3 専門家任せ", text: "社労士に聞いてみます" },
  { label: "R4 資料請求", text: "資料を送ってください" },
  { label: "R5 他制度の勘違い", text: "それってiDeCoのことでしょう" },
];

for (const { label, text } of REPEATED_GUARDRAILS) {
  test(`繰り返し防止: ${label} が2回続いても同じ応答を返さない`, () => {
    const call = new Call();
    const first = call.say(text);
    const second = call.say(text);
    assert.notEqual(second.utterance, first.utterance, `同じ応答を繰り返している: ${second.matched}`);
  });
}

test("繰り返し防止: 公的機関との誤認の訂正を繰り返さない", () => {
  const call = new Call();
  const first = call.say("お国がやってる制度ですか");
  const second = call.say("役所の方ですよね");
  assert.notEqual(second.utterance, first.utterance);
});

test("繰り返し防止: 不在対応で同じ質問を繰り返さない", () => {
  const call = new Call();
  call.say("今不在にしてます");
  const a = call.say("分かりません");
  const b = call.say("さあ、なんとも");
  assert.notEqual(b.utterance, a.utterance, `同じ質問を繰り返している: ${b.matched}`);
});

test("繰り返し防止: P8 の聞き直しは言い回しを変える", () => {
  const call = new Call("P7");
  call.say("はい、その時間で大丈夫です"); // → P8（連絡先の確認）
  const a = call.say("うーん");
  const b = call.say("ええと");
  assert.match(a.matched, /callbackPhone が聞き取れず/);
  assert.match(b.matched, /callbackPhone が聞き取れず/);
  assert.notEqual(b.utterance, a.utterance, "同じ文言で聞き直している");
});

test("誤認の訂正直後に人数を言われても拾って進む（挨拶に巻き戻らない）", () => {
  const call = new Call();
  call.say("それ補助金か何かですか？");
  const r = call.say("二十名です");
  assert.equal(call.state.hearing.H5, "20名");
  assert.notEqual(r.utterance, VOICE_LINES.greeting.text);
  assertNoBreakdown(call, "誤認訂正→人数");
});

// ============================================================
// 10. ランダム会話での破綻検査
// ============================================================

test("ランダムな受け答えを通しても会話が破綻しない", () => {
  const CORPUS = [
    "はい、山田商事です", "少々お待ちください", "営業のお電話はお断りしています",
    "今忙しい", "会議中なんです", "また今度にして", "急いでるんで手短に",
    "不在です", "席を外しております", "出張中でして", "戻りは夕方です", "本日休みです",
    "私では分かりません", "決裁権がないので", "受付です",
    "対策済みです", "間に合ってます", "大丈夫です", "結構です", "いらないです", "やってますので",
    "何もやってないです", "これから考えます", "顧問税理士に任せてます", "資料送ってください",
    "お国の制度ですか", "それiDeCoでしょ", "20名です", "私一人です", "私と妻だけ", "15人くらい",
    "3月です", "info@example.co.jp です", "メールは苦手で",
    "はい大丈夫です", "水曜は厳しい", "調整してみます", "オンラインって何？",
    "090-1234-5678 です", "ふーん", "えーっと", "……", "うーん", "よく分からん",
    "ホームページに載ってます", "HPを見てください", "サイトに出てます", "サイト通りです",
    "担当者のお名前はお分かりでしょうか", "誰に繋げばいいですか", "どこの部署ですか",
    "担当者名 お分かりでしょうか", "名前わかりますか", "担当 誰",
    "私です", "僕です", "当方です", "担当ですが",
  ];

  // 再現できるよう擬似乱数は固定シードで回す
  let seed = 20260910;
  const rnd = (): number => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

  for (let run = 0; run < 400; run++) {
    const call = new Call();
    const script: string[] = [];
    const counts = new Map<string, number>();
    let previous = call.replies[0]?.utterance ?? "";

    for (let turn = 0; turn < 6 && !call.state.ended; turn++) {
      const text = CORPUS[Math.floor(rnd() * CORPUS.length)] ?? "";
      script.push(text);
      const r = call.say(text);
      const ctx = `[${script.join(" / ")}]`;

      // 保留中は喋らずに待つ。保留の合図以外で黙り込んではいけない
      if (r.holding) {
        assert.equal(text, "少々お待ちください", `${ctx} 保留の合図ではないのに黙っている`);
        continue;
      }
      assert.notEqual(r.utterance, VOICE_LINES.greeting.text, `${ctx} 冒頭の挨拶に巻き戻っている`);
      assert.notEqual(r.utterance, previous, `${ctx} 同じ応答を続けて返している`);
      const n = (counts.get(r.utterance) ?? 0) + 1;
      counts.set(r.utterance, n);
      assert.ok(n < 3, `${ctx} 同じ応答を${n}回繰り返している`);
      previous = r.utterance;
    }
  }
});

// ============================================================
// 11. 「ホームページを見て」への対応（資料請求との切り分け）
// ============================================================

const HP_CASES: string[] = [
  "ホームページに載ってるので見てください",
  "それもホームページに載ってます",
  "HPに出てます",
  "詳しくはサイトをご覧ください",
  "ネットに載ってますよ",
  "まずホームページを見せてもらえますか",
  "うちのサイトに全部出てます",
  "会社の概要はウェブに掲載しております",
];

for (const text of HP_CASES) {
  test(`HP参照: 「${text}」を資料請求と誤判定しない`, () => {
    assert.ok(
      !detectGuardrails(text).includes("R4"),
      `資料請求(R4)として誤判定している（検知: ${detectGuardrails(text).join(",")}）`,
    );
  });
}

test("HP参照: 本来の資料請求は引き続き R4 として扱う", () => {
  for (const text of [
    "とりあえず資料だけ送ってください",
    "パンフレットを郵送してもらえますか",
    "まず資料を見せてください",
    "案内をメールで送ってください",
  ]) {
    assert.ok(detectGuardrails(text).includes("R4"), `R4 が発火しない: ${text}`);
  }
});

test("HP参照: メールアドレスを聞いた場面で言われても催促し直さない", () => {
  const call = new Call();
  passReception(call);
  call.say("50代で20人です"); // → 決算月とメールアドレスの質問
  const r = call.say("ホームページに載ってるので見てください");

  // 送付先の催促に戻らないこと
  assert.doesNotMatch(r.utterance, /メールアドレス/, `メールアドレスを催促している: ${r.matched}`);
  assert.notEqual(r.utterance, VOICE_LINES.r4Document.text);
  assert.notEqual(r.utterance, VOICE_LINES.hearingFiscalEmail.text);
  // 受け止めたうえでオンラインでの接点づくりに切り替えること
  assert.match(r.utterance, /サイトより確認/);
  assert.match(r.utterance, /オンライン/);
  assert.equal(r.phase, "P7");
});

test("HP参照: 2回続けて言われたら丁寧に終話する", () => {
  const call = new Call();
  passReception(call);
  call.say("50代で20人です");
  call.say("ホームページに載ってるので見てください");
  const closed = call.say("それもホームページに載ってます");

  assert.equal(closed.utterance, VOICE_LINES.reject.text, `終話していない: ${closed.matched}`);
  assert.deepEqual(audioFiles(closed.segments), [`${AUDIO_BASE}reject_closing.mp3`]);
  assert.equal(call.state.ended, true);
});

test("HP参照: メールアドレスの催促をオウム返ししない", () => {
  const call = new Call();
  passReception(call);
  call.say("50代で20人です");
  const first = call.say("ホームページに載ってるので見てください");
  const second = call.say("それもホームページに載ってます");
  assert.notEqual(second.utterance, first.utterance, "同じ応答を繰り返している");
  for (const r of [first, second]) {
    assert.doesNotMatch(r.utterance, /送付先のメールアドレス/, "送付先を催促している");
  }
});

test("HP参照: 資料請求のあとにHPと言われたら送付先を聞き直さない", () => {
  const call = new Call();
  passReception(call);
  const doc = call.say("とりあえず資料を送ってください");
  assert.equal(doc.utterance, VOICE_LINES.r4Document.text);

  const hp = call.say("あ、ホームページに載ってるのでいいです");
  assert.doesNotMatch(hp.utterance, /メールアドレス/, `送付先を聞き直している: ${hp.matched}`);
});

// ============================================================
// 12. 受付ガード（担当者名の確認・取次ぎ先不明）
// ============================================================

const CONTACT_GUARD_CASES: string[] = [
  "担当者のお名前はお分かりでしょうか",
  "お名前はお分かりですか",
  "担当者様のお名前を教えていただけますか",
  "誰宛てになりますか",
  "どなたにお繋ぎすればよいですか",
  "担当が誰かわからないんですが",
  "担当者が分かりません",
  "どこの部署でしょうか",
  "担当部署はどちらですか",
  "誰に繋げばいいですか",
];

for (const text of CONTACT_GUARD_CASES) {
  test(`受付ガード: 「${text}」で概要説明・ヒアリング・挨拶に流れない`, () => {
    const call = new Call();
    const r = call.say(text);

    // 用件確認と取り違えて概要を流さない
    assert.notEqual(r.utterance, VOICE_LINES.overview.text, `概要説明に流れている: ${r.matched}`);
    // 相手の質問を無視してヒアリングへ進まない
    assert.notEqual(r.utterance, VOICE_LINES.hearingAgeCount.text, `人数確認へ進んでいる: ${r.matched}`);
    assert.notEqual(r.utterance, VOICE_LINES.hearingFiscalEmail.text);
    // 冒頭の挨拶をオウム返ししない
    assert.notEqual(r.utterance, VOICE_LINES.greeting.text, `挨拶を繰り返している: ${r.matched}`);

    // 部署と役職で取次ぎ先を示す
    assert.match(r.utterance, /個人名ではなく/);
    assert.match(r.utterance, /(人事|総務)/);
    assert.match(r.utterance, /代表者様/);
    assert.match(r.utterance, /お繋ぎいただけ/);
    assert.equal(call.state.ended, false);
  });
}

test("受付ガード: ヒアリング中に名前を聞かれても人数確認に戻さない", () => {
  const call = new Call();
  passReception(call); // → 年齢層・人数の質問
  const r = call.say("担当者のお名前はお分かりでしょうか");
  assert.match(r.utterance, /個人名ではなく/);
  assert.notEqual(r.utterance, VOICE_LINES.hearingAgeCount.text);
});

test("受付ガード: 取次ぎ先が決まらなければ粘らず終話する", () => {
  const call = new Call();
  call.say("担当者のお名前はお分かりでしょうか");
  const closed = call.say("いや、誰に繋げばいいか分からないですね");
  assert.equal(closed.utterance, VOICE_LINES.reject.text);
  assert.equal(call.state.ended, true);
});

test("受付ガード: 通常の用件確認は従来どおり概要を説明する", () => {
  const call = new Call();
  const r = call.say("どういったご用件でしょうか");
  assert.equal(r.utterance, VOICE_LINES.overview.text);
});

test("HP参照: 「サイト通りです」も回避として扱い、初期の切り返しへ巻き戻さない", () => {
  const call = new Call();
  passReception(call);
  const r = call.say("サイト通りです");
  assert.notEqual(r.utterance, VOICE_LINES.r1NoSystem.text, "初期の切り返しへ巻き戻っている");
  assert.notEqual(r.utterance, VOICE_LINES.greeting.text);
  assert.match(r.utterance, /サイトより確認/);
});

// ============================================================
// 13. 受付ガード: 助詞なし・スペース区切りの言い回し
// ============================================================

const LOOSE_CONTACT_CASES: string[] = [
  "担当者名 お分かりでしょうか",
  "担当者名お分かりですか",
  "担当者名は",
  "名前わかりますか",
  "お名前 教えてください",
  "担当者わかりません",
  "担当者 知らないです",
  "担当 誰",
  "誰か分かりますか",
  "どなた宛",
  "担当者名 教えて",
  "部署 分かりますか",
];

for (const text of LOOSE_CONTACT_CASES) {
  test(`受付ガード(助詞なし): 「${text}」を担当名確認として拾う`, () => {
    assert.ok(isContactGuard(text), "担当名確認として検知されない");

    const call = new Call();
    const r = call.say(text);
    assert.notEqual(r.utterance, VOICE_LINES.greeting.text, `挨拶を繰り返している: ${r.matched}`);
    assert.notEqual(r.utterance, VOICE_LINES.overview.text, `概要説明に流れている: ${r.matched}`);
    assert.doesNotMatch(r.matched, /判定できず|読み取れず/, `判定できずに聞き直している: ${r.matched}`);
    assert.match(r.utterance, /個人名ではなく/);
    assert.match(r.utterance, /(人事|総務)/);
    assert.match(r.utterance, /代表者様/);
  });
}

test("受付ガード: 取次ぎの申し出は担当名確認として扱わない", () => {
  for (const text of [
    "少々お待ちください",
    "担当に代わりますね",
    "確認してまいります",
    "担当の者に伝えておきます",
    "はい、私が担当です",
    "担当は不在です",
  ]) {
    assert.ok(!isContactGuard(text), `担当名確認として誤検知している: ${text}`);
  }
});

test("受付ガード: 取次ぎ先を尋ねる疑問形は、取次ぎ語を含んでいても拾う", () => {
  for (const text of ["どなたにお繋ぎすればよいですか", "どちらの部署におつなぎすれば？"]) {
    assert.ok(isContactGuard(text), `取次ぎ先の質問を拾えていない: ${text}`);
  }
});

// ============================================================
// 14. タイプA: 本人が電話口に出た合図（受付突破）
// ============================================================

const SELF_IDENTIFY_CASES: string[] = [
  "私です",
  "私ですが",
  "はい、私ですけど",
  "私が担当です",
  "自分が担当です",
  "僕です",
  "当方です",
  "担当ですが",
  "私でお伺いします",
];

for (const text of SELF_IDENTIFY_CASES) {
  test(`タイプA 本人応答: 「${text}」で概要説明(P1)へ進む`, () => {
    const call = new Call();
    const r = call.say(text);

    assert.equal(r.utterance, VOICE_LINES.overview.text, `概要説明へ進んでいない: ${r.matched}`);
    assert.deepEqual(audioFiles(r.segments), [`${AUDIO_BASE}p1_overview.mp3`]);
    assert.equal(r.phase, "P1");
    // 挨拶のリピートや判定不能に落ちないこと
    assert.notEqual(r.utterance, VOICE_LINES.greeting.text, `挨拶を繰り返している: ${r.matched}`);
    assert.doesNotMatch(r.matched, /判定できず/, `判定できずに聞き直している: ${r.matched}`);
    assertNoBreakdown(call, `本人応答「${text}」`);
  });
}

test("タイプA 本人応答: そのままヒアリングまで進める", () => {
  const call = new Call();
  assert.equal(call.say("私です").utterance, VOICE_LINES.overview.text);
  assert.equal(call.say("はい、聞いてますよ").utterance, PHRASES.recapHearingAgeCount.text);
  assert.equal(
    call.say("50代で、役員2名と社員18名の20人です").utterance,
    VOICE_LINES.hearingFiscalEmail.text,
  );
});

test("タイプA 本人応答: 「私では分かりません」は本人応答として扱わない", () => {
  const call = new Call();
  const r = call.say("私では分かりません");
  assert.notEqual(r.utterance, VOICE_LINES.overview.text, "決裁権なしを本人応答と誤判定している");
  assert.equal(r.utterance, VOICE_LINES.r7Absent.text);
});
