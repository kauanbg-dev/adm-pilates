const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const titles = {
  inicio: ["Painel", "Como está o estúdio hoje"],
  clientes: ["Alunos", "Cadastro e cancelamento de matrícula"],
  agenda: ["Agenda", "Agende, edite, remova e marque aula experimental"],
  financeiro: ["Financeiro", "Aulas, despesas e caixa do mês"],
  valor: ["Valor", "Um único valor por aula"],
  aulas: ["Aulas", "Formas de aula, vagas, duração e horários da grade"],
  equipe: ["Instrutores", "Quem conduz as aulas"],
};

const PAYMENT_METHODS = [
  { value: "", label: "Não informado" },
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
  { value: "transferencia", label: "Transferência" },
  { value: "outro", label: "Outro" },
];

function paymentMethodLabel(value) {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label || "";
}

function paymentMethodOptions(selected) {
  const current = selected || "";
  return PAYMENT_METHODS.map(
    (m) =>
      `<option value="${escapeAttr(m.value)}" ${m.value === current ? "selected" : ""}>${escapeHtml(m.label)}</option>`
  ).join("");
}

function emptyStudio() {
  return { instructors: [], plans: [], clients: [], appointments: [], transactions: [], modalities: [], times: [], classPrice: 80 };
}

let db = emptyStudio();
let currentUser = null;
let view = "inicio";
let weekOffset = 0;
let agendaDayIndex = Math.min(5, (new Date().getDay() + 6) % 7);
let clientQuery = "";
let clientFilter = "todos";
let financeFilter = "todos";

const root = document.querySelector("#view-root");
const loginScreen = document.querySelector("#login-screen");
const app = document.querySelector("#app");
const modalEl = document.querySelector("#modal");
const modalTitle = document.querySelector("#modal-title");
const modalBody = document.querySelector("#modal-body");

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!d) return new Date(iso).toLocaleDateString("pt-BR");
  return `${d}/${m}/${y}`;
}

function todayIso() {
  return isoDay(new Date());
}

function mondayOfDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  return addDays(d, -day);
}

function mondayOf(offsetWeeks) {
  return addDays(mondayOfDate(new Date()), offsetWeeks * 7);
}

