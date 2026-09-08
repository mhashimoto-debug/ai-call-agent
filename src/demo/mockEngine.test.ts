import { test } from "node:test";
import assert from "node:assert/strict";
import { MockCallEngine } from "./mockEngine.js";
import { DEMO_SCRIPT } from "./customerScript.js";
import { createCallState } from "../domain/state.js";
import { evaluateDod } from "../domain/dod.js";
import { checkForbidden } from "../domain/forbidden.js";

/** CLI の dry-run と Web が共有するモック再生の回帰テスト。 */
test("台本を通しで再生すると DoD が全項目○になる", () => {
  const state = createCallState();
  const engine = new MockCallEngine(state, DEMO_SCRIPT);
  let guard = 0;
  while (!engine.finished && guard++ < 100) engine.step();

  const dod = evaluateDod(state);
  assert.equal(
    dod.passed,
    true,
    `未充足: ${dod.items.filter((i) => !i.ok).map((i) => i.label).join(", ")}`,
  );
  assert.equal(dod.hearingCoverage, 1);
  assert.equal(state.phase, "END");
});

test("モックの AI 発話は1つも禁止ワードフィルタに抵触しない", () => {
  const state = createCallState();
  const engine = new MockCallEngine(state, DEMO_SCRIPT);
  let guard = 0;
  while (!engine.finished && guard++ < 100) engine.step();

  for (const t of state.turns.filter((t) => t.speaker === "agent")) {
    assert.deepEqual(checkForbidden(t.text), [], `違反: ${t.text}`);
  }
});

test("フェーズは P0 から P9 まで設計どおりの順で進む", () => {
  const state = createCallState();
  const engine = new MockCallEngine(state, DEMO_SCRIPT);
  const seen: string[] = [];
  let guard = 0;
  while (!engine.finished && guard++ < 100) {
    const s = engine.step();
    if (s?.agent.text && seen.at(-1) !== s.agent.phase) seen.push(s.agent.phase);
  }
  assert.deepEqual(seen, ["P0", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"]);
});

test("法改正フックは会話全体で1回だけ発話される", () => {
  const state = createCallState();
  const engine = new MockCallEngine(state, DEMO_SCRIPT);
  let guard = 0;
  while (!engine.finished && guard++ < 100) engine.step();

  const hits = state.turns.filter(
    (t) => t.speaker === "agent" && /62,000円/.test(t.text),
  );
  assert.equal(hits.length, 1);
  assert.equal(state.lawChangeHookUsed, true);
});
