/* =====================================================
   SUNOSHIP - Main Application Logic
   Music Distribution Prep Tool
   ===================================================== */

// App State
const state = {
    tracks: [],
    currentTrackIndex: 0,
    coverImage: null,
    coverImageData: null,
    audio: null,
    isPlaying: false,
    metadataFormat: 'json',
    audioContext: null,
    analyzing: false
};

// DOM Elements
const elements = {};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    initSplash();
    initDropZone();
    initUrlInput();
    initNavigation();
    initMetadataForm();
    initArtwork();
    initExport();
    initAudioPlayer();
});

// Cache DOM elements
function cacheElements() {
    elements.splash = document.getElementById('splash');
    elements.app = document.getElementById('app');
    elements.dropZone = document.getElementById('dropZone');
    elements.fileInput = document.getElementById('fileInput');
    elements.sunoUrl = document.getElementById('sunoUrl');
    elements.fetchUrl = document.getElementById('fetchUrl');
    elements.trackList = document.getElementById('trackList');
    elements.tracks = document.getElementById('tracks');
    elements.trackSelector = document.getElementById('trackSelector');
    elements.coverPreview = document.getElementById('coverPreview');
    elements.artworkInput = document.getElementById('artworkInput');
    elements.artworkDropZone = document.getElementById('artworkDropZone');
    elements.audioPlayer = document.getElementById('audioPlayer');
    elements.toasts = document.getElementById('toasts');
    elements.analysisSection = document.getElementById('analysisSection');
    elements.bpmValue = document.getElementById('bpmValue');
    elements.lufsValue = document.getElementById('lufsValue');
    elements.bpmStatus = document.getElementById('bpmStatus');
    elements.lufsStatus = document.getElementById('lufsStatus');
    elements.loudnessMeterFill = document.getElementById('loudnessMeterFill');
    elements.distributionBadge = document.getElementById('distributionBadge');
}

// =====================================================
// SPLASH SCREEN
// =====================================================
function initSplash() {
    setTimeout(() => {
        elements.splash.classList.add('fade-out');
        setTimeout(() => {
            elements.app.classList.remove('hidden');
        }, 600);
    }, 2500);
}

// =====================================================
// NAVIGATION
// =====================================================
function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            const step = btn.dataset.step;
            goToStep(step);
        });
    });
    
    // Continue buttons
    document.getElementById('continueToMetadata')?.addEventListener('click', () => {
        if (state.tracks.length === 0) {
            showToast('Upload mindst én track først', 'warning');
            return;
        }
        goToStep('metadata');
    });
    
    document.getElementById('continueToArtwork')?.addEventListener('click', () => {
        if (!validateMetadata()) return;
        goToStep('artwork');
    });
    
    document.getElementById('continueToExport')?.addEventListener('click', () => {
        goToStep('export');
        updateExportSummary();
    });
    
    // Back buttons
    document.getElementById('backToUpload')?.addEventListener('click', () => goToStep('upload'));
    document.getElementById('backToMetadata')?.addEventListener('click', () => goToStep('metadata'));
    document.getElementById('backToArtwork')?.addEventListener('click', () => goToStep('artwork'));
    
    // Re-analyze button
    document.getElementById('reanalyzeBtn')?.addEventListener('click', async () => {
        const track = state.tracks[state.currentTrackIndex];
        if (track) {
            // Ensure AudioContext is created on user gesture
            if (!state.audioContext) {
                state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (state.audioContext.state === 'suspended') {
                await state.audioContext.resume();
            }
            analyzeTrack(track);
        }
    });
}

