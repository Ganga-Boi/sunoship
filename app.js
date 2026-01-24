console.log("SunoShip – stable baseline");

document.addEventListener("DOMContentLoaded", () => {
  const enhanceBtn = document.getElementById("processEnhance");
  enhanceBtn.addEventListener("click", runEnhance);
});

function runEnhance() {
  showProgress(true);
  updateProgress("Starter…", 0);

  setTimeout(() => updateProgress("Processerer…", 50), 500);
  setTimeout(() => finishEnhance(), 1200);
}

function finishEnhance() {
  updateProgress("Færdig!", 100);
  toast("Enhancement færdig");
  setTimeout(() => showProgress(false), 800);
}

function showProgress(show) {
  const box = document.getElementById("enhanceProgress");
  if (!box) return;
  box.classList.toggle("hidden", !show);
}

function updateProgress(text, percent) {
  const t = document.getElementById("progressText");
  const p = document.getElementById("progressPercent");
  const b = document.getElementById("enhanceProgressBar");

  if (t) t.textContent = text;
  if (p) p.textContent = percent + "%";
  if (b) b.style.width = percent + "%";
}

function toast(msg) {
  const box = document.getElementById("toasts");
  if (!box) return;

  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  box.appendChild(el);

  setTimeout(() => el.remove(), 3000);
}
