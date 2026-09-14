const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const scrim = document.querySelector("#nav-scrim");
const form = document.querySelector("#form-aula");
const statusEl = document.querySelector(".form-status");

function setMenu(open) {
  if (!toggle || !nav) return;
  nav.classList.toggle("open", open);
  toggle.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("nav-open", open);
  if (scrim) scrim.hidden = !open;
}

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    setMenu(!nav.classList.contains("open"));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenu(false));
  });

  scrim?.addEventListener("click", () => setMenu(false));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenu(false);
  });
}

if (form && statusEl) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      statusEl.textContent = "Preencha nome, e-mail, telefone e o tipo de aula.";
      form.reportValidity();
      return;
    }

    statusEl.textContent = "Pedido enviado. Retornamos em até um dia útil.";
    form.reset();
  });
}

const revealTargets = document.querySelectorAll(
  ".hero-copy, .hero-logo, .about-photo, .section-head, .card, .shot, .person, .contact-form, .map-shell, .contact-social, .strip p"
);
revealTargets.forEach((el, i) => {
  el.classList.add("reveal");
  if (i % 3 === 1) el.classList.add("reveal-delay-1");
  if (i % 3 === 2) el.classList.add("reveal-delay-2");
});

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );
  document.querySelectorAll(".reveal").forEach((el) => {
    const top = el.getBoundingClientRect().top;
    if (top < window.innerHeight * 0.9) el.classList.add("is-visible");
    else io.observe(el);
  });
} else {
  document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
}
