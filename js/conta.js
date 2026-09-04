const loginForm = document.querySelector("#form-login");
const registerForm = document.querySelector("#form-register");

function setStatus(form, message) {
  const el = form.querySelector(".form-status");
  if (el) el.textContent = message;
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(loginForm).entries());
  try {
    const res = await api("/api/login", { body: data });
    window.location.href = ["admin", "staff"].includes(res.user?.role) ? "admin.html" : "assinatura.html";
  } catch (err) {
    setStatus(loginForm, err.message);
  }
});

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(registerForm).entries());
  try {
    await api("/api/register", { body: data });
    window.location.href = "assinatura.html";
  } catch (err) {
    setStatus(registerForm, err.message);
  }
});