function goToStep(stepName) {
    // Update nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.step === stepName) {
            btn.classList.add('active');
        }
    });
    
    // Enable nav buttons up to current step
    const steps = ['upload', 'metadata', 'artwork', 'export'];
    const currentIndex = steps.indexOf(stepName);
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const btnIndex = steps.indexOf(btn.dataset.step);
        btn.disabled = btnIndex > currentIndex;
        if (btnIndex < currentIndex) {
            btn.classList.add('completed');
        }
    });
    
    // Show step
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active');
    });
    document.getElementById(`step-${stepName}`)?.classList.add('active');
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =====================================================
// DRAG & DROP UPLOAD
// =====================================================
function initDropZone() {
    const dropZone = elements.dropZone;
    const fileInput = elements.fileInput;
    
    // Click to upload
    dropZone.addEventListener('click', () => fileInput.click());
    
    // Drag events
    ['dragenter', 'dragover'].forEach(event => {
        dropZone.addEventListener(event, (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
    });
    
    ['dragleave', 'drop'].forEach(event => {
        dropZone.addEventListener(event, (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
        });
    });
    
    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        handleFiles(files);
    });
    
    // File input change
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
}

function handleFiles(files) {
    const audioFiles = Array.from(files).filter(file => 
        file.type.startsWith('audio/') || 
        /\.(mp3|wav|flac|m4a|ogg)$/i.test(file.name)
    );
    
    if (audioFiles.length === 0) {
        showToast('Vælg venligst lydfiler (MP3, WAV, FLAC)', 'error');
        return;
    }
    
    audioFiles.forEach(file => {
        addTrack(file);
    });
    
    showToast(`${audioFiles.length} track(s) uploadet`, 'success');
}

function addTrack(file) {
    const track = {
        id: Date.now() + Math.random(),
        file: file,
        name: file.name.replace(/\.[^/.]+$/, ''),
        size: formatFileSize(file.size),
        duration: null,
        bpm: null,
        lufs: null,
        analyzed: false,
        metadata: {
            title: file.name.replace(/\.[^/.]+$/, ''),
            artist: '',
            album: '',
            genre: '',
            releaseDate: new Date().toISOString().split('T')[0],
            copyrightYear: new Date().getFullYear(),
            isrc: '',
            lyrics: '',
            bpm: null
        }
    };
    
    // Get duration
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    audio.addEventListener('loadedmetadata', () => {
        track.duration = formatDuration(audio.duration);
        updateTrackList();
    });
    
    state.tracks.push(track);
    updateTrackList();
    updateTrackSelector();
    
    // Trigger audio analysis
    analyzeTrack(track);
}

