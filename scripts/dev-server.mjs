import "../lib/env.js";
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import handler from "../api/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
  if (url.pathname === "/painel") {
    res.writeHead(303, { Location: "/admin.html", "Cache-Control": "no-store" });
    res.end();
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
  const headers = { "Content-Type": types[ext] || "application/octet-stream" };
  if (n === "admin.html") {
    headers["X-Robots-Tag"] = "noindex, nofollow";
    headers["Cache-Control"] = "no-store";
  }
  res.writeHead(200, headers);
  fs.createReadStream(full).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Site em http://127.0.0.1:${port}/`);
  console.log(`Painel: http://127.0.0.1:${port}/admin.html`);
});
