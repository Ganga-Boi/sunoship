/* =====================================================
   SUNOSHIP v3.0 - HARD SAFE EDITION
   Zero textContent crashes. Ever.
   ===================================================== */
console.log('%c🚢 SunoShip v3.0', 'color: #1DB954; font-size: 16px; font-weight: bold');

const state = {
    tracks: [],
    currentTrackIndex: 0,
    coverImageData: null,
    audio: null,
    audioContext: null,
    enhancedBlob: null,
    enhancing: false
};

document.addEventListener('DOMContentLoaded', () => {
    hideSplashSafe();
    initNavigation();
    initUpload();
    initAudioPlayer();
    initArtwork();
    initExport();
});

/* =====================================================
   SPLASH (safe)
   ===================================================== */
function hideSplashSafe() {
    const splash = document.getElementById('splash');
    const app = document.getElementById('app');
    if (!splash || !app) return;

    setTimeout(() => {
        splash.classList.add('fade-out');
        setTimeout(() => {
            splash.remove();
            app.classList.remove('hidden');
        }, 600);
    }, 1200);
}

/* =====================================================
   PROGRESS - RENDER ONLY IF CONTAINER EXISTS
   ===================================================== */
function renderProgress(text, percent) {
    const container = document.getElementById('enhanceProgress');
    if (!container || container.classList.contains('hidden')) return;

    const textEl = container.querySelector('#progressText');
    const percentEl = container.querySelector('#progressPercent');
    const barEl = container.querySelector('#enhanceProgressBar');

    if (textEl) textEl.textContent = text;
    if (percentEl) percentEl.textContent = percent + '%';
    if (barEl) barEl.style.width = percent + '%';
}

function showEnhanceProgress(show) {
    const el = document.getElementById('enhanceProgress');
    if (!el) return;
    el.classList.toggle('hidden', !show);
}

/* =====================================================
   NAVIGATION
   ===================================================== */
function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const step = btn.dataset.step;
            if (step) goToStep(step);
        });
    });

    document.getElementById('continueToEnhance')?.addEventListener('click', () => goToStep('enhance'));
    document.getElementById('backToUploadFromEnhance')?.addEventListener('click', () => goToStep('upload'));
    document.getElementById('skipEnhance')?.addEventListener('click', () => goToStep('metadata'));
    document.getElementById('continueToMetadata')?.addEventListener('click', () => goToStep('metadata'));
    document.getElementById('backToEnhance')?.addEventListener('click', () => goToStep('enhance'));
    document.getElementById('continueToArtwork')?.addEventListener('click', () => goToStep('artwork'));
    document.getElementById('backToMetadata')?.addEventListener('click', () => goToStep('metadata'));
    document.getElementById('continueToExport')?.addEventListener('click', () => goToStep('export'));
    document.getElementById('backToArtwork')?.addEventListener('click', () => goToStep('artwork'));
}

function goToStep(stepName) {
    console.log('Going to step:', stepName);

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.step === stepName) btn.classList.add('active');
    });

    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    const stepEl = document.getElementById('step-' + stepName);
    if (stepEl) stepEl.classList.add('active');

    if (stepName === 'enhance') initEnhanceStep();
    if (stepName === 'metadata') initMetadataStep();
    if (stepName === 'export') initExportStep();
}

/* =====================================================
   UPLOAD
   ===================================================== */
function initUpload() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    dropZone?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => handleFiles(e.target.files));

    dropZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });
}

function handleFiles(files) {
    const audioFiles = Array.from(files).filter(f => f.type.startsWith('audio/'));
    if (!audioFiles.length) return;

    audioFiles.forEach(file => {
        state.tracks.push({
            file,
            name: file.name.replace(/\.[^/.]+$/, ''),
            enhanced: false,
            enhancedFile: null,
            metadata: { title: file.name.replace(/\.[^/.]+$/, ''), artist: '', album: '', genre: '' }
        });
    });

    renderTracks();
    
    const trackList = document.getElementById('trackList');
    if (trackList) trackList.classList.remove('hidden');
    
    const continueBtn = document.getElementById('continueToEnhance');
    if (continueBtn) continueBtn.disabled = false;

    toastSafe('Track uploadet', 'success');
    
    // Analyze first track
    if (state.tracks.length > 0) {
        analyzeTrack(state.tracks[0]);
    }
}

