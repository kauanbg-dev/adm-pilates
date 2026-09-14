import "../lib/env.js";
import { cookieHeader, parseCookie, readSession, signSession, verifyPassword } from "../lib/auth.js";
import { mergeStudioWrite, studioForClient } from "../lib/permissions.js";
import { findUser, initStore, loadStudio, saveStudio, sessionSecret } from "../lib/store.js";

const loginHits = new Map();

function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return fwd || req.socket?.remoteAddress || "unknown";
}

function loginLimited(ip) {
  const now = Date.now();
  const rec = loginHits.get(ip) || { n: 0, start: now };
  if (now - rec.start > 15 * 60 * 1000) {
    rec.n = 0;
    rec.start = now;
  }
  rec.n += 1;
  loginHits.set(ip, rec);
  return rec.n > 20;
}

async function readJson(req) {
  if (req.body) {
    if (typeof req.body === "string") return req.body ? JSON.parse(req.body) : {};
    return req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

function send(res, status, body, extraHeaders = {}) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  res.end(json);
}

async function currentUser(req) {
  await initStore();
  const token = parseCookie(req.headers.cookie || "");
  const email = readSession(token, sessionSecret());
  if (!email) return null;
  const user = await findUser(email);
  if (!user) return null;
  return { name: user.name, email: user.email, role: user.role };
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://127.0.0.1");
  const path = url.pathname.replace(/\/$/, "") || "/";

  try {
    if (path === "/api/login" && req.method === "POST") {
      if (loginLimited(clientIp(req))) {
        send(res, 429, { error: "Muitas tentativas. Espere alguns minutos." });
        return;
      }
      await initStore();
      const body = await readJson(req);
      const user = await findUser(String(body.email || ""));
      if (!user || !verifyPassword(String(body.password || ""), user.salt, user.passwordHash)) {
        send(res, 401, { error: "E-mail ou senha incorretos." });
        return;
      }
      const token = signSession(user.email, sessionSecret());
      send(res, 200, { user: { name: user.name, email: user.email, role: user.role } }, { "Set-Cookie": cookieHeader(token) });
      return;
    }

    if (path === "/api/logout" && req.method === "POST") {
      send(res, 200, { ok: true }, { "Set-Cookie": cookieHeader("", true) });
      return;
    }

    if (path === "/api/me" && req.method === "GET") {
      const user = await currentUser(req);
      if (!user) {
        send(res, 401, { error: "Faça login." });
        return;
      }
      send(res, 200, { user });
      return;
    }

    if (path === "/api/studio" && req.method === "GET") {
      const user = await currentUser(req);
      if (!user) {
        send(res, 401, { error: "Faça login." });
        return;
      }
      send(res, 200, { studio: studioForClient(await loadStudio(), user) });
      return;
    }

    if (path === "/api/studio" && req.method === "PUT") {
      const user = await currentUser(req);
      if (!user) {
        send(res, 401, { error: "Faça login." });
        return;
      }
      const body = await readJson(req);
      if (!body.studio || typeof body.studio !== "object") {
        send(res, 400, { error: "Dados inválidos." });
        return;
      }
      const current = await loadStudio();
      await saveStudio(mergeStudioWrite(body.studio, current, user));
      send(res, 200, { ok: true });
      return;
    }

    send(res, 404, { error: "Não encontrado." });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: "Erro interno." });
  }
}
