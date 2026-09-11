import { test } from "node:test";
import assert from "node:assert/strict";
import { bulkExtract, DialogEngine, GUARDRAIL_LINE, type DialogReply } from "./dialogEngine.js";
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

// ---------- 想定外発話のフォールバック ----------

test("想定外の発話でも読み上げに落とさず、録音で会話を立て直す", () => {
  const { dialog } = fresh();
  dialog.greeting();
  dialog.respond("少々お待ちください、代わります"); // → 概要(P1)
  const asked = dialog.respond("はい、代表の中村です"); // → 年齢層・人数(P3)
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
  const again = dialog.respond("あ、戻ってきました、代わります");
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
