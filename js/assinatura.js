const hello = document.querySelector("#hello");
const helloEmail = document.querySelector("#hello-email");
const planosEl = document.querySelector("#planos");
const cardsEl = document.querySelector("#cards");
const pagamentosEl = document.querySelector("#pagamentos");
const subStatus = document.querySelector("#sub-status");
const btnCancelar = document.querySelector("#btn-cancelar");
const btnSair = document.querySelector("#btn-sair");
const linkAdmin = document.querySelector("#link-admin");
const formCartao = document.querySelector("#form-cartao");

let state = { user: null, plans: [], cards: [], subscription: null, payments: [] };

async function requireUser() {
  try {
    const data = await api("/api/me");
    state.user = data.user;
    hello.textContent = `Olá, ${data.user.name}`;
    helloEmail.textContent = data.user.email;
    if (data.user.role === "admin" || data.user.role === "staff") linkAdmin.hidden = false;
  } catch {
    window.location.href = "conta.html";
  }
}

function renderPlans() {
  const active = state.subscription?.status === "ativa";
  planosEl.innerHTML = state.plans
    .map(
      (plan) => `
      <article class="plan-card">
        <div>
          <h3>${plan.name}</h3>
          <p>${plan.description}</p>
          <p class="meta">${money(plan.price)} / ${plan.interval}</p>
        </div>
        <button class="btn btn-primary" data-plan="${plan.id}" ${active ? "disabled" : ""}>
          ${active ? "Assinatura ativa" : "Assinar"}
        </button>
      </article>`
    )
    .join("");

  planosEl.querySelectorAll("[data-plan]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const card = state.cards[0];
      if (!card) {
        subStatus.textContent = "Cadastre um cartão de teste antes de assinar.";
        return;
      }
      try {
        await api("/api/subscribe", { body: { planId: btn.dataset.plan, cardId: card.id } });
        await loadBilling();
      } catch (err) {
        subStatus.textContent = err.message;
      }
    });
  });
}

function renderCards() {
  if (!state.cards.length) {
    cardsEl.innerHTML = `<p class="muted">Nenhum cartão tokenizado ainda.</p>`;
    return;
  }
  cardsEl.innerHTML = state.cards
    .map(
      (card) => `
      <div class="card-row">
        <span>${card.brand} •••• ${card.last4} · ${String(card.expMonth).padStart(2, "0")}/${card.expYear}</span>
        <button class="linkish" data-del="${card.id}" type="button">Remover</button>
      </div>`
    )
    .join("");

  cardsEl.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api(`/api/cards/${btn.dataset.del}`, { method: "DELETE" });
        await loadBilling();
      } catch (err) {
        formCartao.querySelector(".form-status").textContent = err.message;
      }
    });
  });
}

function renderSubscription() {
  const sub = state.subscription;
  if (!sub) {
    subStatus.textContent = "Você ainda não é assinante. Escolha um plano depois de cadastrar o cartão.";
    btnCancelar.hidden = true;
    return;
  }
  const planName = state.plans.find((p) => p.id === sub.planId)?.name || sub.planId;
  subStatus.textContent = `Status: ${sub.status} · ${planName} · próximo ciclo ${formatDate(sub.nextBillingAt)}`;
  btnCancelar.hidden = sub.status !== "ativa";
}

function renderPayments() {
  if (!state.payments.length) {
    pagamentosEl.innerHTML = `<p class="muted">Nenhuma cobrança ainda.</p>`;
    return;
  }
  pagamentosEl.innerHTML = `
    <ul class="pay-list">
      ${state.payments
        .map(
          (p) =>
            `<li>${formatDate(p.createdAt)} · ${money(p.amount)} · ${p.status} · ${p.method || ""}</li>`
        )
        .join("")}
    </ul>`;
}

async function loadBilling() {
  const [plans, cards, sub] = await Promise.all([
    api("/api/plans"),
    api("/api/cards"),
    api("/api/subscription"),
  ]);
  state.plans = plans.plans;
  state.cards = cards.cards;
  state.subscription = sub.subscription;
  state.payments = sub.payments || [];
  renderPlans();
  renderCards();
  renderSubscription();
  renderPayments();
}

formCartao?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = formCartao.querySelector(".form-status");
  const data = Object.fromEntries(new FormData(formCartao).entries());
  try {
    await api("/api/cards", { body: data });
    formCartao.reset();
    formCartao.expMonth.value = "12";
    formCartao.expYear.value = "2028";
    status.textContent = "Cartão tokenizado. O número completo não foi salvo.";
    await loadBilling();
  } catch (err) {
    status.textContent = err.message;
  }
});

btnCancelar?.addEventListener("click", async () => {
  try {
    await api("/api/subscribe/cancel"); 
    await loadBilling();
  } catch (err) {
    subStatus.textContent = err.message;
  }
});

btnSair?.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  window.location.href = "conta.html";
});

(async function init() {
  await requireUser();
  await loadBilling();
})();
