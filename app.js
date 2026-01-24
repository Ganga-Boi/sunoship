/* =====================================================
   SUNOSHIP v2.4 - DOM Safe Edition
   ===================================================== */
console.log('%c🚢 SunoShip v2.4', 'color: #1DB954; font-size: 16px; font-weight: bold');

const state = {
    tracks: [],
    currentTrackIndex: 0,
    coverImage: null,
    coverImageData: null,
    audio: null,
    isPlaying: false,
    audioContext: null,
    enhancedBlob: null,
    enhanceControlsInitialized: false
};

const elements = {};

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM ready');
    initElements();
    initApp();
});

function initElements() {
    elements.splash = document.getElementById('splash');
    elements.app = document.getElementById('app');
    elements.dropZone = document.getElementById('dropZone');
    elements.fileInput = document.getElementById('fileInput');
    elements.trackList = document.getElementById('trackList');
    elements.tracks = document.getElementById('tracks');
    elements.audioPlayer = document.getElementById('audioPlayer');
    elements.coverInput = document.getElementById('coverInput');
    elements.coverPreview = document.getElementById('coverPreview');
    elements.toasts = document.getElementById('toasts');
    
    // Enhance progress elements
    elements.enhanceProgress = document.getElementById('enhanceProgress');
    elements.progressText = document.getElementById('progressText');
    elements.progressPercent = document.getElementById('progressPercent');
    elements.enhanceProgressBar = document.getElementById('enhanceProgressBar');
    
    console.log('Elements initialized');
}

/* =====================================================
   SAFE PROGRESS UPDATER - forhindrer ALLE crashes
   ===================================================== */
function updateEnhanceProgress(text, percent) {
    if (
        !elements.enhanceProgress ||
        !elements.progressText ||
        !elements.progressPercent ||
        !elements.enhanceProgressBar
    ) {
        console.log('Progress update skipped - elements not ready');
        return;
    }
    
    elements.progressText.textContent = text;
    elements.progressPercent.textContent = percent + '%';
    elements.enhanceProgressBar.style.width = percent + '%';
}

function initApp() {
    // Hide splash after delay
    setTimeout(() => {
        if (elements.splash) {
            elements.splash.classList.add('fade-out');
            setTimeout(() => {
                if (elements.app) elements.app.classList.remove('hidden');
            }, 500);
        }
    }, 1500);
    
    initNavigation();
    initUpload();
    initAudioPlayer();
    initArtwork();
    initExport();
}

// =====================================================
// NAVIGATION
// =====================================================
function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const step = btn.dataset.step;
            if (step) goToStep(step);
        });
    });
    
    // Step action buttons
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
    
    // Update nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.step === stepName) btn.classList.add('active');
    });
    
    // Update content
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    const stepEl = document.getElementById('step-' + stepName);
    if (stepEl) stepEl.classList.add('active');
    
    // Init step-specific content
    if (stepName === 'enhance') initEnhanceStep();
    if (stepName === 'metadata') initMetadataStep();
    if (stepName === 'export') initExportStep();
}

// =====================================================
// UPLOAD
// =====================================================
function initUpload() {
    const dropZone = elements.dropZone;
    const fileInput = elements.fileInput;
    
    if (dropZone) {
        dropZone.addEventListener('click', () => fileInput?.click());
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            handleFiles(e.dataTransfer.files);
        });
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
    }
}

function handleFiles(files) {
    const audioFiles = Array.from(files).filter(f => 
        f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|m4a|flac|ogg)$/i)
    );
    
    if (audioFiles.length === 0) {
        showToast('Ingen audio filer fundet', 'error');
        return;
    }
    
    audioFiles.forEach(file => {
        const track = {
            file: file,
            name: file.name.replace(/\.[^.]+$/, ''),
            metadata: {
                title: file.name.replace(/\.[^.]+$/, ''),
                artist: '',
                album: '',
                genre: '',
                year: new Date().getFullYear()
            },
            enhanced: false,
            enhancedFile: null,
            analyzed: false,
            bpm: null,
            lufs: null
        };
        state.tracks.push(track);
    });
    
    renderTrackList();
    showToast(audioFiles.length + ' track(s) tilføjet', 'success');
    
    // Enable continue button
    const continueBtn = document.getElementById('continueToEnhance');
    if (continueBtn) continueBtn.disabled = false;
    
    // Auto-analyze first track
    if (state.tracks.length > 0) {
        analyzeTrack(state.tracks[0]);
    }
}