function updateTrackList() {
    if (state.tracks.length === 0) {
        elements.trackList.classList.add('hidden');
        return;
    }
    
    elements.trackList.classList.remove('hidden');
    elements.tracks.innerHTML = state.tracks.map((track, index) => `
        <div class="track-item" data-id="${track.id}">
            <div class="track-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18V5l12-2v13"/>
                    <circle cx="6" cy="18" r="3"/>
                    <circle cx="18" cy="16" r="3"/>
                </svg>
            </div>
            <div class="track-info">
                <div class="track-name">${escapeHtml(track.name)}</div>
                <div class="track-meta">
                    <span>${track.size}</span>
                    <span>${track.duration || 'Indlæser...'}</span>
                </div>
                ${track.analyzed ? `
                <div class="track-badges">
                    ${track.bpm ? `<span class="track-badge bpm">${track.bpm} BPM</span>` : ''}
                    ${track.lufs !== null ? `<span class="track-badge lufs ${getLufsClass(track.lufs)}">${track.lufs.toFixed(1)} LUFS</span>` : ''}
                </div>
                ` : ''}
            </div>
            <div class="track-actions">
                <button class="track-btn play" onclick="playTrack(${index})" title="Afspil">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                </button>
                <button class="track-btn delete" onclick="deleteTrack('${track.id}')" title="Slet">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

function getLufsClass(lufs) {
    if (lufs >= -15 && lufs <= -13) return 'good';
    if (lufs >= -17 && lufs <= -11) return 'warning';
    return 'loud';
}

function deleteTrack(id) {
    state.tracks = state.tracks.filter(t => t.id !== id);
    updateTrackList();
    updateTrackSelector();
    showToast('Track slettet', 'success');
}

// =====================================================
// URL INPUT
// =====================================================
function initUrlInput() {
    elements.fetchUrl.addEventListener('click', () => {
        const url = elements.sunoUrl.value.trim();
        if (!url) {
            showToast('Indtast en Suno.ai URL', 'warning');
            return;
        }
        
        if (!url.includes('suno.ai') && !url.includes('suno.com')) {
            showToast('URL skal være fra Suno.ai', 'error');
            return;
        }
        
        showToast('Suno download er ikke implementeret i denne demo. Upload filen manuelt.', 'warning');
        elements.sunoUrl.value = '';
    });
    
    elements.sunoUrl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            elements.fetchUrl.click();
        }
    });
}

// =====================================================
// METADATA FORM
// =====================================================
function initMetadataForm() {
    // Track selector
    elements.trackSelector?.addEventListener('change', (e) => {
        state.currentTrackIndex = parseInt(e.target.value);
        loadTrackMetadata();
        
        // Update analysis UI if track has been analyzed
        const track = state.tracks[state.currentTrackIndex];
        if (track && track.analyzed) {
            updateAnalysisUI(track);
        } else if (track) {
            resetAnalysisUI();
            elements.bpmStatus.textContent = 'Ikke analyseret';
            elements.lufsStatus.textContent = 'Ikke analyseret';
            document.querySelector('.bpm-card')?.classList.remove('analyzing');
            document.querySelector('.loudness-card')?.classList.remove('analyzing');
        }
    });
    
    // Auto-save on input
    const metadataFields = ['trackTitle', 'artistName', 'albumName', 'genre', 'releaseDate', 'copyrightYear', 'isrc', 'lyrics'];
    metadataFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', saveTrackMetadata);
            field.addEventListener('change', saveTrackMetadata);
        }
    });
    
    // Generate ISRC
    document.getElementById('generateIsrc')?.addEventListener('click', () => {
        const isrc = generateISRC();
        document.getElementById('isrc').value = isrc;
        saveTrackMetadata();
        showToast('ISRC genereret', 'success');
    });
    
    // AI Suggest
    document.getElementById('aiSuggest')?.addEventListener('click', () => {
        showToast('AI forslag kræver API integration', 'warning');
    });
}

function updateTrackSelector() {
    if (!elements.trackSelector) return;
    
    elements.trackSelector.innerHTML = state.tracks.map((track, index) => 
        `<option value="${index}">${escapeHtml(track.name)}</option>`
    ).join('');
    
    if (state.tracks.length > 0) {
        loadTrackMetadata();
    }
}

function loadTrackMetadata() {
    const track = state.tracks[state.currentTrackIndex];
    if (!track) return;
    
    document.getElementById('trackTitle').value = track.metadata.title || '';
    document.getElementById('artistName').value = track.metadata.artist || '';
    document.getElementById('albumName').value = track.metadata.album || '';
    document.getElementById('genre').value = track.metadata.genre || '';
    document.getElementById('releaseDate').value = track.metadata.releaseDate || '';
    document.getElementById('copyrightYear').value = track.metadata.copyrightYear || '';
    document.getElementById('isrc').value = track.metadata.isrc || '';
    document.getElementById('lyrics').value = track.metadata.lyrics || '';
}

function saveTrackMetadata() {
    const track = state.tracks[state.currentTrackIndex];
    if (!track) return;
    
    track.metadata = {
        title: document.getElementById('trackTitle').value,
        artist: document.getElementById('artistName').value,
        album: document.getElementById('albumName').value,
        genre: document.getElementById('genre').value,
        releaseDate: document.getElementById('releaseDate').value,
        copyrightYear: document.getElementById('copyrightYear').value,
        isrc: document.getElementById('isrc').value,
        lyrics: document.getElementById('lyrics').value
    };
    
    // Also update track name display
    track.name = track.metadata.title || track.file.name.replace(/\.[^/.]+$/, '');
}

function validateMetadata() {
    const track = state.tracks[state.currentTrackIndex];
    if (!track) return false;
    
    const required = ['title', 'artist', 'genre'];
    const missing = required.filter(field => !track.metadata[field]);
    
    if (missing.length > 0) {
        showToast(`Udfyld venligst: ${missing.join(', ')}`, 'error');
        return false;
    }
    
    return true;
}

function generateISRC() {
    const country = 'DK';
    const registrant = 'XXX';
    const year = new Date().getFullYear().toString().slice(-2);
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${country}${registrant}${year}${code}`;
}

// =====================================================
// ARTWORK
// =====================================================
function initArtwork() {
    const dropZone = elements.artworkDropZone;
    const fileInput = elements.artworkInput;
    
    // Click to upload
    dropZone.addEventListener('click', () => fileInput.click());
    
    // Drag events
    ['dragenter', 'dragover'].forEach(event => {
        dropZone.addEventListener(event, (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--accent-1)';
        });
    });
    
    ['dragleave', 'drop'].forEach(event => {
        dropZone.addEventListener(event, (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '';
        });
    });
    
    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleArtwork(files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleArtwork(e.target.files[0]);
        }
    });
    
    // AI Generate button
    document.getElementById('generateArtwork')?.addEventListener('click', () => {
        showToast('AI artwork generation kræver API integration', 'warning');
    });
}

