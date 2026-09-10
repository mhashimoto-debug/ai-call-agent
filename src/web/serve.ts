/**
 * web/ を配信するだけの静的サーバ。
 * オフラインで動かすため外部依存は使わず node:http だけで書いている。
 *
 * 録音（public/audio/*.mp3）はリポジトリ直下に置いてあり web/ には複製しないので、
 * web/ に無いパスはリポジトリ直下の public/ を見に行く。
 * GitHub Pages（リポジトリ直下を公開）では同じ相対パスがそのまま解決される。
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("web");
const REPO = path.resolve(".");
const PORT = Number(process.env.PORT ?? 8080);
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

const isFile = (p: string): boolean => fs.existsSync(p) && fs.statSync(p).isFile();

/** web/ を優先し、無ければリポジトリ直下の public/ から探す。 */
function resolveFile(rel: string): string | null {
  const inWeb = path.join(ROOT, rel);
  if (inWeb.startsWith(ROOT) && isFile(inWeb)) return inWeb;
  const publicDir = path.join(REPO, "public");
  const inPublic = path.join(REPO, rel);
  if (inPublic.startsWith(publicDir) && isFile(inPublic)) return inPublic;
  return null;
}

http
  .createServer((req, res) => {
    const url = (req.url ?? "/").split("?")[0] ?? "/";
    const rel = url === "/" ? "index.html" : decodeURIComponent(url).replace(/^\/+/, "");
    // ディレクトリトラバーサル防止は resolveFile 側で行う
    const file = resolveFile(rel);
    if (!file) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("404");
      return;
    }
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => {
    console.log(`\n  Web プロトタイプ: http://localhost:${PORT}\n  停止: Ctrl+C\n`);
  });