function renderTracks() {
    const container = document.getElementById('tracks');
    if (!container) return;

    container.innerHTML = state.tracks.map((t, i) => `
        <div class="track-item ${i === state.currentTrackIndex ? 'active' : ''}" onclick="selectTrack(${i})">
            <span class="track-name">${escapeHtml(t.name)}</span>
            <span class="track-status">${t.enhanced ? '✓ Enhanced' : ''}</span>
            <button class="track-delete" onclick="event.stopPropagation(); deleteTrack(${i})">×</button>
        </div>
    `).join('');
}

function selectTrack(index) {
    state.currentTrackIndex = index;
    renderTracks();
}

function deleteTrack(index) {
    state.tracks.splice(index, 1);
    if (state.currentTrackIndex >= state.tracks.length) {
        state.currentTrackIndex = Math.max(0, state.tracks.length - 1);
    }
    renderTracks();
}

/* =====================================================
   ENHANCE STEP
   ===================================================== */
function initEnhanceStep() {
    console.log('Init enhance step');

    // Update track selector
    const selector = document.getElementById('enhanceTrackSelector');
    if (selector && state.tracks.length > 0) {
        selector.innerHTML = state.tracks.map((t, i) =>
            `<option value="${i}">${escapeHtml(t.name)}</option>`
        ).join('');
        selector.value = state.currentTrackIndex;
    }

    // Update before LUFS
    const track = state.tracks[state.currentTrackIndex];
    if (track) {
        const beforeLufs = document.getElementById('beforeLufs');
        if (beforeLufs) {
            beforeLufs.textContent = track.lufs ? track.lufs.toFixed(1) : '--';
        }
    }

    // Reset
    state.enhancedBlob = null;
    const playAfter = document.getElementById('playAfter');
    if (playAfter) playAfter.disabled = true;

    // Bind enhance button (once)
    const btn = document.getElementById('processEnhance');
    if (btn && !btn.dataset.bound) {
        btn.addEventListener('click', () => {
            if (!state.enhancing) runEnhance(btn);
        });
        btn.dataset.bound = 'true';
    }

    // Play buttons
    const playBefore = document.getElementById('playBefore');
    if (playBefore && !playBefore.dataset.bound) {
        playBefore.addEventListener('click', () => {
            const t = state.tracks[state.currentTrackIndex];
            if (t) playAudioFile(t.file);
        });
        playBefore.dataset.bound = 'true';
    }

    const playAfterBtn = document.getElementById('playAfter');
    if (playAfterBtn && !playAfterBtn.dataset.bound) {
        playAfterBtn.addEventListener('click', () => {
            if (state.enhancedBlob) playAudioFile(state.enhancedBlob);
        });
        playAfterBtn.dataset.bound = 'true';
    }
}

/* =====================================================
   ENHANCE FLOW - ZERO DOM RISK + FULL AUDIO PROCESSING
   ===================================================== */