function handleArtwork(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Vælg venligst en billedfil', 'error');
        return;
    }
    
    state.coverImage = file;
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
        state.coverImageData = e.target.result;
        
        // Resize to 3000x3000
        resizeImage(e.target.result, 3000, 3000, (resizedData) => {
            state.coverImageData = resizedData;
            
            elements.coverPreview.innerHTML = `<img src="${resizedData}" alt="Cover art">`;
            elements.coverPreview.classList.add('has-image');
            
            document.getElementById('coverStatus').textContent = 'Cover uploadet ✓';
            
            // Show mockup
            const mockup = document.getElementById('albumMockup');
            mockup.classList.remove('hidden');
            document.getElementById('mockupSpotify').src = resizedData;
            document.getElementById('mockupApple').src = resizedData;
            
            showToast('Cover art uploadet og resized til 3000x3000px', 'success');
        });
    };
    reader.readAsDataURL(file);
}

function resizeImage(dataUrl, width, height, callback) {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        
        // Calculate crop to make it square
        const size = Math.min(img.width, img.height);
        const x = (img.width - size) / 2;
        const y = (img.height - size) / 2;
        
        ctx.drawImage(img, x, y, size, size, 0, 0, width, height);
        
        callback(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.src = dataUrl;
}

// =====================================================
// EXPORT
// =====================================================
function initExport() {
    // Metadata format toggle
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.metadataFormat = btn.dataset.format;
        });
    });
    
    // Download button
    document.getElementById('downloadExport')?.addEventListener('click', downloadPackage);
}

function updateExportSummary() {
    const track = state.tracks[state.currentTrackIndex];
    if (!track) return;
    
    // Update summary card
    document.getElementById('summaryTitle').textContent = track.metadata.title || 'Untitled';
    document.getElementById('summaryArtist').textContent = track.metadata.artist || 'Unknown Artist';
    document.getElementById('summaryGenre').textContent = track.metadata.genre || 'Genre';
    document.getElementById('summaryYear').textContent = track.metadata.copyrightYear || new Date().getFullYear();
    
    // Update cover
    const summaryCover = document.getElementById('summaryCover');
    if (state.coverImageData) {
        summaryCover.innerHTML = `<img src="${state.coverImageData}" alt="Cover">`;
    }
    
    // Update checklist
    const checkAudio = document.getElementById('checkAudio');
    const checkMetadata = document.getElementById('checkMetadata');
    const checkArtwork = document.getElementById('checkArtwork');
    const checkAnalysis = document.getElementById('checkAnalysis');
    
    checkAudio.classList.toggle('complete', state.tracks.length > 0);
    checkMetadata.classList.toggle('complete', track.metadata.title && track.metadata.artist);
    checkArtwork.classList.toggle('complete', state.coverImageData !== null);
    checkAnalysis?.classList.toggle('complete', track.analyzed && track.bpm !== null);
}

async function downloadPackage() {
    const track = state.tracks[state.currentTrackIndex];
    if (!track) {
        showToast('Ingen track valgt', 'error');
        return;
    }
    
    const format = document.querySelector('input[name="exportFormat"]:checked').value;
    
    showToast('Forbereder download...', 'success');
    
    if (format === 'zip') {
        await downloadAsZip(track);
    } else {
        await downloadIndividual(track);
    }
}

