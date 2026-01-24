/* =====================================================
   SUNOSHIP v3.6 - AMUSE AI-READY
   ===================================================== */
'use strict';
console.log('%c🚢 SunoShip v3.6 - Amuse AI-Ready', 'color: #1DB954; font-size: 16px; font-weight: bold');

/* ========= SAFE HELPERS ========= */
const $ = id => document.getElementById(id);
const wait = ms => new Promise(r => setTimeout(r, ms));

function safeText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
}

function safeShow(id, show) {
    const el = $(id);
    if (el) el.classList.toggle('hidden', !show);
}

function safeWidth(id, percent) {
    const el = $(id);
    if (el) el.style.width = percent + '%';
}

function toast(msg, type = 'success') {
    const box = $('toasts');
    if (!box) { console.log('[Toast]', msg); return; }
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `<span>${msg}</span><button onclick="this.parentElement.remove()">×</button>`;
    box.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

function updateProgress(text, percent) {
    safeText('progressText', text);
    safeText('progressPercent', percent + '%');
    safeWidth('enhanceProgressBar', percent);
}

/* ========= STATE ========= */
const state = {
    tracks: [],
    currentTrackIndex: 0,
    coverImageData: null,
    audio: null,
    audioContext: null,
    enhancedBlob: null,
    enhancing: false
};

/* ========= INIT ========= */
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM ready');
    hideSplash();
    initNavigation();
    initUpload();
    initAudioPlayer();
    initArtwork();
    initExport();
});

/* ========= SPLASH ========= */
function hideSplash() {
    const splash = $('splash');
    const app = $('app');
    if (!splash || !app) return;
    setTimeout(() => {
        splash.classList.add('fade-out');
        setTimeout(() => {
            splash.remove();
            app.classList.remove('hidden');
        }, 600);
    }, 1200);
}

/* ========= NAVIGATION ========= */
function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const step = btn.dataset.step;
            if (step) goToStep(step);
        });
    });

    $('continueToEnhance')?.addEventListener('click', () => goToStep('enhance'));
    $('backToUploadFromEnhance')?.addEventListener('click', () => goToStep('upload'));
    $('skipEnhance')?.addEventListener('click', () => goToStep('metadata'));
    $('continueToMetadata')?.addEventListener('click', () => goToStep('metadata'));
    $('backToEnhance')?.addEventListener('click', () => goToStep('enhance'));
    $('continueToArtwork')?.addEventListener('click', () => goToStep('artwork'));
    $('backToMetadata')?.addEventListener('click', () => goToStep('metadata'));
    $('continueToExport')?.addEventListener('click', () => goToStep('export'));
    $('backToArtwork')?.addEventListener('click', () => goToStep('artwork'));
}

function goToStep(stepName) {
    console.log('Going to step:', stepName);
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.step === stepName);
    });
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    const stepEl = $('step-' + stepName);
    if (stepEl) stepEl.classList.add('active');

    if (stepName === 'enhance') initEnhanceStep();
    if (stepName === 'metadata') initMetadataStep();
    if (stepName === 'export') initExportStep();
}

