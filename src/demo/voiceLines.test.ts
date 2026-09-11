import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AUDIO_BASE, PHRASES, UNRECORDED, VOICE_LINES, audioUrl, clip, filterSegment } from "./voiceLines.js";
import { autoFix, checkForbidden } from "../domain/forbidden.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ALL_LINES = Object.entries({ ...VOICE_LINES, ...PHRASES });
const recorded = (file: string): boolean => fs.existsSync(path.join(REPO, AUDIO_BASE, file));

test("台本は出力前フィルタで書き換えられない（表示テキストと音声が食い違わない）", () => {
  for (const [id, line] of ALL_LINES) {
    assert.equal(autoFix(line.text).text, line.text, `${id} が自動修正で書き換わる`);
    assert.deepEqual(checkForbidden(line.text), [], `${id} に禁止表現がある`);
  }
});

test("録音ファイルは public/audio/ に実在する（未収録として登録したものを除く）", () => {
  for (const [id, line] of ALL_LINES) {
    if (UNRECORDED.has(line.file)) {
      assert.ok(
        !recorded(line.file),
        `${id}: ${line.file} は収録済みです。voiceLines.ts の UNRECORDED から外してください`,
      );
    } else {
      assert.ok(recorded(line.file), `${id}: ${line.file} が public/audio/ に無い`);
    }
  }
});

test("未収録リストには台本で使っているファイル名だけが入っている（打ち間違いの検出）", () => {
  const files = new Set<string>(ALL_LINES.map(([, line]) => line.file));
  for (const file of UNRECORDED) {
    assert.ok(files.has(file), `UNRECORDED の ${file} はどの台本でも使われていない`);
  }
});

test("1つの録音ファイルを複数の台本で使い回していない", () => {
  const seen = new Map<string, string>();
  for (const [id, line] of ALL_LINES) {
    const other = seen.get(line.file);
    assert.equal(other, undefined, `${line.file} が ${other} と ${id} で重複している`);
    seen.set(line.file, id);
  }
});

test("収録済みの台本には録音が付き、未収録の台本は音声合成になる", () => {
  assert.deepEqual(clip(VOICE_LINES.greeting), {
    text: VOICE_LINES.greeting.text,
    audioFile: audioUrl("p0_greeting.mp3"),
  });
  const pending = Object.values(PHRASES).find((line) => UNRECORDED.has(line.file));
  if (pending) assert.deepEqual(clip(pending), { text: pending.text });
});

test("出力前フィルタで書き換わった区間は録音を外して読み上げる（禁止表現を録音のまま流さない）", () => {
  const fixed = filterSegment({ text: "社会保険料が下がります。", audioFile: audioUrl("x.mp3") });
  assert.deepEqual(fixed, { text: "社会保険料が下がる場合があります。" });

  const clean = { text: "問題のない文です。", audioFile: audioUrl("y.mp3") };
  assert.equal(filterSegment(clean), clean);
});
