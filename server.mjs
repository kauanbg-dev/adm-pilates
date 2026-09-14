import "./lib/env.js";
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import handler from "./api/index.js";
import painel from "./api/painel.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8780);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (url.pathname === "/admin.html" || url.pathname === "/painel") {
    await painel(req, res);
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    await handler(req, res);
    return;
  }
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
  const n = rel.replace(/\\/g, "/").toLowerCase();
  const blocked =
    n === "data" ||
    n.startsWith("data/") ||
    n.startsWith(".env") ||
    n.startsWith(".git") ||
    n === "lib" ||
    n.startsWith("lib/") ||
    /\.(ps1|sql)$/i.test(n);
  const full = path.normalize(path.join(root, rel));
  if (!full.startsWith(root) || blocked) {
    res.writeHead(blocked ? 404 : 403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Não encontrado.");
    return;
  }
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Não encontrado.");
    return;
  }
  const ext = path.extname(full).toLowerCase();
  res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
  fs.createReadStream(full).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Site em http://127.0.0.1:${port}/`);
  console.log(`Painel: http://127.0.0.1:${port}/admin.html`);
});