/* ========= UPLOAD ========= */
function initUpload() {
    const dropZone = $('dropZone');
    const fileInput = $('fileInput');

    dropZone?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', e => handleFiles(e.target.files));

    dropZone?.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone?.addEventListener('drop', e => {
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
    safeShow('trackList', true);
    
    const btn = $('continueToEnhance');
    if (btn) btn.disabled = false;

    toast('Track uploadet');
    
    // Analyze all new tracks
    audioFiles.forEach((_, i) => {
        const trackIndex = state.tracks.length - audioFiles.length + i;
        analyzeTrack(state.tracks[trackIndex]);
    });
}

function renderTracks() {
    const container = $('tracks');
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
    
    // Analyze if not already done
    const track = state.tracks[index];
    if (track && !track.analyzed) {
        analyzeTrack(track);
    }
}

function deleteTrack(index) {
    state.tracks.splice(index, 1);
    if (state.currentTrackIndex >= state.tracks.length) {
        state.currentTrackIndex = Math.max(0, state.tracks.length - 1);
    }
    renderTracks();
}

/* ========= ENHANCE STEP ========= */
function initEnhanceStep() {
    console.log('Init enhance step');

    // Reset progress UI on step entry
    safeShow('enhanceProgress', false);
    updateProgress('Processerer...', 0);

    const selector = $('enhanceTrackSelector');
    if (selector && state.tracks.length > 0) {
        selector.innerHTML = state.tracks.map((t, i) =>
            `<option value="${i}">${escapeHtml(t.name)}</option>`
        ).join('');
        selector.value = state.currentTrackIndex;
        
        // Listen for track selection change
        if (!selector.dataset.bound) {
            selector.addEventListener('change', (e) => {
                state.currentTrackIndex = parseInt(e.target.value, 10);
                const track = state.tracks[state.currentTrackIndex];
                if (track) {
                    safeText('beforeLufs', track.lufs ? track.lufs.toFixed(1) : '--');
                }
                state.enhancedBlob = null;
                const playAfter = $('playAfter');
                if (playAfter) playAfter.disabled = true;
            });
            selector.dataset.bound = 'true';
        }
    }

    const track = state.tracks[state.currentTrackIndex];
    if (track) {
        safeText('beforeLufs', track.lufs ? track.lufs.toFixed(1) : '--');
    }

    state.enhancedBlob = null;
    const playAfter = $('playAfter');
    if (playAfter) playAfter.disabled = true;

    // Bind enhance button
    const btn = $('processEnhance');
    if (btn && !btn.dataset.bound) {
        btn.addEventListener('click', runEnhance);
        btn.dataset.bound = 'true';
    }

    // Play buttons
    const playBefore = $('playBefore');
    if (playBefore && !playBefore.dataset.bound) {
        playBefore.addEventListener('click', () => {
            const t = state.tracks[state.currentTrackIndex];
            if (t) playAudioFile(t.file);
        });
        playBefore.dataset.bound = 'true';
    }

    const playAfterBtn = $('playAfter');
    if (playAfterBtn && !playAfterBtn.dataset.bound) {
        playAfterBtn.addEventListener('click', () => {
            if (state.enhancedBlob) playAudioFile(state.enhancedBlob);
        });
        playAfterBtn.dataset.bound = 'true';
    }
}

/* ========= ENHANCE - FULL AUDIO PROCESSING ========= */
async function runEnhance() {
    const track = state.tracks[state.currentTrackIndex];
    if (!track || !track.file) {
        toast('Ingen track valgt', 'error');
        return;
    }
    if (state.enhancing) return;

    state.enhancing = true;
    const btn = $('processEnhance');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Processerer...';
    }

    safeShow('enhanceProgress', true);
    updateProgress('Starter...', 0);

    try {
        // 1. AudioContext
        if (!state.audioContext) {
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (state.audioContext.state === 'suspended') {
            await state.audioContext.resume();
        }

        updateProgress('Læser audio...', 10);
        await wait(100);

        // 2. Decode
        const arrayBuffer = await track.file.arrayBuffer();
        const audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer.slice(0));
        console.log('Decoded:', audioBuffer.numberOfChannels, 'ch,', audioBuffer.sampleRate, 'Hz');

        updateProgress('Anvender EQ...', 25);
        await wait(100);

        // 3. EQ Processing
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
        hp.Q.value = 0.7;

        const mid = offlineCtx.createBiquadFilter();
        mid.type = 'peaking';
        mid.frequency.value = 3000;
        mid.gain.value = 1.5;
        mid.Q.value = 1;

        const hi = offlineCtx.createBiquadFilter();
        hi.type = 'highshelf';
        hi.frequency.value = 10000;
        hi.gain.value = 2;

        source.connect(hp).connect(mid).connect(hi).connect(offlineCtx.destination);
        source.start(0);

        const eqBuffer = await offlineCtx.startRendering();

        updateProgress('Loudness normalisering...', 50);
        await wait(100);

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

        const outBuffer = state.audioContext.createBuffer(numCh, len, rate);
        for (let c = 0; c < numCh; c++) {
            const inD = eqBuffer.getChannelData(c);
            const outD = outBuffer.getChannelData(c);
            for (let i = 0; i < len; i++) {
                let s = inD[i] * gain;
                if (Math.abs(s) > ceiling * 0.8) {
                    s = Math.tanh(s / ceiling) * ceiling;
                }
                outD[i] = Math.max(-ceiling, Math.min(ceiling, s));
            }
        }

        updateProgress('Stereo widening...', 70);
        await wait(100);

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
        }

        updateProgress('Eksporterer WAV...', 90);
        await wait(100);

        // 6. Convert to WAV
        const wavBlob = bufferToWav(finalBuffer);

        // 7. Save
        state.enhancedBlob = wavBlob;
        track.enhancedFile = wavBlob;
        track.enhanced = true;

        updateProgress('Færdig!', 100);

        // 8. Update UI
        safeText('afterLufs', targetLufs.toFixed(1));
        const playAfterBtn = $('playAfter');
        if (playAfterBtn) playAfterBtn.disabled = false;

        toast('Enhancement færdig! 🎉');
        renderTracks();

    } catch (err) {
        console.error('Enhancement error:', err);
        toast('Fejl: ' + err.message, 'error');
    } finally {
        setTimeout(() => {
            safeShow('enhanceProgress', false);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Auto-Enhance';
            }
            state.enhancing = false;
        }, 1000);
    }
}

