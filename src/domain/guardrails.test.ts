import { test } from "node:test";
import assert from "node:assert/strict";
import { detectGuardrails } from "./guardrails.js";

test("R1: 「制度はない」をホットサインとして検知する", () => {
  assert.ok(detectGuardrails("うち退職金制度はないんですよ").includes("R1"));
  assert.ok(detectGuardrails("これから考えようと思ってました").includes("R1"));
});

test("R2: 多忙を検知する", () => {
  assert.ok(detectGuardrails("今週バタバタしてまして").includes("R2"));
});

test("R3: 専門家に任せているを検知する", () => {
  assert.ok(detectGuardrails("そのへんは顧問税理士に任せているので").includes("R3"));
});

test("R4: 資料送付要求を検知する", () => {
  assert.ok(detectGuardrails("とりあえず資料だけ送ってください").includes("R4"));
});

test("R5: 公的機関との誤認を検知する", () => {
  assert.ok(detectGuardrails("お国がやるなら手数料もかからんでしょう").includes("R5"));
});

test("R7: 決裁者不在を検知する", () => {
  assert.ok(detectGuardrails("代表は外出しております").includes("R7"));
});
