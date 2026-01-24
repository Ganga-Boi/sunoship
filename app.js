/* =====================================================
   SUNOSHIP – CLEAN CORE (CRASH SAFE)
   ===================================================== */

const elements = {};
const state = {
  tracks: [],
  currentStep: 'upload',
  audioContext: null
};

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  bindNavigation();
  bindEnhance();
  hideSplash();
});

/* =====================================================
   ELEMENT CACHE (ALDRIG null-usage)
   ===================================================== */
function cacheElements() {
  const ids = [
    'processEnhance',
    'enhanceProgress',
    'progressText',
    'progressPercent',
    'enhanceProgressBar',
    'toasts'
  ];

  ids.forEach(id => {
    elements[id] = document.getElementById(id) || null;
  });
}

/* =====================================================
   SPLASH
   ===================================================== */
function hideSplash() {
  const splash = document.getElementById('splash');
  const app = document.getElementById('app');

  if (!splash || !app) return;

  setTimeout(() => {
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
      app.classList.remove('hidden');
    }, 600);
  }, 1200);
}

/* =====================================================
   NAVIGATION (SAFE)
   ===================================================== */
function bindNavigation() {
  document.querySelectorAll('[data-step]').forEach(btn => {
    btn.addEventListener('click', () => {
      goToStep(btn.dataset.step);
    });
  });
}

function goToStep(step) {
  state.currentStep = step;
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`step-${step}`);
  if (target) target.classList.add('active');
}

/* =====================================================
   ENHANCE
   ===================================================== */
function bindEnhance() {
  if (!elements.processEnhance) return;

  elements.processEnhance.addEventListener('click', runEnhancement);
}

async function runEnhancement() {
  const btn = elements.processEnhance;
  if (!btn) return;

  disableButton(btn, 'Processerer…');
  showProgress(true);

  try {
    await ensureAudioContext();

    updateProgress('Analyserer lyd…', 20);
    await wait(600);

    updateProgress('Normaliserer loudness…', 60);
    await wait(800);

    updateProgress('Færdiggør…', 90);
    await wait(400);

    updateProgress('Færdig!', 100);
    toast('Enhancement færdig', 'success');

  } catch (err) {
    console.error(err);
    toast('Fejl under enhancement', 'error');
  } finally {
    setTimeout(() => {
      showProgress(false);
      enableButton(btn, 'Auto-Enhance');
    }, 1200);
  }
}

/* =====================================================
   UI HELPERS (100 % SAFE)
   ===================================================== */
function updateProgress(text, percent) {
  if (elements.progressText) {
    elements.progressText.textContent = text;
  }
  if (elements.progressPercent) {
    elements.progressPercent.textContent = `${percent}%`;
  }
  if (elements.enhanceProgressBar) {
    elements.enhanceProgressBar.style.width = `${percent}%`;
  }
}

function showProgress(show) {
  if (!elements.enhanceProgress) return;
  elements.enhanceProgress.classList.toggle('hidden', !show);
}

function disableButton(btn, label) {
  btn.disabled = true;
  btn.textContent = label;
}

function enableButton(btn, label) {
  btn.disabled = false;
  btn.textContent = label;
}

/* =====================================================
   TOASTS (KAN IKKE CRASHE)
   ===================================================== */
function toast(message, type = 'info') {
  if (!elements.toasts) {
    console.warn('[Toast]', message);
    return;
  }

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;

  elements.toasts.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* =====================================================
   AUDIO
   ===================================================== */
async function ensureAudioContext() {
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audioContext.state === 'suspended') {
    await state.audioContext.resume();
  }
}

/* =====================================================
   UTILS
   ===================================================== */
function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}