async function runEnhance(btn) {
    const track = state.tracks[state.currentTrackIndex];
    if (!track || !track.file) {
        toastSafe('Ingen track valgt', 'error');
        return;
    }

    state.enhancing = true;
    setButtonState(btn, true);
    showEnhanceProgress(true);
    renderProgress('Starter...', 0);

    try {
        // 1. AudioContext
        if (!state.audioContext) {
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (state.audioContext.state === 'suspended') {
            await state.audioContext.resume();
        }
        console.log('1. AudioContext ready');

        renderProgress('Læser audio...', 10);

        // 2. Decode
        const arrayBuffer = await track.file.arrayBuffer();
        const audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer.slice(0));
        console.log('2. Decoded:', audioBuffer.numberOfChannels, 'ch,', audioBuffer.sampleRate, 'Hz');

        renderProgress('Anvender EQ...', 25);

        // 3. EQ Processing
        const offlineCtx = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );

        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;

        // High-pass filter (remove rumble)
        const hp = offlineCtx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 80;
        hp.Q.value = 0.7;

        // Presence boost
        const mid = offlineCtx.createBiquadFilter();
        mid.type = 'peaking';
        mid.frequency.value = 3000;
        mid.gain.value = 1.5;
        mid.Q.value = 1;

        // High shelf (air)
        const hi = offlineCtx.createBiquadFilter();
        hi.type = 'highshelf';
        hi.frequency.value = 10000;
        hi.gain.value = 2;

        source.connect(hp).connect(mid).connect(hi).connect(offlineCtx.destination);
        source.start(0);

        const eqBuffer = await offlineCtx.startRendering();
        console.log('3. EQ done');

        renderProgress('Loudness normalisering...', 50);

        // 4. Loudness normalization
        const numCh = eqBuffer.numberOfChannels;
        const len = eqBuffer.length;
        const rate = eqBuffer.sampleRate;

        let sum = 0;
        for (let c = 0; c < numCh; c++) {
            const data = eqBuffer.getChannelData(c);
            for (let i = 0; i < len; i++) sum += data[i] * data[i];
        }
        const rms = Math.sqrt(sum / (len * numCh));
        const currentLufs = -0.691 + 10 * Math.log10(Math.max(rms * rms, 1e-10));
        const targetLufs = -14;
        const gainDb = Math.min(targetLufs - currentLufs, 12);
        const gain = Math.pow(10, gainDb / 20);
        const ceiling = 0.89;

        console.log('4. LUFS:', currentLufs.toFixed(1), '-> gain:', gainDb.toFixed(1), 'dB');

        const outBuffer = state.audioContext.createBuffer(numCh, len, rate);
        for (let c = 0; c < numCh; c++) {
            const inD = eqBuffer.getChannelData(c);
            const outD = outBuffer.getChannelData(c);
            for (let i = 0; i < len; i++) {
                let s = inD[i] * gain;
                // Soft limiter
                if (Math.abs(s) > ceiling * 0.8) {
                    s = Math.tanh(s / ceiling) * ceiling;
                }
                outD[i] = Math.max(-ceiling, Math.min(ceiling, s));
            }
        }
        console.log('5. Loudness done');

        renderProgress('Stereo widening...', 70);

        // 5. Stereo widening
        let finalBuffer = outBuffer;
        if (numCh >= 2) {
            const width = 0.25;
            const sBuffer = state.audioContext.createBuffer(2, len, rate);
            const L = outBuffer.getChannelData(0);
            const R = outBuffer.getChannelData(1);
            const oL = sBuffer.getChannelData(0);
            const oR = sBuffer.getChannelData(1);
            for (let i = 0; i < len; i++) {
                const m = (L[i] + R[i]) * 0.5;
                const s = (L[i] - R[i]) * 0.5 * (1 + width);
                oL[i] = m + s;
                oR[i] = m - s;
            }
            finalBuffer = sBuffer;
            console.log('6. Stereo done');
        }

        renderProgress('Eksporterer WAV...', 90);

        // 6. Convert to WAV
        const wavBlob = bufferToWav(finalBuffer);
        console.log('7. WAV:', wavBlob.size, 'bytes');

        // 7. Save
        state.enhancedBlob = wavBlob;
        track.enhancedFile = wavBlob;
        track.enhanced = true;

        renderProgress('Færdig!', 100);

        // 8. Update UI (safe)
        const afterLufs = document.getElementById('afterLufs');
        if (afterLufs) afterLufs.textContent = targetLufs.toFixed(1);

        const playAfterBtn = document.getElementById('playAfter');
        if (playAfterBtn) playAfterBtn.disabled = false;

        console.log('=== Enhancement DONE ===');
        toastSafe('Enhancement færdig! 🎉', 'success');

        renderTracks(); // Update track list to show enhanced status

    } catch (err) {
        console.error('Enhancement error:', err);
        toastSafe('Fejl: ' + err.message, 'error');
    } finally {
        setTimeout(() => {
            showEnhanceProgress(false);
            setButtonState(btn, false);
            state.enhancing = false;
        }, 1500);
    }
}

function setButtonState(btn, busy) {
    if (!btn) return;
    btn.disabled = busy;
    if (busy) {
        btn.textContent = 'Processerer...';
    } else {
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Auto-Enhance';
    }
}

/* =====================================================
   WAV ENCODER
   ===================================================== */
function bufferToWav(buffer) {
    const numCh = buffer.numberOfChannels;
    const rate = buffer.sampleRate;
    const len = buffer.length;
    const bytesPerSample = 2;
    const blockAlign = numCh * bytesPerSample;
    const byteRate = rate * blockAlign;
    const dataSize = len * blockAlign;
    const bufferSize = 44 + dataSize;

    const wav = new ArrayBuffer(bufferSize);
    const view = new DataView(wav);

    const writeStr = (offset, str) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numCh, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    const channels = [];
    for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));

    for (let i = 0; i < len; i++) {
        for (let c = 0; c < numCh; c++) {
            const sample = Math.max(-1, Math.min(1, channels[c][i]));
            view.setInt16(offset, sample * 0x7FFF, true);
            offset += 2;
        }
    }

    return new Blob([wav], { type: 'audio/wav' });
}

