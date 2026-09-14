import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword, newSalt } from "./auth.js";
import { normalizeStudio, seedStudio } from "./seed.js";
import { STAFF_ROLE } from "./permissions.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const panelRoot = path.join(here, "..");
const dataDir = fs.existsSync(path.join(panelRoot, "data"))
  ? path.join(panelRoot, "data")
  : path.join(panelRoot, "..", "data");
const studioFile = path.join(dataDir, "studio.json");
const usersFile = path.join(dataDir, "users.json");
const secretFile = path.join(dataDir, "session.secret");

function ensureDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

export function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
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
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("Defina ADMIN_PASSWORD no ambiente (Vercel ou arquivo .env).");
  }
  return password;
}

function staffAccount() {
  return {
    email: (process.env.ALEX_EMAIL || "alex@pratiquepilates.com").toLowerCase(),
    name: "Alex",
    role: STAFF_ROLE,
    password: process.env.ALEX_PASSWORD || "",
  };
}

function withStaffUser(users) {
  const staff = staffAccount();
  if (users.some((u) => u.email === staff.email)) return users;
  if (!staff.password) return users;
  const salt = newSalt();
  return users.concat({
    email: staff.email,
    name: staff.name,
    role: staff.role,
    passwordHash: hashPassword(staff.password, salt),
    salt,
  });
}

export async function initStore() {
  const sql = await postgres();
  const email = (process.env.ADMIN_EMAIL || "bia@pratiquepilates.com").toLowerCase();
  const password = adminPassword();
  const salt = newSalt();
  const passwordHash = hashPassword(password, salt);
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
    const users = await sql`SELECT email FROM users LIMIT 1`;
    if (!users.length) {
      await sql`INSERT INTO users (email, name, role, password_hash, salt)
        VALUES (${email}, ${"Bia"}, ${"admin"}, ${passwordHash}, ${salt})`;
      await sql`INSERT INTO users (email, name, role, password_hash, salt)
        VALUES (${"admin@pratiquepilates.com"}, ${"Bia"}, ${"admin"}, ${passwordHash}, ${salt})
        ON CONFLICT (email) DO NOTHING`;
    }
    const staff = staffAccount();
    if (staff.password) {
      const staffSalt = newSalt();
      const staffHash = hashPassword(staff.password, staffSalt);
      await sql`INSERT INTO users (email, name, role, password_hash, salt)
        VALUES (${staff.email}, ${staff.name}, ${staff.role}, ${staffHash}, ${staffSalt})
        ON CONFLICT (email) DO NOTHING`;
    }
    const rows = await sql`SELECT id FROM studio WHERE id = 1`;
    if (!rows.length) {
      await sql`INSERT INTO studio (id, payload) VALUES (1, ${JSON.stringify(studio)})`;
    }
    return;
  }

  if (process.env.VERCEL) {
    throw new Error("Configure DATABASE_URL (Neon) para gravar o banco na Vercel.");
  }

  ensureDir();
  if (!fs.existsSync(usersFile)) {
    const users = withStaffUser([
      { email, name: "Bia", role: "admin", passwordHash, salt },
      { email: "admin@pratiquepilates.com", name: "Bia", role: "admin", passwordHash, salt },
    ]);
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), "utf8");
  } else {
    const users = withStaffUser(JSON.parse(fs.readFileSync(usersFile, "utf8")));
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), "utf8");
  }
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
  const users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
  return users.find((u) => u.email === key) || null;
}

export async function loadStudio() {
  const sql = await postgres();
  if (sql) {
    const rows = await sql`SELECT payload FROM studio WHERE id = 1`;
    return normalizeStudio(rows[0]?.payload || seedStudio());
  }
  return normalizeStudio(JSON.parse(fs.readFileSync(studioFile, "utf8")));
}

export async function saveStudio(studio) {
  const payload = normalizeStudio(studio);
  const sql = await postgres();
  if (sql) {
    await sql`UPDATE studio SET payload = ${JSON.stringify(payload)} WHERE id = 1`;
    return;
  }
  fs.writeFileSync(studioFile, JSON.stringify(payload, null, 2), "utf8");
}
