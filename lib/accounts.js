import { secretsEqual } from "./auth.js";
import { STAFF_ROLE } from "./permissions.js";
import { isPlaceholderSecret } from "./sanitize.js";

function clean(value) {
  return String(value || "").trim();
}

export function ownerAccount() {
  const email = clean(process.env.ADMIN_EMAIL || "bia@pratiquepilates.com").toLowerCase();
  const password = clean(process.env.ADMIN_PASSWORD);
  if (!password || isPlaceholderSecret(password)) return null;
  return { email, password, name: "Bia", role: "admin" };
}

export function staffAccountFromEnv() {
  const email = clean(process.env.ALEX_EMAIL || "alex@pratiquepilates.com").toLowerCase();
  const password = clean(process.env.ALEX_PASSWORD);
  if (!password || isPlaceholderSecret(password)) return null;
  return { email, password, name: "Alek", role: STAFF_ROLE };
}

export function envLoginAccounts() {
  const accounts = [];
  const owner = ownerAccount();
  if (owner) {
    accounts.push(owner);
    if (owner.email !== "admin@pratiquepilates.com") {
      accounts.push({ ...owner, email: "admin@pratiquepilates.com" });
    }
  }
  const staff = staffAccountFromEnv();
  if (staff) accounts.push(staff);
  return accounts;
}

export function matchEnvLogin(email, password) {
  const key = clean(email).toLowerCase();
  const offered = clean(password);
  if (!key || !offered) return null;
  let found = null;
  for (const account of envLoginAccounts()) {
    if (account.email === key && secretsEqual(account.password, offered)) {
      found = { name: account.name, email: account.email, role: account.role };
    }
  }
  return found;
}