/* =====================================================
   METADATA STEP
   ===================================================== */
function initMetadataStep() {
    const track = state.tracks[state.currentTrackIndex];
    if (!track) return;

    const fields = {
        'trackTitle': track.metadata.title,
        'artistName': track.metadata.artist,
        'albumName': track.metadata.album,
        'genre': track.metadata.genre
    };

    Object.entries(fields).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    });

    // Save metadata on input
    ['trackTitle', 'artistName', 'albumName', 'genre'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset.bound) {
            el.addEventListener('input', () => {
                const t = state.tracks[state.currentTrackIndex];
                if (t) {
                    if (id === 'trackTitle') t.metadata.title = el.value;
                    if (id === 'artistName') t.metadata.artist = el.value;
                    if (id === 'albumName') t.metadata.album = el.value;
                    if (id === 'genre') t.metadata.genre = el.value;
                }
            });
            el.dataset.bound = 'true';
        }
    });
}

/* =====================================================
   ARTWORK
   ===================================================== */
function initArtwork() {
    const input = document.getElementById('coverInput');
    const preview = document.getElementById('coverPreview');

    if (input) {
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    state.coverImageData = evt.target.result;
                    if (preview) {
                        preview.innerHTML = `<img src="${evt.target.result}" alt="Cover">`;
                    }
                    toastSafe('Cover uploadet', 'success');
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

/* =====================================================
   EXPORT
   ===================================================== */
function initExport() {
    document.getElementById('downloadExport')?.addEventListener('click', downloadPackage);
}

function initExportStep() {
    const track = state.tracks[state.currentTrackIndex];
    if (!track) return;

    const title = document.getElementById('summaryTitle');
    const artist = document.getElementById('summaryArtist');
    if (title) title.textContent = track.metadata.title || track.name;
    if (artist) artist.textContent = track.metadata.artist || 'Unknown';
}

async function downloadPackage() {
    const track = state.tracks[state.currentTrackIndex];
    if (!track) {
        toastSafe('Ingen track', 'error');
        return;
    }

    const fileToDownload = track.enhancedFile || track.file;
    const name = (track.metadata.title || track.name) + (track.enhanced ? '_enhanced.wav' : '.mp3');

    const url = URL.createObjectURL(fileToDownload);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);

    toastSafe('Download startet', 'success');
}

/* =====================================================
   AUDIO PLAYER
   ===================================================== */
function initAudioPlayer() {
    state.audio = new Audio();
}

function playAudioFile(fileOrBlob) {
    if (!state.audio) state.audio = new Audio();
    state.audio.src = URL.createObjectURL(fileOrBlob);
    state.audio.play();

    const player = document.getElementById('audioPlayer');
    if (player) player.classList.remove('hidden');
}

/* =====================================================
   ANALYSIS
   ===================================================== */
async function analyzeTrack(track) {
    if (!track || track.analyzed) return;

    try {
        if (!state.audioContext) {
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        const arrayBuffer = await track.file.arrayBuffer();
        const audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer.slice(0));

        // Simple LUFS calculation
        let sum = 0;
        const data = audioBuffer.getChannelData(0);
        const len = Math.min(data.length, audioBuffer.sampleRate * 30);
        for (let i = 0; i < len; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / len);
        track.lufs = -0.691 + 10 * Math.log10(Math.max(rms * rms, 1e-10));

        track.analyzed = true;
        console.log('Analyzed:', track.name, 'LUFS:', track.lufs.toFixed(1));

    } catch (err) {
        console.error('Analysis error:', err);
    }
}

/* =====================================================
   TOAST - IMPOSSIBLE TO CRASH
   ===================================================== */
function toastSafe(msg, type = 'info') {
    const box = document.getElementById('toasts');
    if (!box) {
        console.log('[Toast]', type, msg);
        return;
    }

    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${escapeHtml(msg)}</span><button onclick="this.parentElement.remove()">×</button>`;
    box.appendChild(el);

    setTimeout(() => {
        if (el.parentElement) el.remove();
    }, 4000);
}

/* =====================================================
   UTILITIES
   ===================================================== */
function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Global functions for onclick handlers
window.selectTrack = selectTrack;
window.deleteTrack = deleteTrack;