/* ========= WAV ENCODER ========= */
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

/* ========= METADATA ========= */
function initMetadataStep() {
    console.log('Init metadata step');
    
    // Populate track selector
    const selector = $('trackSelector');
    if (selector && state.tracks.length > 0) {
        selector.innerHTML = state.tracks.map((t, i) =>
            `<option value="${i}">${escapeHtml(t.name)}</option>`
        ).join('');
        selector.value = state.currentTrackIndex;
        
        // Listen for track selection change
        if (!selector.dataset.bound) {
            selector.addEventListener('change', (e) => {
                state.currentTrackIndex = parseInt(e.target.value, 10);
                loadTrackMetadata();
            });
            selector.dataset.bound = 'true';
        }
    }
    
    loadTrackMetadata();
    
    // Bind input fields
    ['trackTitle', 'genre', 'releaseDate', 'copyrightYear'].forEach(id => {
        const el = $(id);
        if (el && !el.dataset.bound) {
            el.addEventListener('input', () => {
                const t = state.tracks[state.currentTrackIndex];
                if (t) {
                    if (id === 'trackTitle') t.metadata.title = el.value;
                    if (id === 'genre') t.metadata.genre = el.value;
                    if (id === 'releaseDate') t.metadata.releaseDate = el.value;
                    if (id === 'copyrightYear') t.metadata.copyrightYear = el.value;
                }
            });
            el.dataset.bound = 'true';
        }
    });
}

function loadTrackMetadata() {
    const track = state.tracks[state.currentTrackIndex];
    if (!track) return;
    
    // Always set artist to Rasta-Jah
    track.metadata.artist = 'Rasta-Jah';
    
    const titleEl = $('trackTitle');
    const genreEl = $('genre');
    const dateEl = $('releaseDate');
    const yearEl = $('copyrightYear');
    
    if (titleEl) titleEl.value = track.metadata.title || '';
    if (genreEl) genreEl.value = track.metadata.genre || '';
    if (dateEl) dateEl.value = track.metadata.releaseDate || '';
    if (yearEl) yearEl.value = track.metadata.copyrightYear || new Date().getFullYear();
}

/* ========= ARTWORK ========= */
function initArtwork() {
    const input = $('artworkInput');
    const preview = $('coverPreview');
    const dropZone = $('artworkDropZone');

    // File input handler
    if (input) {
        input.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) handleCoverUpload(file);
        });
    }
    
    // Drop zone click
    dropZone?.addEventListener('click', () => input?.click());
    
    // Drag and drop
    dropZone?.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone?.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) handleCoverUpload(file);
    });
}