function weekOffsetForDate(date) {
  const currentMonday = mondayOf(0);
  const targetMonday = mondayOfDate(date);
  return Math.round((targetMonday.getTime() - currentMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function parseAgendaDate(iso) {
  return new Date(`${iso}T12:00:00`);
}

function weekDays() {
  const monday = mondayOf(weekOffset);
  return Array.from({ length: 6 }, (_, i) => {
    const d = addDays(monday, i);
    return { date: isoDay(d), label: WEEKDAYS[i], pretty: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) };
  });
}

function agendaMonthYear(days = weekDays()) {
  const counts = new Map();
  let best = parseAgendaDate(days[0].date);
  let bestN = 0;
  days.forEach((item) => {
    const dt = parseAgendaDate(item.date);
    const key = `${dt.getFullYear()}-${dt.getMonth()}`;
    const n = (counts.get(key) || 0) + 1;
    counts.set(key, n);
    if (n > bestN) {
      bestN = n;
      best = dt;
    }
  });
  return { year: best.getFullYear(), month: best.getMonth() };
}

function agendaYearOptions(focusYear) {
  const now = new Date().getFullYear();
  let min = now - 2;
  let max = now + 2;
  (db.appointments || []).forEach((a) => {
    const y = Number(String(a.date || "").slice(0, 4));
    if (y) {
      min = Math.min(min, y);
      max = Math.max(max, y);
    }
  });
  min = Math.min(min, focusYear);
  max = Math.max(max, focusYear);
  const years = [];
  for (let y = min; y <= max; y += 1) years.push(y);
  return years;
}

function weekRangeLabel(days) {
  const start = parseAgendaDate(days[0].date);
  const end = parseAgendaDate(days[5].date);
  const startMonth = MONTHS_PT[start.getMonth()].toLowerCase();
  const endMonth = MONTHS_PT[end.getMonth()].toLowerCase();
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} a ${end.getDate()} de ${endMonth} de ${end.getFullYear()}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} de ${startMonth} a ${end.getDate()} de ${endMonth} de ${end.getFullYear()}`;
  }
  return `${start.getDate()} de ${startMonth} de ${start.getFullYear()} a ${end.getDate()} de ${endMonth} de ${end.getFullYear()}`;
}

function firstMondayInMonth(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  first.setHours(0, 0, 0, 0);
  const weekday = (first.getDay() + 6) % 7;
  return weekday === 0 ? first : addDays(first, 7 - weekday);
}

function goToMonth(year, monthIndex) {
  const now = new Date();
  if (year === now.getFullYear() && monthIndex === now.getMonth()) {
    weekOffset = 0;
    agendaDayIndex = Math.min(5, (now.getDay() + 6) % 7);
    return;
  }
  weekOffset = weekOffsetForDate(firstMondayInMonth(year, monthIndex));
  agendaDayIndex = 0;
}

function shiftAgendaMonth(delta) {
  const { year, month } = agendaMonthYear();
  const next = new Date(year, month + delta, 1);
  goToMonth(next.getFullYear(), next.getMonth());
}

function persist() {
  Studio.save(db).catch((err) => console.error(err));
}

function isStaff() {
  return currentUser?.role === "staff";
}

function isOwnerInstructor(instructor) {
  if (!instructor) return false;
  const id = String(instructor.id || "");
  const name = String(instructor.name || "").trim().toLowerCase();
  const role = String(instructor.role || "").toLowerCase();
  return id === "ins_bia" || name === "bia" || role.includes("dona");
}

function canEditInstructor(instructor) {
  if (!isStaff()) return true;
  if (isOwnerInstructor(instructor)) return false;
  return String(instructor?.name || "").trim().toLowerCase() === String(currentUser?.name || "").trim().toLowerCase();
}

function applyRoleUi() {
  document.body.classList.toggle("role-staff", isStaff());
  document.querySelectorAll(".admin-nav button[data-view]").forEach((btn) => {
    if (btn.dataset.view === "financeiro") btn.hidden = isStaff();
  });
}

function classTimes() {
  const extra = (db.appointments || []).map((a) => a.time).filter(Boolean);
  return [...new Set([...(db.times || []), ...extra])].sort();
}

function formatNames(includeInactive, current) {
  const list = db.modalities || [];
  const names = list.filter((m) => includeInactive || m.active || m.name === current).map((m) => m.name);
  if (current && !names.includes(current)) names.push(current);
  return names.length ? names : ["Solo"];
}

function clientName(id) {
  return Studio.client(db, id)?.name || "Aluno removido";
}

function personLabel(a) {
  if (a?.guestName) return a.guestName;
  return Studio.client(db, a?.clientId)?.name || "Visitante";
}

function instructorName(id) {
  return Studio.instructor(db, id)?.name || "—";
}

function isBillable(apt) {
  return Boolean(apt) && apt.kind !== "experimental" && apt.status !== "cancelado";
}

function chargeAppointment(apt) {
  if (!isBillable(apt)) return false;
  const price = Studio.classPrice(db);
  if (!(price > 0)) return false;
  if (db.transactions.some((t) => t.appointmentId === apt.id)) return false;
  const client = apt.clientId ? Studio.client(db, apt.clientId) : null;
  const paymentMethod = client?.paymentMethod || "";
  const payLabel = paymentMethodLabel(paymentMethod);
  db.transactions.push({
    id: uid("fin"),
    type: "receita",
    category: "Aula",
    description: `Aula · ${personLabel(apt)} · ${formatDate(apt.date)} ${apt.time}${payLabel ? ` · ${payLabel}` : ""}`,
    amount: price,
    date: apt.date,
    status: "pendente",
    clientId: apt.clientId || "",
    appointmentId: apt.id,
    paymentMethod,
  });
  return true;
}

function statusChip(status) {
  const map = {
    ativo: "chip-ok",
    cancelado: "chip-bad",
    inativo: "chip-warn",
    agendado: "chip-info",
    concluido: "chip-ok",
    faltou: "chip-warn",
    pago: "chip-ok",
    pendente: "chip-info",
    atrasado: "chip-bad",
    experimental: "chip-info",
  };
  const labels = {
    ativo: "Ativo",
    cancelado: "Cancelado",
    inativo: "Inativo",
    agendado: "Agendado",
    concluido: "Compareceu",
    faltou: "Faltou",
    pago: "Pago",
    pendente: "Pendente",
    atrasado: "Em atraso",
    experimental: "Experimental",
  };
  return `<span class="chip ${map[status] || ""}">${escapeHtml(labels[status] || "—")}</span>`;
}

function monthKey(iso) {
  return (iso || "").slice(0, 7);
}

function currentMonth() {
  return todayIso().slice(0, 7);
}

function monthTx() {
  const m = currentMonth();
  return db.transactions.filter((t) => monthKey(t.date) === m);
}

function openModal(title, html) {
  modalTitle.textContent = title;
  modalBody.innerHTML = html;
  modalEl.hidden = false;
}

function closeModal() {
  modalEl.hidden = true;
  modalBody.innerHTML = "";
}

function bindForm(id, handler) {
  const form = document.querySelector(id);
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    handler(new FormData(form), form);
  });
}

async function showApp() {
  const user = await Studio.session();
  currentUser = user;
  if (!user) {
    loginScreen.hidden = false;
    app.hidden = true;
    document.body.classList.remove("role-staff");
    return;
  }
  loginScreen.hidden = true;
  app.hidden = false;
  applyRoleUi();
  if (isStaff() && view === "financeiro") view = "inicio";
  document.querySelector("#admin-name").textContent = user.name;
  document.querySelector("#admin-email").textContent = user.email;
  render();
}

function render() {
  if (view === "planos") view = "valor";
  if (!titles[view]) view = "inicio";
  if (isStaff() && view === "financeiro") view = "inicio";
  applyRoleUi();
  const [eyebrow, title] = titles[view];
  document.querySelector("#view-eyebrow").textContent = eyebrow;
  document.querySelector("#view-title").textContent = title;
  document.querySelectorAll(".admin-nav button").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.view === view);
  });
  const actions = document.querySelector("#view-actions");
  if (view === "clientes") {
    actions.innerHTML = `<button class="btn btn-primary" type="button" data-action="novo-cliente">Novo aluno</button>`;
  } else if (view === "agenda") {
    actions.innerHTML = `<button class="btn btn-ghost-dark" type="button" data-action="aula-experimental">Aula experimental</button>
      <button class="btn btn-primary" type="button" data-action="novo-agendamento">Agendar aula</button>`;
  } else if (view === "financeiro") {
    actions.innerHTML = isStaff()
      ? ""
      : `<button class="btn btn-ghost-dark" type="button" data-action="gerar-aulas">Gerar cobranças das aulas</button>
      <button class="btn btn-primary" type="button" data-action="novo-lancamento">Novo lançamento</button>`;
  } else if (view === "valor") {
    actions.innerHTML = isStaff() ? "" : `<button class="btn btn-primary" type="button" data-action="editar-valor">Alterar valor</button>`;
  } else if (view === "aulas") {
    actions.innerHTML = `<button class="btn btn-ghost-dark" type="button" data-action="novo-horario">Novo horário</button>
      <button class="btn btn-primary" type="button" data-action="nova-modalidade">Nova forma de aula</button>`;
  } else if (view === "equipe") {
    actions.innerHTML = isStaff() ? "" : `<button class="btn btn-primary" type="button" data-action="novo-instrutor">Novo instrutor</button>`;
  } else {
    actions.innerHTML = "";
  }

  if (view === "inicio") renderHome();
  if (view === "clientes") renderClients();
  if (view === "agenda") renderAgenda();
  if (view === "financeiro") renderFinance();
  if (view === "valor") renderValor();
  if (view === "aulas") renderAulas();
  if (view === "equipe") renderTeam();
}

function renderHome() {
  const ativos = db.clients.filter((c) => c.status === "ativo");
  const today = todayIso();
  const aulasHoje = db.appointments.filter((a) => a.date === today && a.status !== "cancelado");
  const tx = monthTx();
  const receita = tx.filter((t) => t.type === "receita" && t.status === "pago").reduce((s, t) => s + t.amount, 0);
  const despesa = tx.filter((t) => t.type === "despesa" && t.status === "pago").reduce((s, t) => s + t.amount, 0);
  const atrasados = db.transactions.filter((t) => t.type === "receita" && t.status === "atrasado");
  const cancelados = db.clients.filter((c) => c.status === "cancelado");

  const moneyKpis = isStaff()
    ? `<article class="kpi"><p>Sua área</p><strong>Agenda</strong><span>Alunos e aulas do estúdio</span></article>
      <article class="kpi"><p>Instrutores</p><strong>${db.instructors.length}</strong><span>equipe do estúdio</span></article>`
    : `<article class="kpi"><p>Receita do mês</p><strong>${money(receita)}</strong><span>já baixada no caixa</span></article>
      <article class="kpi"><p>Saldo do mês</p><strong>${money(receita - despesa)}</strong><span>receitas pagas − despesas</span></article>`;
  const pendencias = isStaff()
    ? `<section class="panel">
        <h2>Matrículas</h2>
        <p class="muted">${cancelados.length} matrícula(s) cancelada(s) no histórico.</p>
      </section>`
    : `<section class="panel">
        <h2>Pendências</h2>
        ${
          atrasados.length
            ? `<ul class="plain-list">${atrasados
                .map((t) => `<li>${t.description}<br /><span class="muted">${money(t.amount)} · venc. ${formatDate(t.date)}</span></li>`)
                .join("")}</ul>`
            : `<p class="muted">Nenhuma cobrança de aula em atraso.</p>`
        }
        <p class="muted" style="margin-top:1rem">${cancelados.length} matrícula(s) cancelada(s) no histórico.</p>
      </section>`;

  root.innerHTML = `
    <div class="kpi-grid">
      <article class="kpi"><p>Alunos ativos</p><strong>${ativos.length}</strong><span>de ${db.clients.length} cadastros</span></article>
      <article class="kpi"><p>Aulas hoje</p><strong>${aulasHoje.length}</strong><span>${today === isoDay(new Date()) ? "na grade de hoje" : ""}</span></article>
      ${moneyKpis}
    </div>
    <div class="split-admin">
      <section class="panel">
        <h2>Aulas de hoje</h2>
        ${
          aulasHoje.length
            ? `<ul class="plain-list">${aulasHoje
                .sort((a, b) => a.time.localeCompare(b.time))
                .map(
                  (a) => `<li><strong>${escapeHtml(a.time)}</strong> · ${escapeHtml(a.modality)}${a.kind === "experimental" ? " · experimental" : ""}<br /><span class="muted">${escapeHtml(personLabel(a))} · ${escapeHtml(instructorName(a.instructorId))}</span> ${statusChip(a.status)}</li>`
                )
                .join("")}</ul>`
            : `<p class="muted">Nenhuma aula marcada para hoje. Abra a agenda para agendar.</p>`
        }
      </section>
      ${pendencias}
    </div>
  `;
}

function filteredClients() {
  const q = clientQuery.trim().toLowerCase();
  return db.clients.filter((c) => {
    const hit =
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q) ||
      paymentMethodLabel(c.paymentMethod).toLowerCase().includes(q);
    const st = clientFilter === "todos" || c.status === clientFilter;
    return hit && st;
  });
}

function renderClients() {
  const rows = filteredClients();
  root.innerHTML = `
    <div class="toolbar">
      <input type="search" id="busca-cliente" placeholder="Buscar por nome ou contato" value="${escapeAttr(clientQuery)}" />
      <select id="filtro-cliente">
        <option value="todos" ${clientFilter === "todos" ? "selected" : ""}>Todos</option>
        <option value="ativo" ${clientFilter === "ativo" ? "selected" : ""}>Ativos</option>
        <option value="cancelado" ${clientFilter === "cancelado" ? "selected" : ""}>Cancelados</option>
        <option value="inativo" ${clientFilter === "inativo" ? "selected" : ""}>Inativos</option>
      </select>
    </div>
    <div class="table-wrap stack-table">
      <table>
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Instrutor</th>
            <th>Pagamento</th>
            <th>Status</th>
            <th>Início</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (c) => `
            <tr>
              <td data-label="Aluno">${escapeHtml(c.name)}<br /><span class="muted">${escapeHtml([c.email, c.phone].filter(Boolean).join(" · ") || "Sem e-mail ou WhatsApp")}</span></td>
              <td data-label="Instrutor">${escapeHtml(instructorName(c.instructorId))}</td>
              <td data-label="Pagamento">${escapeHtml(paymentMethodLabel(c.paymentMethod) || "—")}</td>
              <td data-label="Status">${statusChip(c.status)}</td>
              <td data-label="Início">${formatDate(c.startedAt)}</td>
              <td class="td-actions">
                <button class="linkish" type="button" data-action="editar-cliente" data-id="${escapeAttr(c.id)}">Editar</button>
                ${
                  c.status === "ativo"
                    ? `<button class="linkish danger" type="button" data-action="cancelar-cliente" data-id="${escapeAttr(c.id)}">Cancelar</button>`
                    : `<button class="linkish" type="button" data-action="reativar-cliente" data-id="${escapeAttr(c.id)}">Reativar</button>`
                }
                <button class="linkish danger" type="button" data-action="excluir-cliente" data-id="${escapeAttr(c.id)}">Excluir</button>
              </td>
            </tr>`
                  )
                  .join("")
              : `<tr><td colspan="6">Nenhum aluno encontrado.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function clientForm(c) {
  const isNew = !c;
  const value = c || {
    name: "",
    email: "",
    phone: "",
    instructorId: db.instructors[0]?.id || "",
    notes: "",
    paymentMethod: "",
    status: "ativo",
    startedAt: todayIso(),
  };
  return `
    <form id="form-cliente" class="contact-form nested" novalidate>
      <label>Nome
        <input name="name" required autocomplete="name" value="${escapeAttr(value.name)}" />
      </label>
      <label>Profissional
        <select name="instructorId" required>${db.instructors
          .map((i) => `<option value="${escapeAttr(i.id)}" ${i.id === value.instructorId ? "selected" : ""}>${escapeHtml(i.name)}</option>`)
          .join("")}</select>
      </label>
      <p class="muted">E-mail, WhatsApp e forma de pagamento são opcionais.</p>
      <div class="row-2">
        <label>E-mail
          <input type="email" name="email" autocomplete="email" inputmode="email" placeholder="Opcional" value="${escapeAttr(value.email)}" />
        </label>
        <label>WhatsApp
          <input name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="Opcional" value="${escapeAttr(value.phone)}" />
        </label>
      </div>
      <label>Pagamento da aula
        <select name="paymentMethod">${paymentMethodOptions(value.paymentMethod)}</select>
      </label>
      <p class="muted">Como a pessoa costuma pagar a aula, se quiser registrar. Não é obrigatório.</p>
      <label>Observações clínicas / objetivas
        <textarea name="notes" rows="3">${escapeHtml(value.notes || "")}</textarea>
      </label>
      <button class="btn btn-primary" type="submit">${isNew ? "Cadastrar" : "Salvar"}</button>
    </form>
  `;
}

function openNewClient() {
  openModal("Novo aluno", clientForm(null));
  bindForm("#form-cliente", (fd) => {
    const client = {
      id: uid("cli"),
      name: String(fd.get("name")).trim(),
      email: String(fd.get("email") || "").trim().toLowerCase(),
      phone: String(fd.get("phone") || "").trim(),
      instructorId: String(fd.get("instructorId") || ""),
      notes: String(fd.get("notes") || "").trim(),
      paymentMethod: String(fd.get("paymentMethod") || "").trim(),
      status: "ativo",
      startedAt: todayIso(),
    };
    if (!client.name) {
      alert("Informe o nome da pessoa.");
      return;
    }
    if (!client.instructorId) {
      alert("Escolha o profissional.");
      return;
    }
    if (client.email && db.clients.some((c) => c.email && c.email === client.email && c.status !== "cancelado")) {
      alert("Já existe um aluno ativo com este e-mail.");
      return;
    }
    db.clients.push(client);
    persist();
    closeModal();
    view = "clientes";
    render();
  });
}

function openEditClient(id) {
  const c = Studio.client(db, id);
  if (!c) return;
  openModal("Editar aluno", clientForm(c));
  bindForm("#form-cliente", (fd) => {
    const name = String(fd.get("name")).trim();
    const instructorId = String(fd.get("instructorId") || "");
    if (!name) {
      alert("Informe o nome da pessoa.");
      return;
    }
    if (!instructorId) {
      alert("Escolha o profissional.");
      return;
    }
    const email = String(fd.get("email") || "").trim().toLowerCase();
    if (email && db.clients.some((other) => other.id !== c.id && other.email && other.email === email && other.status !== "cancelado")) {
      alert("Já existe um aluno ativo com este e-mail.");
      return;
    }
    c.name = name;
    c.email = email;
    c.phone = String(fd.get("phone") || "").trim();
    c.instructorId = instructorId;
    c.notes = String(fd.get("notes") || "").trim();
    c.paymentMethod = String(fd.get("paymentMethod") || "").trim();
    persist();
    closeModal();
    render();
  });
}

function openCancelClient(id) {
  const c = Studio.client(db, id);
  if (!c) return;
  openModal(
    "Cancelar matrícula",
    `
    <p>Cancelar <strong>${escapeHtml(c.name)}</strong> encerra a matrícula, cancela aulas futuras e não gera novas cobranças de aula.</p>
    <form id="form-cancel" class="contact-form nested">
      <label>Motivo
        <textarea name="reason" rows="3" required placeholder="Ex.: mudança de cidade, lesão, financeiro…"></textarea>
      </label>
      <button class="btn btn-danger" type="submit">Confirmar cancelamento</button>
    </form>
  `
  );
  bindForm("#form-cancel", (fd) => {
    c.status = "cancelado";
    c.canceledAt = todayIso();
    c.cancelReason = String(fd.get("reason")).trim();
    db.appointments.forEach((a) => {
      if (a.clientId === c.id && a.date >= todayIso() && a.status === "agendado") {
        a.status = "cancelado";
      }
    });
    persist();
    closeModal();
    render();
  });
}

function renderAgenda() {
  const days = weekDays();
  if (agendaDayIndex > days.length - 1) agendaDayIndex = 0;
  const day = days[agendaDayIndex];
  const { year, month } = agendaMonthYear(days);
  const years = agendaYearOptions(year);
  const times = classTimes();
  root.innerHTML = `
    <div class="toolbar agenda-toolbar">
      <div class="agenda-jump">
        <button class="btn btn-ghost-dark" type="button" data-action="mes-prev" aria-label="Mês anterior">‹</button>
        <label class="agenda-select">
          <span class="sr-only">Mês</span>
          <select id="agenda-mes" aria-label="Mês">
            ${MONTHS_PT.map((name, i) => `<option value="${i}" ${i === month ? "selected" : ""}>${name}</option>`).join("")}
          </select>
        </label>
        <label class="agenda-select">
          <span class="sr-only">Ano</span>
          <select id="agenda-ano" aria-label="Ano">
            ${years.map((y) => `<option value="${y}" ${y === year ? "selected" : ""}>${y}</option>`).join("")}
          </select>
        </label>
        <button class="btn btn-ghost-dark" type="button" data-action="mes-next" aria-label="Próximo mês">›</button>
      </div>
      <div class="agenda-week-nav">
        <button class="btn btn-ghost-dark" type="button" data-action="semana-prev" aria-label="Semana anterior">←</button>
        <strong class="agenda-range">${weekRangeLabel(days)}</strong>
        <button class="btn btn-ghost-dark" type="button" data-action="semana-next" aria-label="Próxima semana">→</button>
        <button class="btn btn-ghost-dark agenda-hoje" type="button" data-action="semana-hoje">Hoje</button>
      </div>
    </div>
    <p class="muted agenda-hint">Escolha o mês e o ano para pular a data, ou use as setas para ir semana a semana.</p>
    <div class="agenda-desktop">
      <p class="muted">Clique em um horário para agendar ou editar.</p>
      <div class="agenda-wrap">
        <table class="agenda-table">
          <thead>
            <tr>
              <th>Horário</th>
              ${days.map((d) => `<th>${d.label}<br /><span class="muted">${d.pretty}</span></th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${times.map((time) => {
              return `<tr>
                <th>${escapeHtml(time)}</th>
                ${days
                  .map((d) => {
                    const items = db.appointments.filter((a) => a.date === d.date && a.time === time && a.status !== "cancelado");
                    const byMod = {};
                    items.forEach((a) => {
                      byMod[a.modality] = (byMod[a.modality] || 0) + 1;
                    });
                    const occ = Object.entries(byMod)
                      .map(([mod, n]) => `${mod} ${n}/${Studio.maxFor(db, mod)}`)
                      .join(" · ");
                    return `<td>
                      <button class="slot" type="button" data-action="slot" data-date="${escapeAttr(d.date)}" data-time="${escapeAttr(time)}">
                        ${
                          items.length
                            ? items
                                .map(
                                  (a) =>
                                    `<span class="slot-item">${escapeHtml(personLabel(a).split(" ")[0])} · ${escapeHtml(a.modality)}${a.kind === "experimental" ? " · exp." : ""}</span>`
                                )
                                .join("")
                            : `<span class="muted">Livre</span>`
                        }
                        ${occ ? `<span class="slot-occ">${escapeHtml(occ)}</span>` : ""}
                      </button>
                    </td>`;
                  })
                  .join("")}
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
    <div class="agenda-mobile">
      <div class="agenda-days">
        ${days
          .map(
            (d, i) =>
              `<button type="button" class="${i === agendaDayIndex ? "is-active" : ""}" data-action="agenda-dia" data-index="${i}">${d.label}<small>${d.pretty}</small></button>`
          )
          .join("")}
      </div>
      <div class="agenda-list">
        ${times
          .map((time) => {
            const items = db.appointments.filter((a) => a.date === day.date && a.time === time && a.status !== "cancelado");
            const label = items.length
              ? items.map((a) => `${personLabel(a).split(" ")[0]} · ${a.modality}`).join(" · ")
              : "Livre";
            return `<button class="agenda-row" type="button" data-action="slot" data-date="${escapeAttr(day.date)}" data-time="${escapeAttr(time)}">
              <strong>${escapeHtml(time)}</strong>
              <span>${escapeHtml(label)}${items.some((a) => a.kind === "experimental") ? " · exp." : ""}</span>
            </button>`;
          })
          .join("")}
      </div>
    </div>
  `;
}

function appointmentForm(preset = {}) {
  const experimental = preset.kind === "experimental";
  const ativos = db.clients.filter((c) => c.status === "ativo");
  const todos = db.clients;
  const list = experimental ? todos : ativos;
  return `
    <form id="form-aula" class="contact-form nested">
      <label>Tipo de aula
        <select name="kind">
          <option value="regular" ${experimental ? "" : "selected"}>Aluno matriculado</option>
          <option value="experimental" ${experimental ? "selected" : ""}>Aula experimental</option>
        </select>
      </label>
      <label>Aluno cadastrado
        <select name="clientId">
          <option value="">${experimental ? "Visitante (não cadastrado)" : "Selecione o aluno"}</option>
          ${list
            .map((c) => `<option value="${escapeAttr(c.id)}" ${c.id === preset.clientId ? "selected" : ""}>${escapeHtml(c.name)}${c.status !== "ativo" ? " (inativo)" : ""}</option>`)
            .join("")}
        </select>
      </label>
      <p class="muted">Na aula experimental você pode escolher um cadastro ou preencher o visitante abaixo.</p>
      <div class="row-2">
        <label>Nome do visitante <input name="guestName" value="${escapeAttr(preset.guestName || "")}" placeholder="Só se não estiver cadastrado" /></label>
        <label>WhatsApp <input name="guestPhone" value="${escapeAttr(preset.guestPhone || "")}" placeholder="(21) 9...." /></label>
      </div>
      <div class="row-2">
        <label>Data <input type="date" name="date" required value="${escapeAttr(preset.date || todayIso())}" /></label>
        <label>Horário
          <select name="time">${classTimes().map((t) => `<option ${t === (preset.time || classTimes()[0] || "08:00") ? "selected" : ""}>${escapeHtml(t)}</option>`).join("")}</select>
        </label>
      </div>
      <div class="row-2">
        <label>Modalidade
          <select name="modality">${formatNames(false, preset.modality).map((m) => `<option ${m === (preset.modality || formatNames(false)[0]) ? "selected" : ""}>${escapeHtml(m)}</option>`).join("")}</select>
        </label>
        <label>Instrutor
          <select name="instructorId">${db.instructors
            .map((i) => `<option value="${escapeAttr(i.id)}" ${i.id === (preset.instructorId || db.instructors[0]?.id) ? "selected" : ""}>${escapeHtml(i.name)}</option>`)
            .join("")}</select>
        </label>
      </div>
      ${
        preset.id
          ? `<label>Status
              <select name="status">
                <option value="agendado" ${preset.status === "agendado" ? "selected" : ""}>Agendado</option>
                <option value="concluido" ${preset.status === "concluido" ? "selected" : ""}>Compareceu</option>
                <option value="faltou" ${preset.status === "faltou" ? "selected" : ""}>Faltou</option>
              </select>
            </label>`
          : ""
      }
      <button class="btn btn-primary" type="submit">${preset.id ? "Salvar alterações" : experimental ? "Agendar experimental" : "Confirmar agendamento"}</button>
      <p class="form-status" id="aula-status"></p>
    </form>
  `;
}

function payloadFromAula(fd) {
  return {
    kind: String(fd.get("kind") || "regular"),
    clientId: String(fd.get("clientId") || ""),
    guestName: String(fd.get("guestName") || "").trim(),
    guestPhone: String(fd.get("guestPhone") || "").trim(),
    date: String(fd.get("date")),
    time: String(fd.get("time")),
    modality: String(fd.get("modality")),
    instructorId: String(fd.get("instructorId")),
    status: String(fd.get("status") || "agendado"),
  };
}

function trySaveAppointment(data, statusEl, exceptId) {
  const guest = Boolean(data.guestName);
  const client = data.clientId ? Studio.client(db, data.clientId) : null;

  if (data.kind !== "experimental") {
    if (!client || client.status !== "ativo") {
      statusEl.textContent = "Escolha um aluno com matrícula ativa, ou marque como aula experimental.";
      return false;
    }
  } else if (!client && !guest) {
    statusEl.textContent = "Na experimental, escolha um cadastro ou informe o nome do visitante.";
    return false;
  }

  const occupied = Studio.occupancy(db, data.date, data.time, data.modality, exceptId);
  if (occupied >= Studio.maxFor(db, data.modality)) {
    statusEl.textContent = `Turma lotada neste horário (${Studio.maxFor(db, data.modality)} vagas de ${data.modality}).`;
    return false;
  }

  if (client) {
    const clash = db.appointments.some(
      (a) =>
        a.id !== exceptId &&
        a.clientId === client.id &&
        a.date === data.date &&
        a.time === data.time &&
        a.status !== "cancelado"
    );
    if (clash) {
      statusEl.textContent = "Este aluno já tem aula neste horário.";
      return false;
    }
  }

  return {
    kind: data.kind === "experimental" ? "experimental" : "regular",
    clientId: client ? client.id : "",
    guestName: client ? "" : data.guestName,
    guestPhone: client ? "" : data.guestPhone,
    instructorId: data.instructorId,
    date: data.date,
    time: data.time,
    modality: data.modality,
    status: data.status || "agendado",
  };
}

function openAppointment(existing, preset = {}) {
  const initial = existing
    ? { ...existing }
    : {
        kind: preset.kind || "regular",
        clientId: preset.clientId || "",
        guestName: "",
        guestPhone: "",
        date: preset.date || todayIso(),
        time: preset.time || "08:00",
        modality: preset.modality || formatNames(false)[0],
        instructorId: preset.instructorId || db.instructors[0]?.id,
        status: "agendado",
      };
  const title = existing
    ? "Editar aula"
    : initial.kind === "experimental"
      ? "Aula experimental"
      : "Agendar aula";
  openModal(title, appointmentForm(initial));
  bindForm("#form-aula", (fd, form) => {
    const data = payloadFromAula(fd);
    const saved = trySaveAppointment(data, form.querySelector("#aula-status"), existing?.id);
    if (!saved) return;
    if (existing) Object.assign(existing, saved);
    else db.appointments.push({ id: uid("apt"), ...saved });
    persist();
    closeModal();
    view = "agenda";
    render();
  });
}

function openNewAppointment(preset) {
  openAppointment(null, preset || {});
}

function openSlot(date, time) {
  const items = db.appointments.filter((a) => a.date === date && a.time === time && a.status !== "cancelado");
  openModal(
    `${escapeHtml(time)} · ${formatDate(date)}`,
    `
    ${
      items.length
        ? `<ul class="plain-list">${items
            .map(
              (a) => `<li>
                <strong>${escapeHtml(personLabel(a))}</strong> · ${escapeHtml(a.modality)}
                ${a.kind === "experimental" ? statusChip("experimental") : ""}<br />
                <span class="muted">${escapeHtml(instructorName(a.instructorId))}${a.guestPhone ? ` · ${escapeHtml(a.guestPhone)}` : ""}</span>
                ${statusChip(a.status)}
                <div class="inline-actions">
                  <button class="btn btn-ghost-dark" type="button" data-action="editar-aula" data-id="${escapeAttr(a.id)}">Editar</button>
                  <button class="btn btn-ghost-dark" type="button" data-action="presenca" data-id="${escapeAttr(a.id)}">Compareceu</button>
                  <button class="btn btn-ghost-dark" type="button" data-action="falta" data-id="${escapeAttr(a.id)}">Faltou</button>
                  <button class="btn btn-danger" type="button" data-action="remover-aula" data-id="${escapeAttr(a.id)}">Remover da agenda</button>
                </div>
              </li>`
            )
            .join("")}</ul>`
        : `<p class="muted">Horário livre. Agende um aluno ou uma aula experimental.</p>`
    }
    <div class="inline-actions">
      <button class="btn btn-primary" type="button" data-action="agendar-neste" data-date="${escapeAttr(date)}" data-time="${escapeAttr(time)}">Agendar aluno</button>
      <button class="btn btn-ghost-dark" type="button" data-action="experimental-neste" data-date="${escapeAttr(date)}" data-time="${escapeAttr(time)}">Aula experimental</button>
    </div>
  `
  );
}

function renderFinance() {
  if (isStaff()) {
    view = "inicio";
    renderHome();
    return;
  }
  const list = db.transactions
    .filter((t) => financeFilter === "todos" || t.type === financeFilter || t.status === financeFilter)
    .sort((a, b) => b.date.localeCompare(a.date));
  const tx = monthTx();
  const receita = tx.filter((t) => t.type === "receita" && t.status === "pago").reduce((s, t) => s + t.amount, 0);
  const aReceber = tx.filter((t) => t.type === "receita" && t.status !== "pago").reduce((s, t) => s + t.amount, 0);
  const despesa = tx.filter((t) => t.type === "despesa").reduce((s, t) => s + t.amount, 0);

  root.innerHTML = `
    <div class="kpi-grid">
      <article class="kpi"><p>Recebido no mês</p><strong>${money(receita)}</strong></article>
      <article class="kpi"><p>A receber</p><strong>${money(aReceber)}</strong></article>
      <article class="kpi"><p>Despesas</p><strong>${money(despesa)}</strong></article>
      <article class="kpi"><p>Resultado</p><strong>${money(receita - despesa)}</strong></article>
    </div>
    <div class="toolbar">
      <select id="filtro-fin">
        <option value="todos" ${financeFilter === "todos" ? "selected" : ""}>Todos os lançamentos</option>
        <option value="receita" ${financeFilter === "receita" ? "selected" : ""}>Receitas</option>
        <option value="despesa" ${financeFilter === "despesa" ? "selected" : ""}>Despesas</option>
        <option value="pendente" ${financeFilter === "pendente" ? "selected" : ""}>Pendentes</option>
        <option value="atrasado" ${financeFilter === "atrasado" ? "selected" : ""}>Em atraso</option>
      </select>
    </div>
    <div class="table-wrap stack-table">
      <table>
        <thead>
          <tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          ${
            list.length
              ? list
                  .map(
                    (t) => `<tr>
              <td data-label="Data">${formatDate(t.date)}</td>
              <td data-label="Tipo">${t.type === "receita" ? "Receita" : "Despesa"}</td>
              <td data-label="Descrição">${escapeHtml(t.description)}<br /><span class="muted">${escapeHtml([t.category, paymentMethodLabel(t.paymentMethod)].filter(Boolean).join(" · "))}</span></td>
              <td data-label="Valor">${money(t.amount)}</td>
              <td data-label="Status">${statusChip(t.status)}</td>
              <td class="td-actions">
                <button class="linkish" type="button" data-action="editar-lancamento" data-id="${escapeAttr(t.id)}">Editar</button>
                <button class="linkish danger" type="button" data-action="excluir-lancamento" data-id="${escapeAttr(t.id)}">Excluir</button>
                ${
                  t.status !== "pago"
                    ? `<button class="linkish" type="button" data-action="baixar" data-id="${escapeAttr(t.id)}">Marcar pago</button>`
                    : ""
                }
                ${
                  t.type === "receita" && t.status === "pendente"
                    ? `<button class="linkish danger" type="button" data-action="atrasar" data-id="${escapeAttr(t.id)}">Em atraso</button>`
                    : ""
                }
              </td>
            </tr>`
                  )
                  .join("")
              : `<tr><td colspan="6">Nenhum lançamento.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function lancamentoFromForm(fd, extra = {}) {
  return {
    ...extra,
    type: String(fd.get("type")),
    category: String(fd.get("category")).trim(),
    description: String(fd.get("description")).trim(),
    amount: Number(fd.get("amount")),
    date: String(fd.get("date")),
    status: String(fd.get("status")),
  };
}

function openLancamento(existing) {
  if (isStaff()) return;
  const t = existing || {
    type: "receita",
    category: "",
    description: "",
    amount: "",
    date: todayIso(),
    status: "pago",
  };
  openModal(
    existing ? "Editar lançamento" : "Novo lançamento",
    `
    <form id="form-fin" class="contact-form nested">
      <label>Tipo
        <select name="type">
          <option value="receita" ${t.type === "receita" ? "selected" : ""}>Receita</option>
          <option value="despesa" ${t.type === "despesa" ? "selected" : ""}>Despesa</option>
        </select>
      </label>
      <div class="row-2">
        <label>Categoria <input name="category" required placeholder="Aula, aluguel, material…" value="${escapeAttr(t.category)}" /></label>
        <label>Valor (R$) <input name="amount" type="number" min="0" step="0.01" required value="${escapeAttr(t.amount)}" /></label>
      </div>
      <label>Descrição <input name="description" required value="${escapeAttr(t.description)}" /></label>
      <div class="row-2">
        <label>Data <input type="date" name="date" required value="${escapeAttr(t.date)}" /></label>
        <label>Status
          <select name="status">
            <option value="pago" ${t.status === "pago" ? "selected" : ""}>Pago</option>
            <option value="pendente" ${t.status === "pendente" ? "selected" : ""}>Pendente</option>
            <option value="atrasado" ${t.status === "atrasado" ? "selected" : ""}>Em atraso</option>
          </select>
        </label>
      </div>
      <button class="btn btn-primary" type="submit">${existing ? "Salvar" : "Lançar"}</button>
    </form>
  `
  );
  bindForm("#form-fin", (fd) => {
    if (existing) {
      Object.assign(existing, lancamentoFromForm(fd));
    } else {
      db.transactions.push(lancamentoFromForm(fd, { id: uid("fin") }));
    }
    persist();
    closeModal();
    render();
  });
}

function openDeleteLancamento(id) {
  const t = db.transactions.find((x) => x.id === id);
  if (!t) return;
  openModal(
    "Excluir lançamento",
    `
    <p>Apagar <strong>${escapeHtml(t.description)}</strong> (${money(t.amount)} · ${formatDate(t.date)})? Essa ação não pode ser desfeita.</p>
    <button class="btn btn-danger" type="button" data-action="confirmar-excluir-lancamento" data-id="${escapeAttr(t.id)}">Excluir lançamento</button>
  `
  );
}

function generateClassCharges() {
  if (isStaff()) return;
  const price = Studio.classPrice(db);
  if (!(price > 0)) {
    openModal("Cobranças das aulas", `<p>Defina o valor da aula antes de gerar as cobranças.</p>`);
    return;
  }
  const month = currentMonth();
  let created = 0;
  db.appointments
    .filter((a) => monthKey(a.date) === month && isBillable(a))
    .forEach((a) => {
      if (chargeAppointment(a)) created += 1;
    });
  persist();
  openModal(
    "Cobranças das aulas",
    `<p>${created ? `${created} cobrança(s) gerada(s) no valor de ${money(price)} por aula.` : "Todas as aulas do mês já têm cobrança."}</p>`
  );
  render();
}

function renderValor() {
  const price = Studio.classPrice(db);
  root.innerHTML = `
    <section class="panel valor-panel">
      <h2>Valor da aula</h2>
      <p class="muted">Não há planos nem pacotes. Todas as aulas usam o mesmo valor, em qualquer modalidade.</p>
      <p class="kpi-price">${money(price)}<span> / aula</span></p>
      ${
        isStaff()
          ? ""
          : `<div class="inline-actions">
              <button class="btn btn-primary" type="button" data-action="editar-valor">Alterar valor</button>
            </div>`
      }
    </section>
  `;
}

function openClassPrice() {
  if (isStaff()) return;
  openModal(
    "Valor da aula",
    `
    <form id="form-valor" class="contact-form nested">
      <label>Valor por aula (R$)
        <input name="classPrice" type="number" min="0" step="0.01" required value="${escapeAttr(Studio.classPrice(db))}" />
      </label>
      <p class="muted">Esse valor vale para todas as aulas. Aulas experimentais não geram cobrança.</p>
      <button class="btn btn-primary" type="submit">Salvar</button>
    </form>
  `
  );
  bindForm("#form-valor", (fd) => {
    const n = Number(fd.get("classPrice"));
    if (!Number.isFinite(n) || n < 0) {
      alert("Informe um valor válido.");
      return;
    }
    db.classPrice = n;
    persist();
    closeModal();
    render();
  });
}

function renderTeam() {
  root.innerHTML = `
    <div class="table-wrap stack-table">
      <table>
        <thead>
          <tr>
            <th>Instrutor</th>
            <th>Função</th>
            <th>Especialidades</th>
            <th>Alunos</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${
            db.instructors.length
              ? db.instructors
                  .map((i) => {
                    const n = db.clients.filter((c) => c.instructorId === i.id && c.status === "ativo").length;
                    const aulas = db.appointments.filter((a) => a.instructorId === i.id && a.date === todayIso() && a.status !== "cancelado").length;
                    return `<tr>
                      <td data-label="Instrutor"><strong>${escapeHtml(i.name)}</strong></td>
                      <td data-label="Função">${escapeHtml(i.role || "—")}</td>
                      <td data-label="Especialidades">${escapeHtml(i.specialties || "—")}</td>
                      <td data-label="Alunos">${n} ativos · ${aulas} aula(s) hoje</td>
                      <td class="td-actions">
                        ${
                          canEditInstructor(i)
                            ? `<button class="btn btn-ghost-dark" type="button" data-action="editar-instrutor" data-id="${escapeAttr(i.id)}">Editar</button>`
                            : `<span class="muted">Somente a dona edita</span>`
                        }
                        ${isStaff() || isOwnerInstructor(i) ? "" : `<button class="btn btn-danger" type="button" data-action="excluir-instrutor" data-id="${escapeAttr(i.id)}">Excluir</button>`}
                      </td>
                    </tr>`;
                  })
                  .join("")
              : `<tr><td colspan="5">Nenhum instrutor cadastrado. Use “Novo instrutor”.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function openInstructor(existing) {
  if (existing && !canEditInstructor(existing)) {
    openModal("Instrutor", "<p>Só a Bia pode alterar este perfil.</p>");
    return;
  }
  if (!existing && isStaff()) {
    openModal("Instrutores", "<p>Só a Bia cadastra novos instrutores.</p>");
    return;
  }
  const i = existing || { name: "", role: "Instrutor(a)", specialties: "" };
  openModal(
    existing ? "Editar instrutor" : "Novo instrutor",
    `
    <form id="form-ins" class="contact-form nested">
      <label>Nome <input name="name" required value="${escapeAttr(i.name)}" /></label>
      <label>Função <input name="role" required value="${escapeAttr(i.role)}" /></label>
      <label>Especialidades <input name="specialties" required placeholder="Solo, reformer…" value="${escapeAttr(i.specialties)}" /></label>
      <button class="btn btn-primary" type="submit">${existing ? "Salvar" : "Cadastrar"}</button>
    </form>
  `
  );
  bindForm("#form-ins", (fd) => {
    const data = {
      name: String(fd.get("name")).trim(),
      role: String(fd.get("role")).trim(),
      specialties: String(fd.get("specialties")).trim(),
    };
    if (existing) Object.assign(existing, data);
    else db.instructors.push({ id: uid("ins"), ...data });
    persist();
    closeModal();
    render();
  });
}

function openNewInstructor() {
  openInstructor(null);
}

function openDeleteInstructor(id) {
  if (isStaff()) {
    openModal("Excluir instrutor", "<p>Só a Bia pode excluir instrutores.</p>");
    return;
  }
  const i = db.instructors.find((x) => x.id === id);
  if (!i) return;
  if (isOwnerInstructor(i)) {
    openModal("Excluir instrutor", "<p>O perfil da dona não pode ser excluído.</p>");
    return;
  }
  const outros = db.instructors.filter((x) => x.id !== id);
  if (!outros.length) {
    openModal("Excluir instrutor", `<p>Precisa ficar pelo menos um instrutor no estúdio.</p>`);
    return;
  }
  const nCli = db.clients.filter((c) => c.instructorId === id).length;
  const nApt = db.appointments.filter((a) => a.instructorId === id && a.status !== "cancelado").length;
  openModal(
    "Excluir instrutor",
    `
    <p>Apagar <strong>${escapeHtml(i.name)}</strong>?</p>
    ${
      nCli || nApt
        ? `<p class="muted">${nCli} aluno(s) e ${nApt} aula(s) serão movidos para outro instrutor.</p>
           <form id="form-excluir-ins" class="contact-form nested">
             <label>Mover para
               <select name="moveTo">${outros.map((x) => `<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("")}</select>
             </label>
             <button class="btn btn-danger" type="submit">Mover e excluir</button>
           </form>`
        : `<button class="btn btn-danger" type="button" data-action="confirmar-excluir-instrutor" data-id="${escapeAttr(i.id)}">Excluir</button>`
    }
  `
  );
  bindForm("#form-excluir-ins", (fd) => {
    const moveTo = String(fd.get("moveTo"));
    db.clients.forEach((c) => {
      if (c.instructorId === id) c.instructorId = moveTo;
    });
    db.appointments.forEach((a) => {
      if (a.instructorId === id) a.instructorId = moveTo;
    });
    db.instructors = db.instructors.filter((x) => x.id !== id);
    persist();
    closeModal();
    render();
  });
}

function renderAulas() {
  root.innerHTML = `
    <section class="panel" style="margin-bottom:1.2rem">
      <h2>Formas de aula</h2>
      <p class="muted">Nome, vagas por horário e duração. Isso vale na agenda.</p>
      <div class="cards admin-cards">
        ${(db.modalities || [])
          .map(
            (m) => `<article class="card">
              <h3>${escapeHtml(m.name)}</h3>
              <p>${m.capacity} vagas · ${m.duration} min</p>
              <p>${m.active ? statusChip("ativo") : statusChip("inativo")}</p>
              <div class="inline-actions">
                <button class="linkish" type="button" data-action="editar-modalidade" data-id="${escapeAttr(m.id)}">Editar</button>
                <button class="linkish" type="button" data-action="toggle-modalidade" data-id="${escapeAttr(m.id)}">${m.active ? "Desativar" : "Reativar"}</button>
                <button class="linkish danger" type="button" data-action="excluir-modalidade" data-id="${escapeAttr(m.id)}">Excluir</button>
              </div>
            </article>`
          )
          .join("")}
      </div>
    </section>
    <section class="panel">
      <h2>Horários da grade</h2>
      <p class="muted">Os horários que aparecem na agenda. Você pode incluir, mudar ou apagar.</p>
      <div class="table-wrap stack-table">
        <table>
          <thead><tr><th>Horário</th><th></th></tr></thead>
          <tbody>
            ${(db.times || [])
              .map(
                (t) => `<tr>
                  <td data-label="Horário">${escapeHtml(t)}</td>
                  <td class="td-actions">
                    <button class="linkish" type="button" data-action="editar-horario" data-time="${escapeAttr(t)}">Editar</button>
                    <button class="linkish danger" type="button" data-action="excluir-horario" data-time="${escapeAttr(t)}">Excluir</button>
                  </td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function openModality(existing) {
  const m = existing || { name: "", capacity: 4, duration: 50, active: true };
  openModal(
    existing ? "Editar forma de aula" : "Nova forma de aula",
    `
    <form id="form-mod" class="contact-form nested">
      <label>Nome <input name="name" required value="${escapeAttr(m.name)}" placeholder="Ex.: Cadillac, Solo avançado" /></label>
      <div class="row-2">
        <label>Vagas por horário <input name="capacity" type="number" min="1" max="20" required value="${escapeAttr(m.capacity)}" /></label>
        <label>Duração (min) <input name="duration" type="number" min="15" max="120" required value="${escapeAttr(m.duration)}" /></label>
      </div>
      ${
        existing
          ? `<label>Situação
              <select name="active">
                <option value="sim" ${m.active ? "selected" : ""}>Ativa</option>
                <option value="nao" ${!m.active ? "selected" : ""}>Inativa</option>
              </select>
            </label>`
          : ""
      }
      <button class="btn btn-primary" type="submit">${existing ? "Salvar" : "Criar"}</button>
    </form>
  `
  );
  bindForm("#form-mod", (fd) => {
    const name = String(fd.get("name")).trim();
    const data = {
      name,
      capacity: Number(fd.get("capacity")),
      duration: Number(fd.get("duration")),
      active: existing ? fd.get("active") === "sim" : true,
    };
    const dup = (db.modalities || []).some((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== existing?.id);
    if (dup) {
      alert("Já existe uma forma de aula com esse nome.");
      return;
    }
    if (existing) {
      const oldName = existing.name;
      Object.assign(existing, data);
      if (oldName !== name) {
        db.appointments.forEach((a) => {
          if (a.modality === oldName) a.modality = name;
        });
      }
    } else {
      db.modalities = db.modalities || [];
      db.modalities.push({ id: uid("mod"), ...data });
    }
    persist();
    closeModal();
    render();
  });
}

function openDeleteModality(id) {
  const m = (db.modalities || []).find((x) => x.id === id);
  if (!m) return;
  const usedApt = db.appointments.filter((a) => a.modality === m.name && a.status !== "cancelado").length;
  const outros = (db.modalities || []).filter((x) => x.id !== id);
  if (usedApt && !outros.length) {
    openModal("Excluir forma de aula", `<p>Não dá para apagar a última forma de aula enquanto houver agendamentos nela.</p>`);
    return;
  }
  openModal(
    "Excluir forma de aula",
    `
    <p>Apagar <strong>${escapeHtml(m.name)}</strong>?</p>
    ${
      usedApt
        ? `<p class="muted">${usedApt} aula(s) serão movidas.</p>
           <form id="form-excluir-mod" class="contact-form nested">
             <label>Mover para
               <select name="moveTo">${outros.map((x) => `<option value="${x.name}">${escapeHtml(x.name)}</option>`).join("")}</select>
             </label>
             <button class="btn btn-danger" type="submit">Mover e excluir</button>
           </form>`
        : `<button class="btn btn-danger" type="button" data-action="confirmar-excluir-modalidade" data-id="${escapeAttr(m.id)}">Excluir</button>`
    }
  `
  );
  bindForm("#form-excluir-mod", (fd) => {
    const moveTo = String(fd.get("moveTo"));
    db.appointments.forEach((a) => {
      if (a.modality === m.name) a.modality = moveTo;
    });
    db.modalities = db.modalities.filter((x) => x.id !== id);
    persist();
    closeModal();
    render();
  });
}

function openTime(oldTime) {
  openModal(
    oldTime ? "Editar horário" : "Novo horário",
    `
    <form id="form-time" class="contact-form nested">
      <label>Horário <input type="time" name="time" required value="${oldTime || "10:00"}" /></label>
      <button class="btn btn-primary" type="submit">Salvar</button>
    </form>
  `
  );
  bindForm("#form-time", (fd) => {
    const time = String(fd.get("time")).slice(0, 5);
    if (!time) return;
    db.times = db.times || [];
    if (db.times.includes(time) && time !== oldTime) {
      alert("Esse horário já está na grade.");
      return;
    }
    if (oldTime) {
      db.times = db.times.map((t) => (t === oldTime ? time : t));
      db.appointments.forEach((a) => {
        if (a.time === oldTime) a.time = time;
      });
    } else {
      db.times.push(time);
    }
    db.times = [...new Set(db.times)].sort();
    persist();
    closeModal();
    render();
  });
}

function openDeleteClient(id) {
  const c = Studio.client(db, id);
  if (!c) return;
  openModal(
    "Excluir aluno",
    `
    <p>Apagar o cadastro de <strong>${escapeHtml(c.name)}</strong>? Aulas e lançamentos ligados a essa pessoa também saem.</p>
    <button class="btn btn-danger" type="button" data-action="confirmar-excluir-cliente" data-id="${escapeAttr(c.id)}">Excluir cadastro</button>
  `
  );
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, "&#39;");
}

document.querySelector("#form-admin-login")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const status = document.querySelector("#login-status");
  status.textContent = "Entrando…";
  const user = await Studio.login(String(fd.get("email")), String(fd.get("password")));
  currentUser = user;
  if (!user) {
    status.textContent = "E-mail ou senha incorretos.";
    return;
  }
  try {
    db = await Studio.load();
    status.textContent = "";
    await showApp();
  } catch (err) {
    status.textContent = err.message || "Não foi possível carregar os dados.";
  }
});

document.querySelector("#btn-logout")?.addEventListener("click", async () => {
  await Studio.logout();
  currentUser = null;
  db = emptyStudio();
  await showApp();
});

document.querySelector(".admin-nav")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-view]");
  if (!btn) return;
  view = btn.dataset.view;
  if (isStaff() && view === "financeiro") view = "inicio";
  window.scrollTo(0, 0);
  render();
});

