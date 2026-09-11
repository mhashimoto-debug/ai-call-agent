/**
 * 発話完了（話し終わり）の判定。
 * 手で進める時計を渡して、「文の途中の間では確定しない」「話し終えたら確定する」を確認する。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTINUATION_EXTRA_MS,
  EndpointDetector,
  SILENCE_TIMEOUT_MS,
  endsWithContinuation,
  silenceWaitMs,
  type Scheduler,
} from "./endpoint.js";

/** 手で進める時計。 */
function fakeClock(): { scheduler: Scheduler; advance: (ms: number) => void } {
  let now = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const scheduler: Scheduler = {
    set: (fn, ms) => {
      const id = ++seq;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clear: (handle) => void timers.delete(handle as number),
  };
  const advance = (ms: number): void => {
    const target = now + ms;
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, t]) => t.at <= target)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].fn();
    }
    now = target;
  };
  return { scheduler, advance };
}

function detector(): { done: string[]; ep: EndpointDetector; advance: (ms: number) => void } {
  const clock = fakeClock();
  const done: string[] = [];
  const ep = new EndpointDetector((text) => done.push(text), clock.scheduler);
  return { done, ep, advance: clock.advance };
}

// ---------- 閾値 ----------

test("話し終わりとみなす無音は 1.2〜1.5 秒", () => {
  assert.ok(SILENCE_TIMEOUT_MS >= 1200 && SILENCE_TIMEOUT_MS <= 1500, `${SILENCE_TIMEOUT_MS}ms`);
  assert.equal(silenceWaitMs("決算は3月です"), SILENCE_TIMEOUT_MS);
});

// ---------- 続きがありそうな切れ方 ----------

const CONTINUATIONS = [
  "決算月は3月で",
  "決算は3月でして",
  "社員は10人ですが",
  "人数は把握してますけど",
  "今週はバタバタしてるから",
  "役員は私と",
  "パートを除いて",
  "えーっと",
  "メールは nakamura アット",
  "決算月は3月で、",
  "そうですね…",
  "決算月は3月でー",
];

for (const text of CONTINUATIONS) {
  test(`続きがありそうな切れ方: 「${text}」は追加で待つ`, () => {
    assert.ok(endsWithContinuation(text), "続きがある切れ方として判定されない");
    assert.equal(silenceWaitMs(text), SILENCE_TIMEOUT_MS + CONTINUATION_EXTRA_MS);
  });
}

const COMPLETE = [
  "決算は3月です",
  "はい",
  "大丈夫です",
  "お願いします",
  "20人くらいです",
  "090-1234-5678 です",
  "よろしくお願いいたします。",
  "何の件ですか？",
  "",
];

for (const text of COMPLETE) {
  test(`言い切った発話: 「${text}」は追加で待たない`, () => {
    assert.ok(!endsWithContinuation(text), "言い切った発話を続きありと判定している");
  });
}

// ---------- 無音待ち ----------

test("「決算月は3月で…」の間では確定せず、続きを話し終えてから確定する（発話被りを起こさない）", () => {
  const { done, ep, advance } = detector();
  ep.feed("決算月は");
  advance(400);
  ep.feed("決算月は3月で");
  // 通常の無音待ちの長さだけ間が空いても、まだ確定しない
  advance(SILENCE_TIMEOUT_MS);
  assert.deepEqual(done, [], "文の途中の間で話し終わりと判定している");

  // 間のあとに続きを話す
  advance(500);
  ep.feed("決算月は3月で、メールは nakamura@example.co.jp です");
  advance(SILENCE_TIMEOUT_MS - 1);
  assert.deepEqual(done, [], "話し終わる前に確定している");
  advance(1);
  assert.deepEqual(done, ["決算月は3月で、メールは nakamura@example.co.jp です"]);
});

test("言い切った発話は、無音が閾値に達した時点で確定する", () => {
  const { done, ep, advance } = detector();
  ep.feed("はい、大丈夫です");
  advance(SILENCE_TIMEOUT_MS - 1);
  assert.deepEqual(done, []);
  advance(1);
  assert.deepEqual(done, ["はい、大丈夫です"]);
});

test("続きがありそうな切れ方のまま話が続かなければ、追加の待機のあとに確定する", () => {
  const { done, ep, advance } = detector();
  ep.feed("決算月は3月で");
  advance(SILENCE_TIMEOUT_MS + CONTINUATION_EXTRA_MS - 1);
  assert.deepEqual(done, []);
  advance(1);
  assert.deepEqual(done, ["決算月は3月で"]);
});

test("話し続けている間（認識結果が届き続ける間）は確定しない", () => {
  const { done, ep, advance } = detector();
  let heard = "";
  for (const chunk of ["社会保険は", "パートを", "除いて", "10名", "くらいです"]) {
    heard += chunk;
    ep.feed(heard);
    advance(800);
  }
  assert.deepEqual(done, []);
  advance(SILENCE_TIMEOUT_MS);
  assert.deepEqual(done, ["社会保険はパートを除いて10名くらいです"]);
});

test("手動で確定・破棄したら、無音待ちの通知は出さない", () => {
  const { done, ep, advance } = detector();
  ep.feed("決算は3月です");
  ep.cancel();
  advance(10_000);
  assert.deepEqual(done, []);

  ep.feed("");
  advance(10_000);
  assert.deepEqual(done, [], "空の結果で話し終わりを通知している");
});
