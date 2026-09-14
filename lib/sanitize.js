export const PLACEHOLDER_SECRETS = [
  "troque-por-um-texto-longo-e-aleatorio",
  "escolha-uma-senha-forte",
  "escolha-uma-senha-forte-do-alex",
  "um-codigo-secreto-so-da-bia",
];

const PLACEHOLDER_SET = new Set(PLACEHOLDER_SECRETS);

export function isPlaceholderSecret(value) {
  return PLACEHOLDER_SET.has(String(value || "").trim());
}

export function assertNotPlaceholder(name, value) {
  if (isPlaceholderSecret(value)) {
    throw new Error(`${name} está com o valor de exemplo do .env.example. Defina um segredo próprio.`);
  }
}

export const CLIENT_STATUSES = ["ativo", "cancelado", "inativo"];
export const APPOINTMENT_STATUSES = ["agendado", "concluido", "faltou", "cancelado"];
export const TRANSACTION_STATUSES = ["pago", "pendente", "atrasado"];
export const TRANSACTION_TYPES = ["receita", "despesa"];

const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function safeId(value) {
  const id = String(value ?? "").trim();
  return ID_RE.test(id) ? id : "";
}

export function safeTime(value) {
  const m = String(value ?? "").trim().match(TIME_RE);
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function safeDate(value) {
  const iso = String(value ?? "").trim();
  return DATE_RE.test(iso) ? iso : "";
}

export function safeText(value, max = 240) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F<>]/g, "")
    .trim()
    .slice(0, max);
}

function pick(list, value, fallback) {
  return list.includes(value) ? value : fallback;
}

function sanitizeClient(c) {
  if (!c || typeof c !== "object") return null;
  const id = safeId(c.id);
  const name = safeText(c.name, 120);
  if (!id || !name) return null;
  const next = { ...c, id, name };
  delete next.planId;
  next.email = safeText(c.email, 160);
  next.phone = safeText(c.phone, 40);
  next.instructorId = safeId(c.instructorId);
  next.status = pick(CLIENT_STATUSES, c.status, "ativo");
  next.notes = safeText(c.notes, 2000);
  next.startedAt = safeDate(c.startedAt);
  next.canceledAt = safeDate(c.canceledAt);
  next.cancelReason = safeText(c.cancelReason, 400);
  return next;
}

function sanitizeAppointment(a) {
  if (!a || typeof a !== "object") return null;
  const id = safeId(a.id);
  const time = safeTime(a.time);
  const date = safeDate(a.date);
  if (!id || !time || !date) return null;
  return {
    ...a,
    id,
    clientId: safeId(a.clientId),
    instructorId: safeId(a.instructorId),
    date,
    time,
    modality: safeText(a.modality, 80),
    status: pick(APPOINTMENT_STATUSES, a.status, "agendado"),
    kind: a.kind === "experimental" ? "experimental" : "regular",
    guestName: safeText(a.guestName, 120),
    guestPhone: safeText(a.guestPhone, 40),
  };
}

function sanitizeTransaction(t) {
  if (!t || typeof t !== "object") return null;
  const id = safeId(t.id);
  const date = safeDate(t.date);
  const amount = Number(t.amount);
  if (!id || !date || !Number.isFinite(amount) || amount < 0) return null;
  return {
    ...t,
    id,
    type: pick(TRANSACTION_TYPES, t.type, "despesa"),
    category: safeText(t.category, 80),
    description: safeText(t.description, 200),
    amount,
    date,
    status: pick(TRANSACTION_STATUSES, t.status, "pendente"),
    clientId: safeId(t.clientId),
    appointmentId: safeId(t.appointmentId),
  };
}

function sanitizeInstructor(i) {
  if (!i || typeof i !== "object") return null;
  const id = safeId(i.id);
  const name = safeText(i.name, 80);
  if (!id || !name) return null;
  return {
    ...i,
    id,
    name,
    role: safeText(i.role, 80),
    specialties: safeText(i.specialties, 200),
  };
}

function sanitizeModality(m) {
  if (!m || typeof m !== "object") return null;
  const id = safeId(m.id);
  const name = safeText(m.name, 80);
  if (!id || !name) return null;
  const capacity = Number(m.capacity);
  const duration = Number(m.duration);
  return {
    ...m,
    id,
    name,
    capacity: Number.isFinite(capacity) ? Math.min(20, Math.max(1, Math.round(capacity))) : 4,
    duration: Number.isFinite(duration) ? Math.min(120, Math.max(15, Math.round(duration))) : 50,
    active: m.active !== false,
  };
}

export function sanitizeStudio(studio) {
  const db = studio && typeof studio === "object" ? { ...studio } : {};
  db.clients = (Array.isArray(db.clients) ? db.clients : []).map(sanitizeClient).filter(Boolean);
  db.instructors = (Array.isArray(db.instructors) ? db.instructors : []).map(sanitizeInstructor).filter(Boolean);
  db.appointments = (Array.isArray(db.appointments) ? db.appointments : []).map(sanitizeAppointment).filter(Boolean);
  db.transactions = (Array.isArray(db.transactions) ? db.transactions : []).map(sanitizeTransaction).filter(Boolean);
  db.modalities = (Array.isArray(db.modalities) ? db.modalities : []).map(sanitizeModality).filter(Boolean);
  db.times = [...new Set((Array.isArray(db.times) ? db.times : []).map(safeTime).filter(Boolean))].sort();
  return db;
}
