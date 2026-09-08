import { test } from "node:test";
import assert from "node:assert/strict";
import { applyExtracted, canLeaveHearing, createCallState, resolveTransition } from "./state.js";
import { evaluateDod } from "./dod.js";

const ALL_HEARING = {
  H1: "なし",
  H2: "保険のみ",
  H3: "56歳",
  H4: "2名",
  H5: "10名",
  H6: "代表決裁",
  H7: "3月",
} as const;

test("ヒアリング未充足なら P8 → P9 をブロックする", () => {
  const s = createCallState();
  s.phase = "P8";
  applyExtracted(s, { ...ALL_HEARING, H5: null }); // 社保人数だけ欠落
  const r = resolveTransition(s, "P9", [], []);
  assert.equal(r.phase, "P8");
  assert.match(r.overrideReason ?? "", /H5/);
});

test("7項目＋連絡先が揃えば P9 へ進める", () => {
  const s = createCallState();
  s.phase = "P8";
  applyExtracted(s, {
    ...ALL_HEARING,
    email: "a@b.jp",
    email_confirmed: true,
    callback_phone: "090-0000-0000",
    callback_window: "午前中",
  });
  assert.ok(canLeaveHearing(s));
  assert.equal(resolveTransition(s, "P9", [], []).phase, "P9");
});

test("メール復唱が未実施なら P9 へ進めない", () => {
  const s = createCallState();
  s.phase = "P8";
  applyExtracted(s, {
    ...ALL_HEARING,
    email: "a@b.jp",
    callback_phone: "090-0000-0000",
    callback_window: "午前中",
  });
  assert.equal(resolveTransition(s, "P9", [], []).phase, "P8");
});

test("許可されていないフェーズ跳躍は却下される", () => {
  const s = createCallState(); // P0
  const r = resolveTransition(s, "P7", [], []);
  assert.equal(r.phase, "P0");
});

test("R1 発火中は終話できない（取りこぼし防止）", () => {
  const s = createCallState();
  s.phase = "P2";
  const r = resolveTransition(s, "END", ["R1"], ["R1", "R3", "R4", "R5"]);
  assert.equal(r.phase, "P2");
});

test("取得済みの値は null で上書きされない", () => {
  const s = createCallState();
  applyExtracted(s, { H5: "10名" });
  applyExtracted(s, { H5: null });
  assert.equal(s.hearing.H5, "10名");
});

test("DoD は全項目が揃ったときだけ成立する", () => {
  const s = createCallState();
  assert.equal(evaluateDod(s).passed, false);
  applyExtracted(s, {
    ...ALL_HEARING,
    email: "a@b.jp",
    email_confirmed: true,
    callback_phone: "090-0000-0000",
    callback_window: "午前中",
    appointment_date: "9月17日（水）",
    appointment_time: "14時",
    zoom_agreed: true,
    duration_agreed: true,
    calendar_requested: true,
  });
  const dod = evaluateDod(s);
  assert.equal(dod.passed, true, JSON.stringify(dod.items.filter((i) => !i.ok)));
  assert.equal(dod.hearingCoverage, 1);
});