async function downloadAsZip(track) {
    // Check if JSZip is available, if not, download individually
    if (typeof JSZip === 'undefined') {
        // Load JSZip dynamically
        try {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
        } catch (e) {
            showToast('Kunne ikke indlæse ZIP bibliotek. Downloader individuelt.', 'warning');
            await downloadIndividual(track);
            return;
        }
    }
    
    const zip = new JSZip();
    const folderName = sanitizeFilename(`${track.metadata.artist} - ${track.metadata.title}`);
    const folder = zip.folder(folderName);
    
    // Add audio file
    folder.file(track.file.name, track.file);
    
    // Add cover art
    if (state.coverImageData) {
        const coverData = state.coverImageData.split(',')[1];
        folder.file('cover.jpg', coverData, { base64: true });
    }
    
    // Add metadata
    const metadata = createMetadataFile(track);
    const metadataExt = state.metadataFormat === 'json' ? 'json' : 'csv';
    folder.file(`metadata.${metadataExt}`, metadata);
    
    // Generate and download
    const content = await zip.generateAsync({ type: 'blob' });
    downloadBlob(content, `${folderName}.zip`);
    
    showToast('ZIP pakke downloadet! 🎉', 'success');
}

async function downloadIndividual(track) {
    // Download audio
    downloadBlob(track.file, track.file.name);
    
    // Download cover
    if (state.coverImageData) {
        const coverBlob = dataURLtoBlob(state.coverImageData);
        downloadBlob(coverBlob, 'cover.jpg');
    }
    
    // Download metadata
    const metadata = createMetadataFile(track);
    const metadataExt = state.metadataFormat === 'json' ? 'json' : 'csv';
    const metadataBlob = new Blob([metadata], { type: 'text/plain' });
    downloadBlob(metadataBlob, `metadata.${metadataExt}`);
    
    showToast('Filer downloadet! 🎉', 'success');
}

function createMetadataFile(track) {
    const data = {
        title: track.metadata.title,
        artist: track.metadata.artist,
        album: track.metadata.album,
        genre: track.metadata.genre,
        releaseDate: track.metadata.releaseDate,
        copyrightYear: track.metadata.copyrightYear,
        isrc: track.metadata.isrc,
        bpm: track.bpm || null,
        lufs: track.lufs ? track.lufs.toFixed(1) : null,
        lyrics: track.metadata.lyrics,
        filename: track.file.name
    };
    
    if (state.metadataFormat === 'json') {
        return JSON.stringify(data, null, 2);
    } else {
        // CSV format
        const headers = Object.keys(data).join(',');
        const values = Object.values(data).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        return `${headers}\n${values}`;
    }
}

// =====================================================
// AUDIO PLAYER
// =====================================================
function initAudioPlayer() {
    state.audio = new Audio();
    
    state.audio.addEventListener('timeupdate', () => {
        const progress = (state.audio.currentTime / state.audio.duration) * 100;
        document.getElementById('progressFill').style.width = `${progress}%`;
        document.getElementById('currentTime').textContent = formatDuration(state.audio.currentTime);
    });
    
    state.audio.addEventListener('loadedmetadata', () => {
        document.getElementById('duration').textContent = formatDuration(state.audio.duration);
    });
    
    state.audio.addEventListener('ended', () => {
        state.isPlaying = false;
        updatePlayButton();
    });
    
    document.getElementById('playPause')?.addEventListener('click', togglePlay);
    
    // Progress bar click
    document.querySelector('.progress-bar')?.addEventListener('click', (e) => {
        const rect = e.target.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        state.audio.currentTime = percent * state.audio.duration;
    });
}

