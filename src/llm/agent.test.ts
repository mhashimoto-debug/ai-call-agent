import { test } from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { CallAgent } from "./agent.js";
import { createCallState } from "../domain/state.js";
import type { TurnOutput } from "./schema.js";

function emptyExtracted(): TurnOutput["extracted"] {
  return {
    H1: null, H2: null, H3: null, H4: null, H5: null, H6: null, H7: null,
    email: null, email_confirmed: false, callback_phone: null, callback_window: null,
    appointment_date: null, appointment_time: null, zoom_agreed: false,
    duration_agreed: false, calendar_requested: false, law_change_hook_used: false,
  };
}

/** parse() の呼び出し内容を記録し、指定した出力を順に返すスタブ。 */
function stubClient(outputs: TurnOutput[]) {
  const calls: any[] = [];
  let i = 0;
  const client = {
    messages: {
      parse: async (body: any) => {
        calls.push(body);
        const parsed = outputs[Math.min(i++, outputs.length - 1)];
        return { stop_reason: "end_turn", parsed_output: parsed };
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

function output(over: Partial<TurnOutput>): TurnOutput {
  return {
    utterance: "こんにちは。",
    next_phase: "P0",
    note: "テスト",
    signals: {
      objection_type: "なし",
      guardrails_fired: [],
      is_decision_maker: "unknown",
      customer_ended_call: false,
    },
    extracted: emptyExtracted(),
    ...over,
  } as TurnOutput;
}

test("リクエストは system をキャッシュし、状態ブリーフィングを末尾の system メッセージで渡す", async () => {
  const { client, calls } = stubClient([output({})]);
  const agent = new CallAgent(undefined, client);
  await agent.respond(createCallState(), "（架電開始）");

  const body = calls[0];
  assert.equal(body.model.startsWith("claude-"), true);
  assert.equal(body.system[0].cache_control.type, "ephemeral");
  assert.equal(body.thinking.type, "adaptive");
  assert.ok(body.output_config.format);
  assert.ok(body.output_config.effort);

  const msgs = body.messages;
  assert.equal(msgs[0].role, "user", "先頭は user でなければならない");
  assert.equal(msgs.at(-1).role, "system", "状態ブリーフィングは末尾の system メッセージ");
  assert.match(msgs.at(-1).content, /現在のフェーズ: P0/);
});

test("禁止表現は相手に届く前に自動修正される", async () => {
  const { client } = stubClient([
    output({ utterance: "社会保険料の削減になりますのでお得です。", next_phase: "P0" }),
  ]);
  const agent = new CallAgent(undefined, client);
  const turn = await agent.respond(createCallState(), "（架電開始）");

  assert.match(turn.utterance, /下がる場合があります/);
  assert.doesNotMatch(turn.utterance, /削減になります/);
  assert.equal(turn.blocked[0]?.ruleId, "F1");
});

test("自動修正できない禁止表現は差し戻して再生成される", async () => {
  const { client, calls } = stubClient([
    output({ utterance: "元本保証ですのでご安心ください。" }),
    output({ utterance: "運用商品によって結果は変動いたします。" }),
  ]);
  const agent = new CallAgent(undefined, client);
  const turn = await agent.respond(createCallState(), "（架電開始）");

  assert.equal(calls.length, 2, "再生成されるはず");
  assert.match(calls[1].messages.at(-1).content, /差し戻し/);
  assert.equal(turn.utterance, "運用商品によって結果は変動いたします。");
  assert.equal(turn.usedFallback, false);
});

test("再生成しても通らなければ定型文にフォールバックする（禁止表現は絶対に出さない）", async () => {
  const { client } = stubClient([output({ utterance: "絶対もうかりますよ。" })]);
  const agent = new CallAgent(undefined, client);
  const turn = await agent.respond(createCallState(), "（架電開始）");

  assert.equal(turn.usedFallback, true);
  assert.doesNotMatch(turn.utterance, /絶対もうかり/);
  assert.match(turn.utterance, /お繋ぎいただけますでしょうか/);
});

test("ヒアリング未充足なら LLM が P9 を要求しても P8 に留まる", async () => {
  const { client } = stubClient([output({ utterance: "承知しました。", next_phase: "P9" })]);
  const agent = new CallAgent(undefined, client);
  const state = createCallState();
  state.phase = "P8";
  const turn = await agent.respond(state, "はい、大丈夫です。");

  assert.equal(state.phase, "P8");
  assert.match(turn.overrideReason ?? "", /ヒアリング未充足/);
});

test("カレンダー登録依頼は発話からも検知する", async () => {
  const { client } = stubClient([
    output({
      utterance: "9月17日14時で一旦カレンダーにご予定だけ入れておいていただけますと助かります。",
      next_phase: "P9",
    }),
  ]);
  const agent = new CallAgent(undefined, client);
  const state = createCallState();
  state.phase = "P9";
  await agent.respond(state, "はい。");
  assert.equal(state.calendarRequested, true);
});
