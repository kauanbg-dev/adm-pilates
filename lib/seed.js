import { sanitizeStudio } from "./sanitize.js";

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

export const DEFAULT_CLASS_PRICE = 80;

export function normalizeStudio(studio) {
  const db = sanitizeStudio(studio && typeof studio === "object" ? { ...studio } : {});
  const n = Number(db.classPrice);
  if (!Number.isFinite(n) || n < 0) {
    db.classPrice = DEFAULT_CLASS_PRICE;
  } else {
    db.classPrice = n;
  }
  db.plans = [];
  return db;
}

export function seedStudio() {
  const today = new Date();
  const monthStart = isoDay(new Date(today.getFullYear(), today.getMonth(), 1));
  const lastMonth = isoDay(new Date(today.getFullYear(), today.getMonth() - 1, 12));
  const weekStart = addDays(today, -((today.getDay() + 6) % 7));
  const price = DEFAULT_CLASS_PRICE;

  return normalizeStudio({
    classPrice: price,
    instructors: [
      { id: "ins_bia", name: "Bia", role: "Dona e instrutora", specialties: "Clássico, reformer e solo" },
      { id: "ins_alex", name: "Alex", role: "Instrutor", specialties: "Reformer, terapêutico e reabilitação" },
    ],
    clients: [
      { id: "cli_camila", name: "Camila Souza", email: "camila.souza@email.com", phone: "(11) 98811-2200", instructorId: "ins_bia", status: "ativo", notes: "Lombar sensível.", startedAt: "2026-03-10" },
      { id: "cli_pedro", name: "Pedro Lima", email: "pedro.lima@email.com", phone: "(11) 97700-4411", instructorId: "ins_alex", status: "ativo", notes: "Corredor.", startedAt: "2026-01-20" },
      { id: "cli_helena", name: "Helena Martins", email: "helena.martins@email.com", phone: "(11) 99123-8877", instructorId: "ins_bia", status: "ativo", notes: "Gestante.", startedAt: "2026-05-04" },
      { id: "cli_joao", name: "João Ribeiro", email: "joao.ribeiro@email.com", phone: "(11) 96544-1122", instructorId: "ins_bia", status: "ativo", notes: "Iniciante.", startedAt: "2026-07-01" },
      { id: "cli_ana", name: "Ana Beatriz Nunes", email: "ana.nunes@email.com", phone: "(11) 98400-3399", instructorId: "ins_alex", status: "ativo", notes: "Pós-cirurgia de joelho.", startedAt: "2026-04-15" },
      { id: "cli_lucia", name: "Lúcia Ferreira", email: "lucia.ferreira@email.com", phone: "(11) 97211-5566", instructorId: "ins_bia", status: "cancelado", notes: "Mudou de cidade.", startedAt: "2025-11-02", canceledAt: "2026-08-12", cancelReason: "Mudança para o interior" },
    ],
    appointments: [
      { id: "apt_1", clientId: "cli_camila", instructorId: "ins_bia", date: isoDay(weekStart), time: "07:00", modality: "Reformer", status: "agendado" },
      { id: "apt_2", clientId: "cli_pedro", instructorId: "ins_bia", date: isoDay(weekStart), time: "07:00", modality: "Reformer", status: "agendado" },
      { id: "apt_3", clientId: "cli_joao", instructorId: "ins_alex", date: isoDay(weekStart), time: "08:00", modality: "Solo", status: "agendado" },
      { id: "apt_4", clientId: "cli_helena", instructorId: "ins_bia", date: isoDay(addDays(weekStart, 1)), time: "18:00", modality: "Pré-natal", status: "agendado" },
      { id: "apt_5", clientId: "cli_ana", instructorId: "ins_alex", date: isoDay(addDays(weekStart, 1)), time: "08:00", modality: "Terapêutico", status: "agendado" },
      { id: "apt_6", clientId: "cli_camila", instructorId: "ins_bia", date: isoDay(addDays(weekStart, 2)), time: "19:00", modality: "Reformer", status: "agendado" },
      { id: "apt_7", clientId: "cli_pedro", instructorId: "ins_alex", date: isoDay(addDays(weekStart, 3)), time: "12:00", modality: "Reformer", status: "agendado" },
      { id: "apt_8", clientId: "cli_joao", instructorId: "ins_bia", date: isoDay(addDays(weekStart, 4)), time: "18:00", modality: "Solo", status: "agendado" },
    ],
    transactions: [
      { id: "fin_1", type: "receita", category: "Aula", description: "Aula · Camila Souza", amount: price, date: monthStart, status: "pago", clientId: "cli_camila" },
      { id: "fin_2", type: "receita", category: "Aula", description: "Aula · Pedro Lima", amount: price, date: monthStart, status: "pago", clientId: "cli_pedro" },
      { id: "fin_3", type: "receita", category: "Aula", description: "Aula · Helena Martins", amount: price, date: monthStart, status: "pendente", clientId: "cli_helena" },
      { id: "fin_4", type: "receita", category: "Aula", description: "Aula · João Ribeiro", amount: price, date: monthStart, status: "atrasado", clientId: "cli_joao" },
      { id: "fin_5", type: "receita", category: "Aula", description: "Aula · Ana Beatriz Nunes", amount: price, date: monthStart, status: "pago", clientId: "cli_ana" },
      { id: "fin_6", type: "despesa", category: "Aluguel", description: "Aluguel", amount: 7800, date: monthStart, status: "pago" },
      { id: "fin_7", type: "despesa", category: "Folha", description: "Instrutores", amount: 4200, date: monthStart, status: "pago" },
      { id: "fin_8", type: "despesa", category: "Material", description: "Faixas e bolas", amount: 340, date: lastMonth, status: "pago" },
    ],
    modalities: [
      { id: "mod_solo", name: "Solo", capacity: 6, duration: 50, active: true },
      { id: "mod_reformer", name: "Reformer", capacity: 4, duration: 50, active: true },
      { id: "mod_terapeutico", name: "Terapêutico", capacity: 2, duration: 45, active: true },
      { id: "mod_prenatal", name: "Pré-natal", capacity: 4, duration: 45, active: true },
    ],
    times: ["07:00", "08:00", "09:00", "12:00", "18:00", "19:00"],
  });
}