function playTrack(index) {
    const track = state.tracks[index];
    if (!track) return;
    
    state.currentTrackIndex = index;
    
    // Initialize AudioContext on user interaction (helps with analysis later)
    if (!state.audioContext) {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audioContext.state === 'suspended') {
        state.audioContext.resume();
    }
    
    // Update player UI
    elements.audioPlayer.classList.remove('hidden');
    document.querySelector('.player-title').textContent = track.metadata.title || track.name;
    document.querySelector('.player-artist').textContent = track.metadata.artist || 'Unknown';
    
    // Play audio
    state.audio.src = URL.createObjectURL(track.file);
    state.audio.play();
    state.isPlaying = true;
    updatePlayButton();
}

function togglePlay() {
    if (state.isPlaying) {
        state.audio.pause();
    } else {
        state.audio.play();
    }
    state.isPlaying = !state.isPlaying;
    updatePlayButton();
}

function updatePlayButton() {
    const btn = document.getElementById('playPause');
    if (state.isPlaying) {
        btn.classList.add('playing');
    } else {
        btn.classList.remove('playing');
    }
}

// =====================================================
// AUDIO ANALYSIS (BPM + LOUDNESS)
// =====================================================
async function analyzeTrack(track) {
    // Show analysis section
    elements.analysisSection?.classList.remove('hidden');
    
    // Reset UI
    resetAnalysisUI();
    
    try {
        // Initialize AudioContext with user gesture handling
        if (!state.audioContext) {
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Resume if suspended (browser autoplay policy)
        if (state.audioContext.state === 'suspended') {
            await state.audioContext.resume();
        }
        
        // Read file as ArrayBuffer
        const arrayBuffer = await track.file.arrayBuffer();
        
        // Decode audio data with error handling
        let audioBuffer;
        try {
            audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer.slice(0));
        } catch (decodeError) {
            console.error('Decode error:', decodeError);
            throw new Error('Kunne ikke decode audio fil. Prøv et andet format.');
        }
        
        // Run both analyses
        const [bpm, lufs] = await Promise.all([
            detectBPM(audioBuffer),
            calculateLUFS(audioBuffer)
        ]);
        
        // Update track data
        track.bpm = bpm;
        track.lufs = lufs;
        track.metadata.bpm = bpm;
        track.analyzed = true;
        
        // Update UI
        updateAnalysisUI(track);
        updateTrackList();
        
        showToast(`Analyse færdig: ${bpm} BPM, ${lufs.toFixed(1)} LUFS`, 'success');
        
    } catch (error) {
        console.error('Audio analysis error:', error);
        showToast(error.message || 'Kunne ikke analysere audio', 'error');
        
        // Mark as analyzed but with no data
        track.analyzed = true;
        elements.bpmStatus.textContent = 'Fejl';
        elements.lufsStatus.textContent = 'Fejl';
        document.querySelector('.bpm-card')?.classList.remove('analyzing');
        document.querySelector('.loudness-card')?.classList.remove('analyzing');
    }
}

function resetAnalysisUI() {
    elements.bpmValue.textContent = '--';
    elements.lufsValue.textContent = '--';
    elements.bpmStatus.textContent = 'Analyserer...';
    elements.bpmStatus.className = 'analysis-status';
    elements.lufsStatus.textContent = 'Analyserer...';
    elements.lufsStatus.className = 'analysis-status';
    elements.loudnessMeterFill.style.width = '0%';
    elements.distributionBadge.classList.remove('visible', 'warning');
    
    // Add analyzing class
    document.querySelector('.bpm-card')?.classList.add('analyzing');
    document.querySelector('.loudness-card')?.classList.add('analyzing');
}

