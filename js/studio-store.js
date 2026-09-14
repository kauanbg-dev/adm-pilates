function defaultModalities() {
  return [
    { id: "mod_solo", name: "Solo", duration: 50, active: true },
    { id: "mod_reformer", name: "Reformer", duration: 50, active: true },
    { id: "mod_terapeutico", name: "Terapêutico", duration: 45, active: true },
    { id: "mod_prenatal", name: "Pré-natal", duration: 45, active: true },
  ];
}

function defaultTimes() {
  return ["07:00", "08:00", "09:00", "12:00", "18:00", "19:00"];
}

function ensureCatalog(db) {
  if (!Array.isArray(db.modalities) || !db.modalities.length) db.modalities = defaultModalities();
  db.modalities = db.modalities.map((m) => {
    if (!m || typeof m !== "object") return m;
    const next = { ...m };
    delete next.capacity;
    return next;
  });
  if (!Array.isArray(db.times) || !db.times.length) db.times = defaultTimes();
  db.times = [...new Set(db.times)].sort();
  db.instructors = (db.instructors || []).map((i, index) => ({
    id: i.id || `ins_${index + 1}`,
    name: i.name || "Instrutor",
    role: i.role || "Instrutor(a)",
    specialties: i.specialties || "",
  }));
  db.plans = [];
  const price = Number(db.classPrice);
  if (!Number.isFinite(price) || price < 0) {
    db.classPrice = 80;
  } else {
    db.classPrice = price;
  }
  db.clients = (db.clients || []).map((c) => {
    if (!c || typeof c !== "object") return c;
    const next = { ...c };
    delete next.planId;
    return next;
  });
  db.appointments = db.appointments || [];
  db.transactions = db.transactions || [];
  return db;
}

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function isoDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    method: options.method || "GET",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Falha na requisição");
    err.status = res.status;
    throw err;
  }
  return data;
}

const Studio = {
  async session() {
    try {
      const data = await api("/api/me");
      return data.user || null;
    } catch {
      return null;
    }
  },

  async login(email, password) {
    try {
      const data = await api("/api/login", { method: "POST", body: { email, password } });
      return data.user;
    } catch {
      return null;
    }
  },

  async logout() {
    try {
      await api("/api/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
  },

  async load() {
    const data = await api("/api/studio");
    return ensureCatalog(data.studio || {});
  },

  async save(db) {
    await api("/api/studio", { method: "PUT", body: { studio: db } });
  },

  classPrice(db) {
    const n = Number(db?.classPrice);
    return Number.isFinite(n) && n >= 0 ? n : 80;
  },

  client(db, id) {
    return db.clients.find((c) => c.id === id);
  },

  instructor(db, id) {
    return db.instructors.find((i) => i.id === id);
  },
};