function handleCoverUpload(file) {
    if (!file.type.startsWith('image/')) {
        toast('Kun billeder tilladt', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = evt => {
        state.coverImageData = evt.target.result;
        
        const preview = $('coverPreview');
        if (preview) preview.innerHTML = `<img src="${evt.target.result}" alt="Cover">`;
        
        safeText('coverStatus', 'Cover uploadet ✓');
        safeShow('albumMockup', true);
        
        // Update mockups
        const mockupSpotify = $('mockupSpotify');
        const mockupApple = $('mockupApple');
        if (mockupSpotify) mockupSpotify.src = evt.target.result;
        if (mockupApple) mockupApple.src = evt.target.result;
        
        toast('Cover uploadet');
    };
    reader.readAsDataURL(file);
}

/* ========= EXPORT ========= */
function initExport() {
    $('downloadExport')?.addEventListener('click', downloadPackage);
}

function initExportStep() {
    const track = state.tracks[state.currentTrackIndex];
    if (!track) return;
    safeText('summaryTitle', track.metadata.title || track.name);
    safeText('summaryArtist', track.metadata.artist || 'Unknown');
}

async function downloadPackage() {
    const track = state.tracks[state.currentTrackIndex];
    if (!track) {
        toast('Ingen track', 'error');
        return;
    }

    const fileToDownload = track.enhancedFile || track.file;
    
    // Get correct extension
    let ext;
    if (track.enhanced) {
        ext = '.wav'; // Enhanced files are always WAV
    } else {
        // Get original file extension
        const origName = track.file.name;
        const dotIndex = origName.lastIndexOf('.');
        ext = dotIndex > 0 ? origName.substring(dotIndex) : '.mp3';
    }
    
    const name = (track.metadata.title || track.name) + (track.enhanced ? '_enhanced' : '') + ext;

    const url = URL.createObjectURL(fileToDownload);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);

    toast('Download startet');
}

/* ========= AUDIO PLAYER ========= */
function initAudioPlayer() {
    state.audio = new Audio();
    
    state.audio.addEventListener('loadedmetadata', () => {
        const dur = state.audio.duration;
        safeText('duration', formatTime(dur));
    });
    
    state.audio.addEventListener('timeupdate', () => {
        const cur = state.audio.currentTime;
        const dur = state.audio.duration || 1;
        safeText('currentTime', formatTime(cur));
        safeWidth('progressFill', (cur / dur) * 100);
    });
    
    state.audio.addEventListener('ended', () => {
        const playIcon = document.querySelector('.play-icon');
        const pauseIcon = document.querySelector('.pause-icon');
        if (playIcon) playIcon.classList.remove('hidden');
        if (pauseIcon) pauseIcon.classList.add('hidden');
    });
    
    // Play/pause button
    $('playPause')?.addEventListener('click', () => {
        if (!state.audio) return;
        if (state.audio.paused) {
            state.audio.play();
            document.querySelector('.play-icon')?.classList.add('hidden');
            document.querySelector('.pause-icon')?.classList.remove('hidden');
        } else {
            state.audio.pause();
            document.querySelector('.play-icon')?.classList.remove('hidden');
            document.querySelector('.pause-icon')?.classList.add('hidden');
        }
    });
}

function formatTime(sec) {
    if (!sec || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
}

function playAudioFile(fileOrBlob, trackInfo) {
    if (!state.audio) state.audio = new Audio();
    state.audio.src = URL.createObjectURL(fileOrBlob);
    state.audio.play();
    
    // Update player UI
    safeShow('audioPlayer', true);
    document.querySelector('.play-icon')?.classList.add('hidden');
    document.querySelector('.pause-icon')?.classList.remove('hidden');
    
    // Set title/artist if available
    const track = trackInfo || state.tracks[state.currentTrackIndex];
    if (track) {
        const titleEl = document.querySelector('.player-title');
        const artistEl = document.querySelector('.player-artist');
        if (titleEl) titleEl.textContent = track.metadata?.title || track.name || 'Track';
        if (artistEl) artistEl.textContent = track.metadata?.artist || 'Unknown';
    }
}

/* ========= ANALYSIS ========= */
async function analyzeTrack(track) {
    if (!track || track.analyzed) return;

    try {
        if (!state.audioContext) {
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        const arrayBuffer = await track.file.arrayBuffer();
        const audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer.slice(0));

        let sum = 0;
        const data = audioBuffer.getChannelData(0);
        const len = Math.min(data.length, audioBuffer.sampleRate * 30);
        for (let i = 0; i < len; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / len);
        track.lufs = -0.691 + 10 * Math.log10(Math.max(rms * rms, 1e-10));

        track.analyzed = true;
        console.log('Analyzed:', track.name, 'LUFS:', track.lufs.toFixed(1));

        // Update analysis UI
        safeText('lufsValue', track.lufs.toFixed(1));
        safeShow('analysisSection', true);
        
        // Update meter
        const meterFill = $('loudnessMeterFill');
        if (meterFill) {
            const percent = Math.max(0, Math.min(100, ((track.lufs + 24) / 21) * 100));
            meterFill.style.width = percent + '%';
        }
        
        // Update distribution badge
        const badge = $('distributionBadge');
        if (badge) {
            if (track.lufs >= -16 && track.lufs <= -12) {
                badge.classList.add('ready');
            } else {
                badge.classList.remove('ready');
            }
        }

    } catch (err) {
        console.error('Analysis error:', err);
    }
}

/* ========= UTILITIES ========= */
function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.selectTrack = selectTrack;
window.deleteTrack = deleteTrack;
