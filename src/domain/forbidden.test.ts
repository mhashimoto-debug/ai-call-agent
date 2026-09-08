import { test } from "node:test";
import assert from "node:assert/strict";
import { autoFix, checkForbidden } from "./forbidden.js";
import { PHASES } from "./phases.js";

test("F1: 社会保険料の断定を検知する", () => {
  const v = checkForbidden("社会保険料が下がりますので手取りが増えます。");
  assert.equal(v.length, 1);
  assert.equal(v[0]?.ruleId, "F1");
});

test("F1: 「下がる場合があります」は違反にしない", () => {
  assert.deepEqual(checkForbidden("社会保険料が下がる場合があります。"), []);
});

test("F1: 「削減になります」を自動修正できる", () => {
  const { text, applied } = autoFix("社会保険料の削減になります。");
  assert.ok(applied.includes("F1"));
  assert.deepEqual(checkForbidden(text), []);
});

test("F2: 元本保証を検知する", () => {
  assert.equal(checkForbidden("元本保証ですのでご安心ください。")[0]?.ruleId, "F2");
});

test("F3: 利回りの断定は代替なしで検知する", () => {
  const v = checkForbidden("必ず10%で運用できます。");
  assert.equal(v[0]?.ruleId, "F3");
  assert.equal(v[0]?.alternative, null);
});

test("F4: 提携先の固有名を自動で伏せる", () => {
  const { text } = autoFix("岡三証券で運用します。");
  assert.match(text, /提携先の金融機関/);
  assert.deepEqual(checkForbidden(text), []);
});

test("F5: 厚労省を単独で名乗ると違反、立場を添えれば通る", () => {
  assert.equal(checkForbidden("厚生労働省が管轄する制度のご案内です。")[0]?.ruleId, "F5");
  assert.deepEqual(
    checkForbidden("制度は厚生労働省の管轄で、私どもは民間の導入支援事業者です。"),
    [],
  );
});

test("設計書の必須発話はすべてフィルタを通過する", () => {
  for (const phase of Object.values(PHASES)) {
    const text = phase.mustSay.join("");
    if (!text) continue;
    assert.deepEqual(
      checkForbidden(text),
      [],
      `${phase.id} の必須発話が禁止ワードフィルタに抵触しています`,
    );
  }
});

test("F6: 担当者の個人名を名乗ると検知し、団体名のみに自動修正する", () => {
  const raw = "一般社団法人企業型確定拠出年金相談センターの佐藤と申します。";
  assert.equal(checkForbidden(raw)[0]?.ruleId, "F6");
  const { text } = autoFix(raw);
  assert.equal(text, "一般社団法人企業型確定拠出年金相談センターと申します。");
  assert.deepEqual(checkForbidden(text), []);
});

test("F6: 団体名だけの名乗りは違反にしない", () => {
  assert.deepEqual(
    checkForbidden("一般社団法人企業型確定拠出年金相談センターと申します。"),
    [],
  );
});

test("発話スクリプトに個人名が残っていない", () => {
  for (const phase of Object.values(PHASES)) {
    for (const line of [...phase.mustSay, ...phase.conditional.map((c) => c.say)]) {
      assert.doesNotMatch(line, /佐藤|◯◯|××/, `${phase.id}: ${line}`);
    }
  }
});
