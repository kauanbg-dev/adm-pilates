(() => {
  if (!("serviceWorker" in navigator)) return;

  const btn = document.getElementById("btn-install-app");
  let deferredPrompt = null;

  navigator.serviceWorker.register("/sw.js").catch(() => {
    /* silencioso: app ainda funciona sem SW em HTTP local antigo */
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (btn) btn.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    if (btn) btn.hidden = true;
  });

  if (btn) {
    btn.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      btn.hidden = true;
    });
  }

  // Já instalado / stand-alone: esconde o botão.
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (standalone && btn) btn.hidden = true;
})();