function updateAnalysisUI(track) {
    // BPM
    elements.bpmValue.textContent = track.bpm || '--';
    elements.bpmStatus.textContent = track.bpm ? getTempoDescription(track.bpm) : 'Ukendt';
    elements.bpmStatus.className = 'analysis-status success';
    document.querySelector('.bpm-card')?.classList.remove('analyzing');
    document.querySelector('.bpm-card')?.classList.add('complete');
    
    // LUFS
    if (track.lufs !== null) {
        elements.lufsValue.textContent = track.lufs.toFixed(1);
        
        // Determine status
        const isGood = track.lufs >= -15 && track.lufs <= -13;
        const isAcceptable = track.lufs >= -17 && track.lufs <= -11;
        
        if (isGood) {
            elements.lufsStatus.textContent = 'Perfekt til streaming';
            elements.lufsStatus.className = 'analysis-status success';
            elements.distributionBadge.classList.add('visible');
            elements.distributionBadge.classList.remove('warning');
        } else if (isAcceptable) {
            elements.lufsStatus.textContent = 'Acceptabelt';
            elements.lufsStatus.className = 'analysis-status warning';
            elements.distributionBadge.classList.add('visible', 'warning');
            elements.distributionBadge.querySelector('svg').style.display = 'none';
            elements.distributionBadge.textContent = 'Kan forbedres';
        } else if (track.lufs > -11) {
            elements.lufsStatus.textContent = 'For højt! Vil blive normaliseret';
            elements.lufsStatus.className = 'analysis-status warning';
        } else {
            elements.lufsStatus.textContent = 'Meget lavt niveau';
            elements.lufsStatus.className = 'analysis-status warning';
        }
        
        // Update meter (scale: -24 to -3 LUFS)
        const meterPercent = Math.max(0, Math.min(100, ((track.lufs + 24) / 21) * 100));
        elements.loudnessMeterFill.style.width = `${meterPercent}%`;
    }
    
    document.querySelector('.loudness-card')?.classList.remove('analyzing');
    document.querySelector('.loudness-card')?.classList.add('complete');
}

function getTempoDescription(bpm) {
    if (bpm < 70) return 'Langsomt';
    if (bpm < 100) return 'Moderat';
    if (bpm < 120) return 'Medium';
    if (bpm < 140) return 'Hurtigt';
    if (bpm < 170) return 'Energisk';
    return 'Meget hurtigt';
}

// BPM Detection using peak detection algorithm
async function detectBPM(audioBuffer) {
    return new Promise((resolve) => {
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        
        // Downsample for faster processing
        const downsampleFactor = 4;
        const downsampled = [];
        for (let i = 0; i < channelData.length; i += downsampleFactor) {
            downsampled.push(Math.abs(channelData[i]));
        }
        
        // Apply low-pass filter (simple moving average)
        const windowSize = Math.floor(sampleRate / downsampleFactor / 10);
        const filtered = [];
        for (let i = 0; i < downsampled.length; i++) {
            let sum = 0;
            let count = 0;
            for (let j = Math.max(0, i - windowSize); j < Math.min(downsampled.length, i + windowSize); j++) {
                sum += downsampled[j];
                count++;
            }
            filtered.push(sum / count);
        }
        
        // Find peaks
        const threshold = Math.max(...filtered) * 0.5;
        const minPeakDistance = Math.floor(sampleRate / downsampleFactor * 0.3); // Min 0.3s between peaks
        const peaks = [];
        
        for (let i = 1; i < filtered.length - 1; i++) {
            if (filtered[i] > threshold && 
                filtered[i] > filtered[i - 1] && 
                filtered[i] > filtered[i + 1]) {
                if (peaks.length === 0 || i - peaks[peaks.length - 1] > minPeakDistance) {
                    peaks.push(i);
                }
            }
        }
        
        // Calculate intervals between peaks
        const intervals = [];
        for (let i = 1; i < peaks.length; i++) {
            intervals.push(peaks[i] - peaks[i - 1]);
        }
        
        if (intervals.length < 4) {
            // Fallback: use autocorrelation
            resolve(detectBPMAutocorrelation(channelData, sampleRate));
            return;
        }
        
        // Find most common interval (histogram approach)
        const histogram = {};
        const tolerance = Math.floor(minPeakDistance / 10);
        
        intervals.forEach(interval => {
            const bucket = Math.round(interval / tolerance) * tolerance;
            histogram[bucket] = (histogram[bucket] || 0) + 1;
        });
        
        // Find dominant interval
        let maxCount = 0;
        let dominantInterval = intervals[0];
        for (const [interval, count] of Object.entries(histogram)) {
            if (count > maxCount) {
                maxCount = count;
                dominantInterval = parseInt(interval);
            }
        }
        
        // Convert to BPM
        const secondsPerBeat = (dominantInterval * downsampleFactor) / sampleRate;
        let bpm = Math.round(60 / secondsPerBeat);
        
        // Normalize to reasonable range (60-180 BPM)
        while (bpm < 60) bpm *= 2;
        while (bpm > 180) bpm /= 2;
        
        resolve(bpm);
    });
}