function renderTrackList() {
    if (!elements.tracks) return;
    
    if (state.tracks.length === 0) {
        if (elements.trackList) elements.trackList.classList.add('hidden');
        return;
    }
    
    if (elements.trackList) elements.trackList.classList.remove('hidden');
    
    elements.tracks.innerHTML = state.tracks.map((track, i) => `
        <div class="track-item ${i === state.currentTrackIndex ? 'active' : ''}" onclick="selectTrack(${i})">
            <div class="track-info">
                <span class="track-name">${escapeHtml(track.name)}</span>
                <span class="track-status">${track.enhanced ? '✓ Enhanced' : ''}</span>
            </div>
            <button class="btn-icon" onclick="event.stopPropagation(); deleteTrack(${i})">🗑️</button>
        </div>
    `).join('');
}

function selectTrack(index) {
    state.currentTrackIndex = index;
    renderTrackList();
}

function deleteTrack(index) {
    state.tracks.splice(index, 1);
    if (state.currentTrackIndex >= state.tracks.length) {
        state.currentTrackIndex = Math.max(0, state.tracks.length - 1);
    }
    renderTrackList();
}

// =====================================================
// ENHANCE STEP
// =====================================================
function initEnhanceStep() {
    console.log('Init enhance step');
    
    const selector = document.getElementById('enhanceTrackSelector');
    if (selector && state.tracks.length > 0) {
        selector.innerHTML = state.tracks.map((t, i) => 
            `<option value="${i}">${escapeHtml(t.name)}</option>`
        ).join('');
        selector.value = state.currentTrackIndex;
    }
    
    // Update before stats
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
    
    // Init controls once
    if (!state.enhanceControlsInitialized) {
        initEnhanceControls();
        state.enhanceControlsInitialized = true;
    }
}

function initEnhanceControls() {
    const processBtn = document.getElementById('processEnhance');
    if (processBtn) {
        processBtn.addEventListener('click', () => {
            console.log('Enhance button clicked');
            processEnhancement();
        });
    }
    
    const playBefore = document.getElementById('playBefore');
    if (playBefore) {
        playBefore.addEventListener('click', () => {
            const track = state.tracks[state.currentTrackIndex];
            if (track) playAudioFile(track.file);
        });
    }
    
    const playAfter = document.getElementById('playAfter');
    if (playAfter) {
        playAfter.addEventListener('click', () => {
            if (state.enhancedBlob) playAudioFile(state.enhancedBlob);
        });
    }
}

