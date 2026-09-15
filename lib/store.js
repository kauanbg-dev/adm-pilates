import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ownerAccount, staffAccountFromEnv } from "./accounts.js";
import { hashPassword, newSalt, verifyPassword } from "./auth.js";
import { loadEnv } from "./env.js";
import { normalizeStudio, seedStudio, hasDemoRecords } from "./seed.js";
import { STAFF_ROLE } from "./permissions.js";
import { assertNotPlaceholder } from "./sanitize.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const panelRoot = path.join(here, "..");
const dataDir = process.env.VERCEL
  ? path.join("/tmp", "pratique-pilates")
  : fs.existsSync(path.join(panelRoot, "data"))
    ? path.join(panelRoot, "data")
    : path.join(panelRoot, "..", "data");
const studioFile = path.join(dataDir, "studio.json");
const usersFile = path.join(dataDir, "users.json");
const secretFile = path.join(dataDir, "session.secret");

function ensureDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

function readJsonFile(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function sessionSecret() {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) {
    assertNotPlaceholder("SESSION_SECRET", fromEnv);
    return fromEnv;
  }
  const owner = ownerAccount();
  if (owner?.password) {
    return createHmac("sha256", "pratique-session").update(`${owner.email}:${owner.password}`).digest("hex");
  }
  if (process.env.VERCEL) {
    throw new Error("Defina SESSION_SECRET ou ADMIN_PASSWORD na Vercel.");
  }
  ensureDir();
  if (!fs.existsSync(secretFile)) {
    fs.writeFileSync(secretFile, newSalt() + newSalt(), "utf8");
  }
  return fs.readFileSync(secretFile, "utf8").trim();
}

async function postgres() {
  if (!process.env.DATABASE_URL) return null;
  const { neon } = await import("@neondatabase/serverless");
  return neon(process.env.DATABASE_URL);
}

function adminPassword() {
  const owner = ownerAccount();
  if (!owner) {
    throw new Error("Defina ADMIN_PASSWORD no ambiente (Vercel ou arquivo .env).");
  }
  return owner.password;
}

function staffAccount() {
  return (
    staffAccountFromEnv() || {
      email: (process.env.ALEX_EMAIL || "alex@pratiquepilates.com").toLowerCase().trim(),
      name: "Alex",
      role: STAFF_ROLE,
      password: "",
    }
  );
}

function hashedUser({ email, name, role, password }, previous) {
  if (previous?.salt && previous?.passwordHash && verifyPassword(password, previous.salt, previous.passwordHash)) {
    return {
      email,
      name,
      role,
      passwordHash: previous.passwordHash,
      salt: previous.salt,
    };
  }
  const salt = newSalt();
  return {
    email,
    name,
    role,
    passwordHash: hashPassword(password, salt),
    salt,
  };
}

function envUsers(existing = []) {
  const email = (ownerAccount()?.email || process.env.ADMIN_EMAIL || "bia@pratiquepilates.com").toLowerCase().trim();
  const password = adminPassword();
  const byEmail = new Map(existing.map((u) => [u.email, u]));
  const users = [hashedUser({ email, name: "Bia", role: "admin", password }, byEmail.get(email))];
  if (email !== "admin@pratiquepilates.com") {
    users.push(
      hashedUser(
        { email: "admin@pratiquepilates.com", name: "Bia", role: "admin", password },
        byEmail.get("admin@pratiquepilates.com")
      )
    );
  }
  const staff = staffAccount();
  if (staff.password) {
    users.push(
      hashedUser(
        { email: staff.email, name: staff.name, role: staff.role, password: staff.password },
        byEmail.get(staff.email)
      )
    );
  }
  return users;
}

async function syncUsers(sql) {
  if (sql) {
    const existing = await sql`SELECT email, name, role, password_hash AS "passwordHash", salt FROM users`;
    const wanted = envUsers(existing);
    const keep = new Set(wanted.map((u) => u.email));
    for (const row of existing) {
      if (!keep.has(row.email)) {
        await sql`DELETE FROM users WHERE email = ${row.email}`;
      }
    }
    for (const u of wanted) {
      await sql`INSERT INTO users (email, name, role, password_hash, salt)
        VALUES (${u.email}, ${u.name}, ${u.role}, ${u.passwordHash}, ${u.salt})
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          password_hash = EXCLUDED.password_hash,
          salt = EXCLUDED.salt`;
    }
    return;
  }

  ensureDir();
  const existing = readJsonFile(usersFile, []);
  fs.writeFileSync(usersFile, JSON.stringify(envUsers(existing), null, 2), "utf8");
}

export async function initStore() {
  loadEnv({ override: true });
  const sql = await postgres();
  const studio = seedStudio();

  if (sql) {
    await sql`CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL
    )`;
    await sql`CREATE TABLE IF NOT EXISTS studio (
      id INT PRIMARY KEY CHECK (id = 1),
      payload JSONB NOT NULL
    )`;
    await syncUsers(sql);
    const rows = await sql`SELECT id FROM studio WHERE id = 1`;
    if (!rows.length) {
      await sql`INSERT INTO studio (id, payload) VALUES (1, ${JSON.stringify(studio)})`;
    }
    return;
  }

  await syncUsers(null);
  if (!fs.existsSync(studioFile)) {
    fs.writeFileSync(studioFile, JSON.stringify(studio, null, 2), "utf8");
  }
}

export async function findUser(email) {
  const key = email.trim().toLowerCase();
  const sql = await postgres();
  if (sql) {
    const rows = await sql`SELECT email, name, role, password_hash AS "passwordHash", salt FROM users WHERE email = ${key}`;
    return rows[0] || null;
  }
  const users = readJsonFile(usersFile, []);
  return users.find((u) => u.email === key) || null;
}

export async function loadStudio() {
  const sql = await postgres();
  if (sql) {
    const rows = await sql`SELECT payload FROM studio WHERE id = 1`;
    const raw = rows[0]?.payload || seedStudio();
    const next = normalizeStudio(raw);
    if (hasDemoRecords(raw)) await saveStudio(next);
    return next;
  }
  const raw = readJsonFile(studioFile, seedStudio());
  const next = normalizeStudio(raw);
  if (hasDemoRecords(raw)) await saveStudio(next);
  return next;
}

export async function saveStudio(studio) {
  const payload = normalizeStudio(studio);
  const sql = await postgres();
  if (sql) {
    await sql`UPDATE studio SET payload = ${JSON.stringify(payload)} WHERE id = 1`;
    return;
  }
  ensureDir();
  fs.writeFileSync(studioFile, JSON.stringify(payload, null, 2), "utf8");
}
