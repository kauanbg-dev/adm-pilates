import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

export const COOKIE = "pratique_session";
export const GATE_COOKIE = "pratique_gate";
const ITERATIONS = 100000;

export function hashPassword(password, saltB64) {
  const salt = Buffer.from(saltB64, "base64");
  return pbkdf2Sync(password, salt, ITERATIONS, 32, "sha1").toString("base64");
}

export function newSalt() {
  return randomBytes(16).toString("base64");
}

export function verifyPassword(password, saltB64, hashB64) {
  const next = Buffer.from(hashPassword(password, saltB64), "base64");
  const prev = Buffer.from(hashB64, "base64");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

export function signSession(email, secret) {
  const payload = Buffer.from(JSON.stringify({ e: email, x: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function readSession(token, secret) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data?.e || data.x < Date.now()) return null;
    return data.e;
  } catch {
    return null;
  }
}

export function parseCookie(header, name = COOKIE) {
  if (!header) return "";
  const parts = header.split(";").map((p) => p.trim());
  const hit = parts.find((p) => p.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : "";
}

export function cookieHeader(token, clear = false) {
  const secure = process.env.VERCEL || process.env.NODE_ENV === "production" ? "; Secure" : "";
  if (clear) return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`;
}

export function signGate(secret, accessKey) {
  const payload = Buffer.from(JSON.stringify({ g: 1, x: Date.now() + 30 * 24 * 60 * 60 * 1000 })).toString("base64url");
  const sig = createHmac("sha256", `${secret}:${accessKey}`).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function readGate(token, secret, accessKey) {
  if (!token || !token.includes(".") || !accessKey) return false;
  const [payload, sig] = token.split(".");
  const expected = createHmac("sha256", `${secret}:${accessKey}`).update(payload).digest("hex");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data?.g === 1 && data.x >= Date.now();
  } catch {
    return false;
  }
}

export function gateCookieHeader(token) {
  const secure = process.env.VERCEL || process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${GATE_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;
}

export function secretsEqual(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}
