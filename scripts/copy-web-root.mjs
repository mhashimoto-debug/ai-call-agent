/**
 * GitHub Pages 用に web/ の成果物をリポジトリ直下へコピーする。
 * Pages を「main ブランチの / (root)」で公開したとき、
 * https://<user>.github.io/<repo>/ が 404 にならないようにするための処理。
 * 正となるソースは web/ 側。直下のファイルは生成物なので直接編集しないこと。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["index.html", "app.js"];

for (const name of FILES) {
  const from = path.join(ROOT, "web", name);
  const to = path.join(ROOT, name);
  fs.copyFileSync(from, to);
  console.log(`copied web/${name} -> ${name}`);
}

// Jekyll の処理を無効化（_ 始まりのファイルが無視されるのを防ぐ）
fs.writeFileSync(path.join(ROOT, ".nojekyll"), "");
