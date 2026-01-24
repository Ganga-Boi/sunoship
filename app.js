(() => {
  'use strict';

  const el = {};

  function initElements() {
    el.enhanceBtn = document.getElementById('enhanceBtn');
    el.enhanceProgress = document.getElementById('enhanceProgress');
    el.progressText = document.getElementById('progressText');
    el.progressPercent = document.getElementById('progressPercent');
    el.progressBar = document.getElementById('enhanceProgressBar');
    el.errorBox = document.getElementById('errorBox');
  }

  function safeText(node, value) {
    if (node) node.textContent = value;
  }

  function showError(msg) {
    if (!el.errorBox) return;
    el.errorBox.textContent = msg;
    el.errorBox.classList.remove('hidden');
  }

  function simulateEnhancement() {
    if (!el.enhanceProgress) return;

    el.enhanceProgress.classList.remove('hidden');
    safeText(el.progressText, 'Processerer…');
    safeText(el.progressPercent, '0%');
    if (el.progressBar) el.progressBar.style.width = '0%';

    let p = 0;
    const timer = setInterval(() => {
      p += 10;
      safeText(el.progressPercent, `${p}%`);
      if (el.progressBar) el.progressBar.style.width = `${p}%`;

      if (p >= 100) {
        clearInterval(timer);
        safeText(el.progressText, 'Færdig');
      }
    }, 300);
  }

  function bindEvents() {
    if (!el.enhanceBtn) return;
    el.enhanceBtn.addEventListener('click', simulateEnhancement);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initElements();
    bindEvents();
  });

})();
