console.log("🚢 SunoShip — CLEAN BUILD");

document.addEventListener("DOMContentLoaded", () => {

    // SPLASH
    const splash = document.getElementById("splash");
    const app = document.getElementById("app");

    if (splash && app) {
        setTimeout(() => {
            splash.remove();
            app.classList.remove("hidden");
        }, 500);
    }

    const btn = document.getElementById("processEnhance");
    if (!btn) return;

    btn.addEventListener("click", runEnhance);
});

function runEnhance() {

    // 🔒 HENT ALT VIA SAFE LOOKUP
    const progressBox = document.getElementById("enhanceProgress");
    const textEl = document.getElementById("progressText");
    const percentEl = document.getElementById("progressPercent");
    const barEl = document.getElementById("enhanceProgressBar");

    // 🔴 HVIS NOGET MANGLER → STOP STILLE
    if (!progressBox || !textEl || !percentEl || !barEl) {
        console.warn("Enhance UI mangler – stopper uden crash");
        return;
    }

    progressBox.classList.remove("hidden");

    updateProgress("Starter…", 0);

    setTimeout(() => updateProgress("Analyserer audio…", 25), 400);
    setTimeout(() => updateProgress("EQ + Loudness…", 55), 800);
    setTimeout(() => updateProgress("Limiter…", 80), 1200);

    setTimeout(() => {
        updateProgress("Færdig!", 100);
        toast("Enhancement færdig ✔");
    }, 1600);

    function updateProgress(text, percent) {
        textEl.textContent = text;
        percentEl.textContent = percent + "%";
        barEl.style.width = percent + "%";
    }
}

function toast(msg) {
    const box = document.getElementById("toasts");
    if (!box) return;

    const el = document.createElement("div");
    el.textContent = msg;
    el.style.margin = "8px";
    el.style.color = "#1DB954";

    box.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}
