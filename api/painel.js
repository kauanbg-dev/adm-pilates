import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GATE_COOKIE, gateCookieHeader, parseCookie, readGate, secretsEqual, signGate } from "../lib/auth.js";
import { sessionSecret } from "../lib/store.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function accessKey() {
  if (process.env.ADMIN_ACCESS_KEY) return process.env.ADMIN_ACCESS_KEY.trim();
  const file = path.join(root, "data", "access.key");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();
  return "";
}

function send404(res) {
  const fallback = path.join(root, "404.html");
  const html = fs.existsSync(fallback)
    ? fs.readFileSync(fallback)
    : Buffer.from("Não encontrado.", "utf8");
  res.writeHead(404, { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" });
  res.end(html);
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://127.0.0.1");
  const key = accessKey();
  if (!key) {
    send404(res);
    return;
  }
  const offered = url.searchParams.get("k") || url.searchParams.get("acesso") || "";
  const token = parseCookie(req.headers.cookie || "", GATE_COOKIE);
  const allowed = secretsEqual(offered, key) || readGate(token, sessionSecret(), key);
  if (!allowed) {
    send404(res);
    return;
  }
  const page = path.join(root, "admin.html");
  if (!fs.existsSync(page)) {
    send404(res);
    return;
  }
  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    "X-Robots-Tag": "noindex, nofollow",
    "Cache-Control": "no-store",
  };
  if (secretsEqual(offered, key)) {
    headers["Set-Cookie"] = gateCookieHeader(signGate(sessionSecret(), key));
  }
  res.writeHead(200, headers);
  res.end(fs.readFileSync(page));
}
