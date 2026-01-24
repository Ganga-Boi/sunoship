(() => {
  const elements = {};

  function initElements() {
    elements.processEnhance = document.getElementById('processEnhance');
    elements.enhanceProgress = document.getElementById('enhanceProgress');
    elements.progressText = document.getElementById('progressText');
    elements.progressPercent = document.getElementById('progressPercent');
    elements.enhanceProgressBar = document.getElementById('enhanceProgressBar');
    elements.toasts = document.getElementById('toasts');
  }

  function showToast(msg) {
    if (!elements.toasts) return;
    const t = document.createElement('div');
    t.className = 'toast error';
    t.textContent = msg;
    elements.toasts.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  function safeText(el, txt) {
    if (el) el.textContent = txt;
  }

  function safeStyle(el, prop, val) {
    if (el) el.style[prop] = val;
  }

  function processEnhancement() {
    if (!elements.enhanceProgress) return;

    elements.enhanceProgress.classList.remove('hidden');
    safeText(elements.progressText, 'Processerer...');
    safeText(elements.progressPercent, '0%');
    safeStyle(elements.enhanceProgressBar, 'width', '0%');

    let p = 0;
    const iv = setInterval(() => {
      p += 10;
      safeText(elements.progressPercent, `${p}%`);
      safeStyle(elements.enhanceProgressBar, 'width', `${p}%`);
      if (p >= 100) {
        clearInterval(iv);
        safeText(elements.progressText, 'Færdig');
      }
    }, 200);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initElements();

    if (elements.processEnhance) {
      elements.processEnhance.addEventListener('click', () => {
        try {
          processEnhancement();
        } catch (e) {
          showToast('Fejl under enhancement');
          console.error(e);
        }
      });
    }
  });
})();
