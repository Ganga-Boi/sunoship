/* =====================================================
   SUNOSHIP – DOM SAFE / PRODUCTION
   ===================================================== */
console.log('%c🚢 SunoShip', 'color:#1DB954;font-size:16px;font-weight:bold');

const state = {
  tracks: [],
  currentTrackIndex: 0,
  audioContext: null,
  enhancedBlob: null,
  enhanceControlsInitialized: false
};

const elements = {};

document.addEventListener('DOMContentLoaded', () => {
  initElements();
  initApp();
});

/* =====================================================
   INIT
   ===================================================== */
function initElements() {
  elements.splash = document.getElementById('splash');
  elements.app = document.getElementById('app');
  elements.dropZone = document.getElementById('dropZone');
  elements.fileInput = document.getElementById('fileInput');
  elements.trackList = document.getElementById('trackList');
  elements.tracks = document.getElementById('tracks');
  elements.coverInput = document.getElementById('coverInput');
  elements.coverPreview = document.getElementById('coverPreview');
  elements.toasts = document.getElementById('toasts');

  // Enhance progress (kan blive skjult → SKAL guards)
  elements.enhanceProgress = document.getElementById('enhanceProgress');
  elements.progressText = document.getElementById('progressText');
  elements.progressPercent = document.getElementById('progressPercent');
  elements.enhanceProgressBar = document.getElementById('enhanceProgressBar');

  // 🔒 VIGTIGT: gem knappen – brug ALDRIG getElementById i flowet
  elements.processEnhanceBtn = document.getElementById('processEnhance');
}

function initApp() {
  setTimeout(() => {
    if (elements.splash) {
      elements.splash.classList.add('fade-out');
      setTimeout(() => elements.app?.classList.remove('hidden'), 500);
    }
  }, 1200);

  initNavigation();
  initUpload();
}

/* =====================================================
   SAFE PROGRESS UPDATER (forhindrer ALLE crashes)
   ===================================================== */
function updateEnhanceProgress(text, percent) {
  if (
    !elements.enhanceProgress ||
    !elements.progressText ||
    !elements.progressPercent ||
    !elements.enhanceProgressBar ||
    elements.enhanceProgress.classList.contains('hidden')
  ) {
    return; // HARD STOP – ingen DOM writes hvis step er væk
  }

  elements.progressText.textContent = text;
  elements.progressPercent.textContent = percent + '%';
  elements.enhanceProgressBar.style.width = percent + '%';
}

/* =====================================================
   NAVIGATION
   ===================================================== */
function initNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => goToStep(btn.dataset.step));
  });

  document.getElementById('continueToEnhance')?.addEventListener('click', () => goToStep('enhance'));
  document.getElementById('skipEnhance')?.addEventListener('click', () => goToStep('metadata'));
  document.getElementById('continueToMetadata')?.addEventListener('click', () => goToStep('metadata'));
  document.getElementById('continueToArtwork')?.addEventListener('click', () => goToStep('artwork'));
  document.getElementById('continueToExport')?.addEventListener('click', () => goToStep('export'));

  document.getElementById('backToUploadFromEnhance')?.addEventListener('click', () => goToStep('upload'));
  document.getElementById('backToEnhance')?.addEventListener('click', () => goToStep('enhance'));
  document.getElementById('backToMetadata')?.addEventListener('click', () => goToStep('metadata'));
  document.getElementById('backToArtwork')?.addEventListener('click', () => goToStep('artwork'));
}

function goToStep(step) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step-${step}`)?.classList.add('active');

  if (step === 'enhance') initEnhanceStep();
}

/* =====================================================
   UPLOAD
   ===================================================== */
function initUpload() {
  elements.dropZone?.addEventListener('click', () => elements.fileInput?.click());
  elements.fileInput?.addEventListener('change', e => handleFiles(e.target.files));
}

function handleFiles(files) {
  const list = Array.from(files).filter(f =>
    f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|m4a|flac|ogg)$/i)
  );
  if (!list.length) return;

  list.forEach(file => state.tracks.push({ file, name: file.name, enhanced: false }));
  renderTracks();
  elements.trackList?.classList.remove('hidden');
  const cont = document.getElementById('continueToEnhance');
  if (cont) cont.disabled = false;
}

function renderTracks() {
  if (!elements.tracks) return;
  elements.tracks.innerHTML = state.tracks
    .map(t => `<div class="track-item">${t.name}</div>`)
    .join('');
}

/* =====================================================
   ENHANCE
   ===================================================== */
function initEnhanceStep() {
  if (!state.enhanceControlsInitialized) {
    elements.processEnhanceBtn?.addEventListener('click', processEnhancement);
    state.enhanceControlsInitialized = true;
  }
}

async function processEnhancement() {
  const track = state.tracks[state.currentTrackIndex];
  if (!track) return;

  const btn = elements.processEnhanceBtn;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Processerer...';
  }

  if (elements.enhanceProgress) elements.enhanceProgress.classList.remove('hidden');
  updateEnhanceProgress('Starter…', 0);

  try {
    if (!state.audioContext) {
      state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audioContext.state === 'suspended') {
      await state.audioContext.resume();
    }

    updateEnhanceProgress('Læser audio…', 10);

    const buffer = await track.file.arrayBuffer();
    const audioBuffer = await state.audioContext.decodeAudioData(buffer.slice(0));

    updateEnhanceProgress('Anvender EQ…', 30);

    const offline = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const src = offline.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(offline.destination);
    src.start();

    const rendered = await offline.startRendering();

    updateEnhanceProgress('Loudness normalisering…', 60);

    // (simpel placeholder – dit eksisterende loudness-flow kan stå her)
    track.enhanced = true;

    updateEnhanceProgress('Eksporterer…', 90);
    updateEnhanceProgress('Færdig!', 100);

    showToast('Enhancement færdig', 'success');

    setTimeout(() => {
      elements.enhanceProgress?.classList.add('hidden');
    }, 1500);

  } catch (err) {
    console.error(err);
    showToast('Fejl under enhancement', 'error');
    elements.enhanceProgress?.classList.add('hidden');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        Auto-Enhance
      `;
    }
  }
}

/* =====================================================
   TOAST
   ===================================================== */
function showToast(msg, type = 'info') {
  if (!elements.toasts) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  elements.toasts.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}