async function processEnhancement() {
    console.log('=== processEnhancement START ===');
    
    const track = state.tracks[state.currentTrackIndex];
    if (!track || !track.file) {
        showToast('Ingen track valgt', 'error');
        return;
    }
    
    const btn = document.getElementById('processEnhance');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Processerer...';
    }
    
    // Show progress (safe)
    if (elements.enhanceProgress) {
        elements.enhanceProgress.classList.remove('hidden');
    }
    updateEnhanceProgress('Starter...', 0);
    
    try {
        // 1. AudioContext
        if (!state.audioContext) {
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (state.audioContext.state === 'suspended') {
            await state.audioContext.resume();
        }
        console.log('1. AudioContext ready');
        
        updateEnhanceProgress('Læser audio...', 10);
        
        // 2. Decode
        const arrayBuffer = await track.file.arrayBuffer();
        const audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer.slice(0));
        console.log('2. Decoded:', audioBuffer.numberOfChannels, 'ch,', audioBuffer.sampleRate, 'Hz');
        
        updateEnhanceProgress('Anvender EQ...', 30);
        
        // 3. EQ
        const offlineCtx = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );
        
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        
        const hp = offlineCtx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 80;
        
        const mid = offlineCtx.createBiquadFilter();
        mid.type = 'peaking';
        mid.frequency.value = 3000;
        mid.gain.value = 1.5;
        
        const hi = offlineCtx.createBiquadFilter();
        hi.type = 'highshelf';
        hi.frequency.value = 10000;
        hi.gain.value = 2;
        
        source.connect(hp).connect(mid).connect(hi).connect(offlineCtx.destination);
        source.start(0);
        
        const eqBuffer = await offlineCtx.startRendering();
        console.log('3. EQ done');
        
        updateEnhanceProgress('Loudness normalisering...', 50);
        
        // 4. Loudness
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
                if (Math.abs(s) > ceiling * 0.8) s = Math.tanh(s / ceiling) * ceiling;
                outD[i] = Math.max(-ceiling, Math.min(ceiling, s));
            }
        }
        console.log('5. Loudness done');
        
        updateEnhanceProgress('Stereo widening...', 70);
        
        // 5. Stereo
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
        
        updateEnhanceProgress('Eksporterer WAV...', 90);
        
        // 6. WAV
        const wavBlob = bufferToWav(finalBuffer);
        console.log('7. WAV:', wavBlob.size, 'bytes');
        
        // 7. Save
        state.enhancedBlob = wavBlob;
        track.enhancedFile = wavBlob;
        track.enhanced = true;
        
        updateEnhanceProgress('Færdig!', 100);
        
        // 8. Update UI (safe)
        const afterLufs = document.getElementById('afterLufs');
        if (afterLufs) afterLufs.textContent = targetLufs.toFixed(1);
        
        const playAfterBtn = document.getElementById('playAfter');
        if (playAfterBtn) playAfterBtn.disabled = false;
        
        console.log('=== processEnhancement DONE ===');
        showToast('Enhancement færdig! 🎉', 'success');
        
        // Hide progress after 2 sec
        setTimeout(() => {
            if (elements.enhanceProgress) elements.enhanceProgress.classList.add('hidden');
        }, 2000);
        
    } catch (err) {
        console.error('Enhancement error:', err);
        showToast('Fejl: ' + err.message, 'error');
        if (elements.enhanceProgress) elements.enhanceProgress.classList.add('hidden');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Auto-Enhance';
        }
    }
}

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

// =====================================================
// METADATA STEP
// =====================================================
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
}

// =====================================================
// ARTWORK
// =====================================================
function initArtwork() {
    const input = elements.coverInput;
    if (input) {
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    state.coverImageData = evt.target.result;
                    if (elements.coverPreview) {
                        elements.coverPreview.innerHTML = `<img src="${evt.target.result}" alt="Cover">`;
                    }
                    showToast('Cover uploadet', 'success');
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

// =====================================================
// EXPORT
// =====================================================
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
        showToast('Ingen track', 'error');
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
    
    showToast('Download startet', 'success');
}

// =====================================================
// AUDIO PLAYER
// =====================================================
function initAudioPlayer() {
    state.audio = new Audio();
    state.audio.addEventListener('ended', () => {
        state.isPlaying = false;
    });
}

function playAudioFile(fileOrBlob) {
    if (!state.audio) state.audio = new Audio();
    state.audio.src = URL.createObjectURL(fileOrBlob);
    state.audio.play();
    state.isPlaying = true;
    
    if (elements.audioPlayer) elements.audioPlayer.classList.remove('hidden');
}

// =====================================================
// ANALYSIS
// =====================================================
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

// =====================================================
// UTILITIES
// =====================================================
function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showToast(message, type = 'info') {
    console.log('Toast:', type, message);
    
    const container = elements.toasts || document.getElementById('toasts');
    if (!container) {
        console.warn('No toast container');
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = '<span>' + escapeHtml(message) + '</span><button onclick="this.parentElement.remove()">×</button>';
    container.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 4000);
}

// Global functions for onclick handlers
window.selectTrack = selectTrack;
window.deleteTrack = deleteTrack;
