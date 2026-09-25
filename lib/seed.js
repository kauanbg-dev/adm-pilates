import { sanitizeStudio } from "./sanitize.js";

export const DEFAULT_CLASS_PRICE = 80;

const DEMO_CLIENT_IDS = new Set([
  "cli_camila",
  "cli_pedro",
  "cli_helena",
  "cli_joao",
  "cli_ana",
  "cli_lucia",
]);
const DEMO_APT_IDS = new Set(["apt_1", "apt_2", "apt_3", "apt_4", "apt_5", "apt_6", "apt_7", "apt_8"]);
const DEMO_TX_IDS = new Set(["fin_1", "fin_2", "fin_3", "fin_4", "fin_5", "fin_6", "fin_7", "fin_8"]);

function withoutDemoRecords(db) {
  return {
    ...db,
    clients: (Array.isArray(db.clients) ? db.clients : []).filter((c) => !DEMO_CLIENT_IDS.has(c.id)),
    appointments: (Array.isArray(db.appointments) ? db.appointments : []).filter(
      (a) => !DEMO_APT_IDS.has(a.id) && !DEMO_CLIENT_IDS.has(a.clientId)
    ),
    transactions: (Array.isArray(db.transactions) ? db.transactions : []).filter(
      (t) => !DEMO_TX_IDS.has(t.id) && !DEMO_CLIENT_IDS.has(t.clientId)
    ),
  };
}

export function hasDemoRecords(studio) {
  const db = studio && typeof studio === "object" ? studio : {};
  return (
    (db.clients || []).some((c) => DEMO_CLIENT_IDS.has(c?.id)) ||
    (db.appointments || []).some((a) => DEMO_APT_IDS.has(a?.id)) ||
    (db.transactions || []).some((t) => DEMO_TX_IDS.has(t?.id))
  );
}

export function normalizeStudio(studio) {
  const db = sanitizeStudio(withoutDemoRecords(studio && typeof studio === "object" ? { ...studio } : {}));
  const n = Number(db.classPrice);
  if (!Number.isFinite(n) || n < 0) {
    db.classPrice = DEFAULT_CLASS_PRICE;
  } else {
    db.classPrice = n;
  }
  db.plans = [];
  if (Array.isArray(db.instructors)) {
    db.instructors = db.instructors.map((item) => {
      if (!item || typeof item !== "object") return item;
      if (item.id === "ins_alex" || item.name === "Alex") {
        return { ...item, name: "Alek" };
      }
      return item;
    });
  }
  return db;
}

export function seedStudio() {
  return normalizeStudio({
    classPrice: DEFAULT_CLASS_PRICE,
    instructors: [
      { id: "ins_bia", name: "Bia", role: "Dona e instrutora", specialties: "Clássico, reformer e solo" },
      { id: "ins_alex", name: "Alek", role: "Instrutor", specialties: "Reformer, terapêutico e reabilitação" },
    ],
    clients: [],
    appointments: [],
    transactions: [],
    modalities: [
      { id: "mod_solo", name: "Solo", duration: 50, active: true },
      { id: "mod_reformer", name: "Reformer", duration: 50, active: true },
      { id: "mod_terapeutico", name: "Terapêutico", duration: 45, active: true },
      { id: "mod_prenatal", name: "Pré-natal", duration: 45, active: true },
    ],
    times: ["07:00", "08:00", "09:00", "12:00", "18:00", "19:00"],
  });
}