document.querySelector("#view-actions")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const a = btn.dataset.action;
  if (a === "novo-cliente") openNewClient();
  if (a === "novo-agendamento") openNewAppointment();
  if (a === "aula-experimental") openNewAppointment({ kind: "experimental" });
  if (a === "novo-lancamento") {
    if (isStaff()) return;
    openLancamento(null);
  }
  if (a === "gerar-aulas") {
    if (isStaff()) return;
    generateClassCharges();
  }
  if (a === "editar-valor") openClassPrice();
  if (a === "novo-instrutor") {
    if (isStaff()) return;
    openNewInstructor();
  }
  if (a === "nova-modalidade") openModality(null);
  if (a === "novo-horario") openTime(null);
});

root.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const a = btn.dataset.action;
  const id = btn.dataset.id;
  if (a === "editar-cliente") openEditClient(id);
  if (a === "cancelar-cliente") openCancelClient(id);
  if (a === "reativar-cliente") {
    const c = Studio.client(db, id);
    if (c) {
      c.status = "ativo";
      delete c.canceledAt;
      delete c.cancelReason;
      persist();
      render();
    }
  }
  if (a === "semana-prev") {
    weekOffset -= 1;
    render();
  }
  if (a === "semana-next") {
    weekOffset += 1;
    render();
  }
  if (a === "mes-prev") {
    shiftAgendaMonth(-1);
    render();
  }
  if (a === "mes-next") {
    shiftAgendaMonth(1);
    render();
  }
  if (a === "semana-hoje") {
    weekOffset = 0;
    agendaDayIndex = Math.min(5, (new Date().getDay() + 6) % 7);
    render();
  }
  if (a === "agenda-dia") {
    agendaDayIndex = Number(btn.dataset.index) || 0;
    render();
  }
  if (a === "slot") openSlot(btn.dataset.date, btn.dataset.time);
  if (a === "baixar") {
    if (isStaff()) return;
    const t = db.transactions.find((x) => x.id === id);
    if (t) {
      t.status = "pago";
      persist();
      render();
    }
  }
  if (a === "atrasar") {
    if (isStaff()) return;
    const t = db.transactions.find((x) => x.id === id);
    if (t) {
      t.status = "atrasado";
      persist();
      render();
    }
  }
  if (a === "editar-lancamento") {
    if (isStaff()) return;
    const t = db.transactions.find((x) => x.id === id);
    if (t) openLancamento(t);
  }
  if (a === "excluir-lancamento") openDeleteLancamento(id);
  if (a === "editar-valor") openClassPrice();
  if (a === "excluir-cliente") openDeleteClient(id);
  if (a === "editar-instrutor") {
    const i = db.instructors.find((x) => String(x.id) === String(id));
    if (i) openInstructor(i);
    else openModal("Editar instrutor", "<p>Não achei este instrutor. Atualize a página e tente de novo.</p>");
  }
  if (a === "excluir-instrutor") openDeleteInstructor(id);
  if (a === "editar-modalidade") {
    const m = (db.modalities || []).find((x) => x.id === id);
    if (m) openModality(m);
  }
  if (a === "toggle-modalidade") {
    const m = (db.modalities || []).find((x) => x.id === id);
    if (m) {
      m.active = !m.active;
      persist();
      render();
    }
  }
  if (a === "excluir-modalidade") openDeleteModality(id);
  if (a === "editar-horario") openTime(btn.dataset.time);
  if (a === "excluir-horario") {
    const time = btn.dataset.time;
    openModal(
      "Excluir horário",
      `<p>Tirar <strong>${escapeHtml(time)}</strong> da grade? Aulas nesse horário continuam no histórico, mas o slot some da agenda se não houver ninguém marcado.</p>
       <button class="btn btn-danger" type="button" data-action="confirmar-excluir-horario" data-time="${escapeAttr(time)}">Excluir horário</button>`
    );
  }
});

