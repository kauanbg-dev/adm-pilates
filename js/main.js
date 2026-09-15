const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const scrim = document.querySelector("#nav-scrim");
const navLinks = document.querySelectorAll(".nav-links a");

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

if (navLinks.length && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const sectionIds = [...navLinks].map((a) => a.getAttribute("href")).filter((href) => href && href.startsWith("#"));
  const sections = sectionIds.map((href) => document.querySelector(href)).filter(Boolean);
  if (sections.length) {
    const ioNav = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${visible.target.id}`));
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.2, 0.5] }
    );
    sections.forEach((section) => ioNav.observe(section));
  }
}

const revealTargets = document.querySelectorAll(
  ".hero-copy, .hero-logo, .about-photo, .section-head, .card, .gallery-logo, .person, .map-shell, .local-experimental, .contact-social, .strip p"
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
