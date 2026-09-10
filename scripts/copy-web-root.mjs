/**
 * GitHub Pages 用に web/ の成果物をリポジトリ直下へコピーする。
 * Pages を「main ブランチの / (root)」で公開したとき、
 * https://<user>.github.io/<repo>/ が 404 にならないようにするための処理。
 * 正となるソースは web/ 側。直下のファイルは生成物なので直接編集しないこと。
 *
 * ここでやっていること:
 *   1. web/index.html と web/app.js を直下へコピーする
 *   2. 直下の index.html だけ <script src="./app.js?v=ハッシュ"> に書き換える
 *      （Pages は max-age を付けて配信するため、指定が無いと古いバンドルが使われ続ける）
 *   3. 収録音声がすべてバンドルから参照されているか検査する
 *      （古いバンドルを配ってしまう事故をビルド時に落とすため）
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB = path.join(ROOT, "web");
const AUDIO_DIR = path.join(ROOT, "public", "audio");

// --- app.js をコピーし、内容からバージョンを作る ---
const bundle = fs.readFileSync(path.join(WEB, "app.js"));
fs.writeFileSync(path.join(ROOT, "app.js"), bundle);
const version = crypto.createHash("sha256").update(bundle).digest("hex").slice(0, 10);
console.log(`copied web/app.js -> app.js (v=${version})`);

// --- 収録音声がすべてバンドルから参照されているか検査する ---
const bundleText = bundle.toString("utf8");
const audioFiles = fs.existsSync(AUDIO_DIR)
  ? fs.readdirSync(AUDIO_DIR).filter((f) => f.endsWith(".mp3"))
  : [];
const unreferenced = audioFiles.filter((f) => !bundleText.includes(f));
if (audioFiles.length === 0) {
  console.warn("warning: public/audio/ に MP3 がありません");
} else if (unreferenced.length > 0) {
  console.error(
    `error: バンドルから参照されていない録音があります: ${unreferenced.join(", ")}\n` +
      "  台本（VOICE_LINES）と public/audio/ の対応を確認してください。",
  );
  process.exit(1);
} else {
  console.log(`checked: 録音 ${audioFiles.length} 本すべてがバンドルから参照されています`);
}

// --- index.html はキャッシュ避けのクエリを付けてコピーする ---
const html = fs.readFileSync(path.join(WEB, "index.html"), "utf8");
const versioned = html.replace(
  /(<script\s+src=")(\.\/)?app\.js(\?v=[0-9a-f]+)?(")/,
  `$1./app.js?v=${version}$4`,
);
if (versioned === html) {
  console.error("error: index.html の <script src=\"./app.js\"> が見つかりませんでした");
  process.exit(1);
}
fs.writeFileSync(path.join(ROOT, "index.html"), versioned);
console.log(`copied web/index.html -> index.html (app.js?v=${version})`);

// Jekyll の処理を無効化（_ 始まりのファイルが無視されるのを防ぐ）
fs.writeFileSync(path.join(ROOT, ".nojekyll"), "");