root.addEventListener("input", (e) => {
  if (e.target.id === "busca-cliente") {
    clientQuery = e.target.value;
    renderClients();
    document.querySelector("#busca-cliente")?.focus();
    const el = document.querySelector("#busca-cliente");
    if (el) el.selectionStart = el.selectionEnd = el.value.length;
  }
});

root.addEventListener("change", (e) => {
  if (e.target.id === "filtro-cliente") {
    clientFilter = e.target.value;
    render();
  }
  if (e.target.id === "filtro-fin") {
    financeFilter = e.target.value;
    render();
  }
  if (e.target.id === "agenda-mes" || e.target.id === "agenda-ano") {
    const monthEl = document.querySelector("#agenda-mes");
    const yearEl = document.querySelector("#agenda-ano");
    const month = Number(monthEl?.value);
    const year = Number(yearEl?.value);
    if (Number.isInteger(month) && Number.isInteger(year)) {
      goToMonth(year, month);
      render();
    }
  }
});

document.querySelector("#modal-close")?.addEventListener("click", closeModal);
modalEl.addEventListener("click", (e) => {
  if (e.target === modalEl) closeModal();
});

modalBody.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const a = btn.dataset.action;
  const id = btn.dataset.id;
  if (a === "presenca" || a === "falta") {
    const apt = db.appointments.find((x) => x.id === id);
    if (apt) {
      apt.status = a === "presenca" ? "concluido" : "faltou";
      if (a === "presenca" || a === "falta") chargeAppointment(apt);
      persist();
      closeModal();
      render();
    }
  }
  if (a === "editar-aula") {
    const apt = db.appointments.find((x) => x.id === id);
    if (apt) {
      closeModal();
      openAppointment(apt);
    }
  }
  if (a === "remover-aula") {
    const apt = db.appointments.find((x) => x.id === id);
    if (!apt) return;
    openModal(
      "Remover da agenda",
      `<p>Tirar <strong>${escapeHtml(personLabel(apt))}</strong> de ${escapeHtml(apt.time)} · ${formatDate(apt.date)}?</p>
       <button class="btn btn-danger" type="button" data-action="confirmar-remover-aula" data-id="${escapeAttr(apt.id)}">Remover</button>`
    );
  }
  if (a === "confirmar-remover-aula") {
    db.appointments = db.appointments.filter((x) => x.id !== id);
    db.transactions = db.transactions.filter((t) => !(t.appointmentId === id && t.status === "pendente"));
    persist();
    closeModal();
    render();
  }
  if (a === "agendar-neste") {
    closeModal();
    openNewAppointment({ date: btn.dataset.date, time: btn.dataset.time });
  }
  if (a === "experimental-neste") {
    closeModal();
    openNewAppointment({ date: btn.dataset.date, time: btn.dataset.time, kind: "experimental" });
  }
  if (a === "confirmar-excluir-lancamento") {
    db.transactions = db.transactions.filter((x) => x.id !== id);
    persist();
    closeModal();
    render();
  }
  if (a === "confirmar-excluir-cliente") {
    db.appointments = db.appointments.filter((x) => x.clientId !== id);
    db.transactions = db.transactions.filter((x) => x.clientId !== id);
    db.clients = db.clients.filter((x) => x.id !== id);
    persist();
    closeModal();
    render();
  }
  if (a === "confirmar-excluir-instrutor") {
    db.instructors = db.instructors.filter((x) => x.id !== id);
    persist();
    closeModal();
    render();
  }
  if (a === "confirmar-excluir-modalidade") {
    db.modalities = (db.modalities || []).filter((x) => x.id !== id);
    persist();
    closeModal();
    render();
  }
  if (a === "confirmar-excluir-horario") {
    const time = btn.dataset.time;
    db.times = (db.times || []).filter((t) => t !== time);
    persist();
    closeModal();
    render();
  }
});

async function boot() {
  const user = await Studio.session();
  if (user) {
    try {
      db = await Studio.load();
    } catch {
      db = emptyStudio();
    }
  }
  await showApp();
}

boot();
