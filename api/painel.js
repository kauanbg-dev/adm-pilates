import "../lib/env.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gateSigningSecret, isValidAccessSecret } from "../lib/accounts.js";
import { GATE_COOKIE, gateCookieHeader, parseCookie, readGate, secretsEqual, signGate } from "../lib/auth.js";
import { isPlaceholderSecret } from "../lib/sanitize.js";
import { sessionSecret } from "../lib/store.js";

const panelRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function dataDir() {
  const local = path.join(panelRoot, "data");
  const repo = path.join(panelRoot, "..", "data");
  return fs.existsSync(local) ? local : repo;
}

function fileAccessKey() {
  try {
    const file = path.join(dataDir(), "access.key");
    if (!fs.existsSync(file)) return "";
    const key = fs.readFileSync(file, "utf8").trim();
    if (!key || isPlaceholderSecret(key)) return "";
    return key;
  } catch {
    return "";
  }
}

function accessKey() {
  return gateSigningSecret() || fileAccessKey();
}

function allowedAccess(offered) {
  if (isValidAccessSecret(offered)) return true;
  const fileKey = fileAccessKey();
  return Boolean(fileKey) && secretsEqual(String(offered || "").trim(), fileKey);
}

function send404(res) {
  const fallback = path.join(panelRoot, "404.html");
  const html = fs.existsSync(fallback)
    ? fs.readFileSync(fallback)
    : Buffer.from("Não encontrado.", "utf8");
  res.writeHead(404, { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" });
  res.end(html);
}

function sendGateForm(res, invalid = false) {
  const msg = invalid
    ? "<p>Código ou senha inválidos.</p>"
    : "<p>Use o código do estúdio ou a senha de acesso da Bia ou do Alex.</p>";
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Acesso</title>
    <style>
      body { font-family: Outfit, system-ui, sans-serif; background: #f8f6f2; color: #222; margin: 0; min-height: 100vh; display: grid; place-items: center; }
      form { background: #fff; padding: 1.6rem; border-radius: 16px; width: min(360px, calc(100% - 2rem)); box-shadow: 0 18px 40px rgba(15,104,100,.12); }
      label { display: grid; gap: .4rem; font-size: .95rem; }
      input { font: inherit; padding: .75rem .85rem; border-radius: 10px; border: 1px solid rgba(15,104,100,.16); }
      button { margin-top: 1rem; width: 100%; border: 0; border-radius: 999px; padding: .8rem 1rem; background: #148882; color: #fff; font: inherit; cursor: pointer; }
      p { margin: 0 0 1rem; color: #5b5b5b; }
    </style>
  </head>
  <body>
    <form method="post" action="/admin.html">
      ${msg}
      <label>Senha de acesso <input type="password" name="k" required autocomplete="off" /></label>
      <button type="submit">Entrar</button>
    </form>
  </body>
</html>`;
  res.writeHead(401, {
    "Content-Type": "text/html; charset=utf-8",
    "X-Robots-Tag": "noindex, nofollow",
    "Cache-Control": "no-store",
  });
  res.end(html);
}

async function readBody(req) {
  if (req.body != null) {
    if (typeof req.body === "string") return req.body;
    if (typeof req.body === "object") return req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function keyFromBody(body) {
  if (!body) return "";
  if (typeof body === "object") return String(body.k || body.acesso || "");
  try {
    return new URLSearchParams(String(body)).get("k") || "";
  } catch {
    return "";
  }
}

function serveAdmin(res, setGateCookie = false) {
  const page = path.join(panelRoot, "admin.html");
  if (!fs.existsSync(page)) {
    send404(res);
    return;
  }
  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    "X-Robots-Tag": "noindex, nofollow",
    "Cache-Control": "no-store",
  };
  if (setGateCookie) {
    headers["Set-Cookie"] = gateCookieHeader(signGate(sessionSecret(), accessKey()));
  }
  res.writeHead(200, headers);
  res.end(fs.readFileSync(page));
}

function redirectClean(res) {
  res.writeHead(303, {
    Location: "/admin.html",
    "Set-Cookie": gateCookieHeader(signGate(sessionSecret(), accessKey())),
    "Cache-Control": "no-store",
  });
  res.end();
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://127.0.0.1");
  const key = accessKey();
  if (!key) {
    send404(res);
    return;
  }

  const token = parseCookie(req.headers.cookie || "", GATE_COOKIE);
  if (readGate(token, sessionSecret(), key)) {
    serveAdmin(res);
    return;
  }

  if (req.method === "POST") {
    const offered = keyFromBody(await readBody(req));
    if (allowedAccess(offered)) {
      redirectClean(res);
      return;
    }
    sendGateForm(res, true);
    return;
  }

  const offered = url.searchParams.get("k") || url.searchParams.get("acesso") || "";
  if (allowedAccess(offered)) {
    redirectClean(res);
    return;
  }

  sendGateForm(res, Boolean(offered));
}
