/**
 * web/ を配信するだけの静的サーバ。
 * オフラインで動かすため外部依存は使わず node:http だけで書いている。
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("web");
const PORT = Number(process.env.PORT ?? 8080);
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

http
  .createServer((req, res) => {
    const url = (req.url ?? "/").split("?")[0] ?? "/";
    const rel = url === "/" ? "index.html" : decodeURIComponent(url).replace(/^\/+/, "");
    const file = path.join(ROOT, rel);
    // ディレクトリトラバーサル防止
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
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