// Fallback BPM detection using autocorrelation
function detectBPMAutocorrelation(channelData, sampleRate) {
    // Use a portion of the audio (middle 10 seconds or less)
    const duration = channelData.length / sampleRate;
    const startSample = Math.floor(Math.max(0, (duration / 2 - 5)) * sampleRate);
    const endSample = Math.min(channelData.length, startSample + 10 * sampleRate);
    const samples = channelData.slice(startSample, endSample);
    
    // Downsample heavily for autocorrelation
    const factor = 16;
    const downsampled = [];
    for (let i = 0; i < samples.length; i += factor) {
        downsampled.push(samples[i]);
    }
    
    const effectiveSampleRate = sampleRate / factor;
    
    // Calculate autocorrelation for different lag values
    // BPM range 60-180 corresponds to periods of 1.0s to 0.33s
    const minLag = Math.floor(effectiveSampleRate * 0.33);
    const maxLag = Math.floor(effectiveSampleRate * 1.0);
    
    let maxCorrelation = 0;
    let bestLag = minLag;
    
    for (let lag = minLag; lag <= maxLag; lag++) {
        let correlation = 0;
        for (let i = 0; i < downsampled.length - lag; i++) {
            correlation += downsampled[i] * downsampled[i + lag];
        }
        if (correlation > maxCorrelation) {
            maxCorrelation = correlation;
            bestLag = lag;
        }
    }
    
    const bpm = Math.round(60 / (bestLag / effectiveSampleRate));
    return Math.max(60, Math.min(180, bpm));
}

// Loudness (LUFS) calculation
async function calculateLUFS(audioBuffer) {
    return new Promise((resolve) => {
        const channelData = [];
        for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
            channelData.push(audioBuffer.getChannelData(i));
        }
        
        const sampleRate = audioBuffer.sampleRate;
        const numSamples = channelData[0].length;
        
        // K-weighting filter coefficients (simplified)
        // Full ITU-R BS.1770 would require proper shelf filters
        // This is a reasonable approximation
        
        // Calculate mean square for each channel
        let totalMeanSquare = 0;
        
        for (let ch = 0; ch < channelData.length; ch++) {
            const samples = channelData[ch];
            let sumSquares = 0;
            
            // Apply simplified K-weighting (high-shelf boost + high-pass)
            // For simplicity, we'll use the raw samples with a gentle high-frequency emphasis
            let prevSample = 0;
            for (let i = 0; i < numSamples; i++) {
                // Simple high-pass to remove DC and sub-bass
                const filtered = samples[i] - 0.995 * prevSample;
                prevSample = samples[i];
                
                // High-frequency emphasis (simple 1st order shelf approximation)
                const weighted = filtered * (1 + 0.2 * Math.sign(filtered) * Math.min(Math.abs(filtered), 0.5));
                
                sumSquares += weighted * weighted;
            }
            
            const meanSquare = sumSquares / numSamples;
            
            // Channel weighting (L, R = 1.0; surround would be different)
            totalMeanSquare += meanSquare;
        }
        
        // Average across channels
        totalMeanSquare /= channelData.length;
        
        // Convert to LUFS
        // LUFS = -0.691 + 10 * log10(mean_square)
        const lufs = -0.691 + 10 * Math.log10(Math.max(totalMeanSquare, 1e-10));
        
        resolve(Math.round(lufs * 10) / 10);
    });
}

// =====================================================
// UTILITIES
// =====================================================
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*]/g, '').trim();
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function dataURLtoBlob(dataURL) {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Toast notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>
    `;
    
    elements.toasts.appendChild(toast);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Make functions available globally
window.playTrack = playTrack;
window.deleteTrack = deleteTrack;
