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
    analyzing: false,
    // Enhancement state
    enhancedAudio: null,
    enhancedBlob: null,
    enhanceControlsInitialized: false,
    enhanceSettings: {
        loudness: { enabled: true, target: -14 },
        stereo: { enabled: true, width: 25 },
        eq: { 
            enabled: true, 
            highShelf: true, 
            lowCut: true, 
            presence: true 
        },
        limiter: { enabled: true, ceiling: -1 }
    },
    exportFormat: 'wav'
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
    // Enhance elements
    elements.enhanceTrackSelector = document.getElementById('enhanceTrackSelector');
    elements.enhanceProgress = document.getElementById('enhanceProgress');
    elements.enhanceProgressBar = document.getElementById('enhanceProgressBar');
    elements.progressText = document.getElementById('progressText');
    elements.progressPercent = document.getElementById('progressPercent');
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
    document.getElementById('continueToEnhance')?.addEventListener('click', () => {
        console.log('Continue to Enhance clicked');
        if (state.tracks.length === 0) {
            showToast('Upload mindst én track først', 'warning');
            return;
        }
        try {
            goToStep('enhance');
            initEnhanceStep();
        } catch (e) {
            console.error('Error going to enhance:', e);
            showToast('Fejl: ' + e.message, 'error');
        }
    });
    
    document.getElementById('continueToMetadata')?.addEventListener('click', () => {
        goToStep('metadata');
    });
    
    document.getElementById('skipEnhance')?.addEventListener('click', () => {
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
    document.getElementById('backToUploadFromEnhance')?.addEventListener('click', () => goToStep('upload'));
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
    const steps = ['upload', 'enhance', 'metadata', 'artwork', 'export'];
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
    const checkEnhanced = document.getElementById('checkEnhanced');
    const checkMetadata = document.getElementById('checkMetadata');
    const checkArtwork = document.getElementById('checkArtwork');
    const checkAnalysis = document.getElementById('checkAnalysis');
    
    checkAudio.classList.toggle('complete', state.tracks.length > 0);
    checkEnhanced?.classList.toggle('complete', track.enhanced === true);
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
    
    // Add audio file (use enhanced if available)
    if (track.enhancedFile) {
        folder.file(`${sanitizeFilename(track.metadata.title)}.wav`, track.enhancedFile);
    } else {
        folder.file(track.file.name, track.file);
    }
    
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
    // Download audio (use enhanced if available)
    if (track.enhancedFile) {
        downloadBlob(track.enhancedFile, `${sanitizeFilename(track.metadata.title)}.wav`);
    } else {
        downloadBlob(track.file, track.file.name);
    }
    
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
        enhanced: track.enhanced || false,
        lyrics: track.metadata.lyrics,
        filename: track.enhanced ? `${track.metadata.title}.wav` : track.file.name
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
// AUDIO ENHANCEMENT
// =====================================================
function initEnhanceStep() {
    console.log('Initializing enhance step');
    
    // Update track selector
    const selector = elements.enhanceTrackSelector || document.getElementById('enhanceTrackSelector');
    if (selector) {
        selector.innerHTML = state.tracks.map((track, index) => 
            `<option value="${index}">${escapeHtml(track.name)}</option>`
        ).join('');
        selector.value = state.currentTrackIndex;
    }
    
    // Update "before" stats
    const track = state.tracks[state.currentTrackIndex];
    if (track) {
        const beforeLufs = document.getElementById('beforeLufs');
        const beforePeak = document.getElementById('beforePeak');
        const beforeStereo = document.getElementById('beforeStereo');
        
        if (beforeLufs) beforeLufs.textContent = track.lufs ? `${track.lufs.toFixed(1)}` : '--';
        if (beforePeak) beforePeak.textContent = track.peak ? `${track.peak.toFixed(1)} dB` : '--';
        if (beforeStereo) beforeStereo.textContent = 'Mono/Stereo';
    }
    
    // Reset enhanced state
    state.enhancedBlob = null;
    const playAfter = document.getElementById('playAfter');
    const continueBtn = document.getElementById('continueToMetadata');
    if (playAfter) playAfter.disabled = true;
    if (continueBtn) continueBtn.disabled = false;
    
    // Initialize controls (only once)
    if (!state.enhanceControlsInitialized) {
        initEnhanceControls();
        state.enhanceControlsInitialized = true;
    }
    
    console.log('Enhance step initialized');
}

function initEnhanceControls() {
    // Loudness slider
    const loudnessSlider = document.getElementById('loudnessSlider');
    const loudnessValue = document.getElementById('loudnessValue');
    loudnessSlider?.addEventListener('input', (e) => {
        const val = e.target.value;
        loudnessValue.textContent = `${val} LUFS`;
        state.enhanceSettings.loudness.target = parseFloat(val);
    });
    
    // Stereo slider
    const stereoSlider = document.getElementById('stereoSlider');
    const stereoValue = document.getElementById('stereoValue');
    stereoSlider?.addEventListener('input', (e) => {
        const val = e.target.value;
        stereoValue.textContent = `${val}%`;
        state.enhanceSettings.stereo.width = parseInt(val);
    });
    
    // Limiter slider
    const limiterSlider = document.getElementById('limiterSlider');
    const limiterValue = document.getElementById('limiterValue');
    limiterSlider?.addEventListener('input', (e) => {
        const val = e.target.value;
        limiterValue.textContent = `${val} dB`;
        state.enhanceSettings.limiter.ceiling = parseFloat(val);
    });
    
    // Checkboxes
    document.getElementById('enableLoudness')?.addEventListener('change', (e) => {
        state.enhanceSettings.loudness.enabled = e.target.checked;
    });
    document.getElementById('enableStereo')?.addEventListener('change', (e) => {
        state.enhanceSettings.stereo.enabled = e.target.checked;
    });
    document.getElementById('enableEQ')?.addEventListener('change', (e) => {
        state.enhanceSettings.eq.enabled = e.target.checked;
    });
    document.getElementById('enableLimiter')?.addEventListener('change', (e) => {
        state.enhanceSettings.limiter.enabled = e.target.checked;
    });
    
    // EQ options
    document.getElementById('eqHighShelf')?.addEventListener('change', (e) => {
        state.enhanceSettings.eq.highShelf = e.target.checked;
    });
    document.getElementById('eqLowCut')?.addEventListener('change', (e) => {
        state.enhanceSettings.eq.lowCut = e.target.checked;
    });
    document.getElementById('eqPresence')?.addEventListener('change', (e) => {
        state.enhanceSettings.eq.presence = e.target.checked;
    });
    
    // Track selector change
    elements.enhanceTrackSelector?.addEventListener('change', (e) => {
        state.currentTrackIndex = parseInt(e.target.value);
        initEnhanceStep();
    });
    
    // Process button
    document.getElementById('processEnhance')?.addEventListener('click', processEnhancement);
    
    // Play buttons
    document.getElementById('playBefore')?.addEventListener('click', () => {
        const track = state.tracks[state.currentTrackIndex];
        if (track) {
            playTrack(state.currentTrackIndex);
        }
    });
    
    document.getElementById('playAfter')?.addEventListener('click', () => {
        if (state.enhancedBlob) {
            playEnhancedAudio();
        }
    });
    
    // Export format toggle
    document.querySelectorAll('.enhance-export-format .toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.enhance-export-format .toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.exportFormat = btn.dataset.format;
        });
    });
}

async function processEnhancement() {
    const track = state.tracks[state.currentTrackIndex];
    if (!track) return;
    
    // Show progress
    elements.enhanceProgress?.classList.remove('hidden');
    updateProgress(0, 'Forbereder...');
    
    try {
        // Ensure AudioContext
        if (!state.audioContext) {
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (state.audioContext.state === 'suspended') {
            await state.audioContext.resume();
        }
        
        updateProgress(10, 'Læser audio...');
        
        // Decode audio
        const arrayBuffer = await track.file.arrayBuffer();
        const audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer.slice(0));
        
        updateProgress(20, 'Analyserer...');
        
        // Create offline context for processing
        const offlineCtx = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );
        
        // Create buffer source
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        
        let currentNode = source;
        
        // Apply EQ if enabled
        if (state.enhanceSettings.eq.enabled) {
            updateProgress(30, 'Anvender EQ...');
            
            // Low cut (high-pass filter)
            if (state.enhanceSettings.eq.lowCut) {
                const highpass = offlineCtx.createBiquadFilter();
                highpass.type = 'highpass';
                highpass.frequency.value = 80;
                highpass.Q.value = 0.7;
                currentNode.connect(highpass);
                currentNode = highpass;
            }
            
            // Presence boost
            if (state.enhanceSettings.eq.presence) {
                const presence = offlineCtx.createBiquadFilter();
                presence.type = 'peaking';
                presence.frequency.value = 3000;
                presence.gain.value = 1.5;
                presence.Q.value = 1;
                currentNode.connect(presence);
                currentNode = presence;
            }
            
            // High shelf
            if (state.enhanceSettings.eq.highShelf) {
                const highShelf = offlineCtx.createBiquadFilter();
                highShelf.type = 'highshelf';
                highShelf.frequency.value = 10000;
                highShelf.gain.value = 2;
                currentNode.connect(highShelf);
                currentNode = highShelf;
            }
        }
        
        updateProgress(50, 'Anvender stereo widening...');
        
        // Connect to destination
        currentNode.connect(offlineCtx.destination);
        
        // Start and render
        source.start(0);
        const renderedBuffer = await offlineCtx.startRendering();
        
        updateProgress(60, 'Anvender loudness normalisering...');
        
        // Apply loudness normalization and limiting in a second pass
        let processedBuffer = renderedBuffer;
        
        if (state.enhanceSettings.loudness.enabled || state.enhanceSettings.limiter.enabled) {
            processedBuffer = await applyLoudnessAndLimiter(renderedBuffer);
        }
        
        // Apply stereo widening
        if (state.enhanceSettings.stereo.enabled && processedBuffer.numberOfChannels >= 2) {
            updateProgress(75, 'Anvender stereo widening...');
            processedBuffer = applyStereoWidening(processedBuffer);
        }
        
        updateProgress(85, 'Eksporterer...');
        
        // Convert to WAV or MP3
        let blob;
        if (state.exportFormat === 'wav') {
            blob = audioBufferToWav(processedBuffer);
        } else {
            // For MP3, we'll export as WAV (MP3 encoding requires external library)
            blob = audioBufferToWav(processedBuffer);
            showToast('MP3 encoding kræver ekstra bibliotek - eksporterer som WAV', 'warning');
        }
        
        state.enhancedBlob = blob;
        
        // Update track with enhanced version
        track.enhancedFile = blob;
        track.enhanced = true;
        
        // Calculate new LUFS
        const newLufs = await calculateLUFS(processedBuffer);
        
        updateProgress(100, 'Færdig!');
        
        // Update UI
        document.getElementById('afterLufs').textContent = newLufs.toFixed(1);
        document.getElementById('afterPeak').textContent = `${state.enhanceSettings.limiter.ceiling} dB`;
        document.getElementById('afterStereo').textContent = state.enhanceSettings.stereo.enabled ? 'Wide' : 'Normal';
        
        document.getElementById('playAfter').disabled = false;
        document.getElementById('continueToMetadata').disabled = false;
        
        showToast('Audio enhancement færdig! 🎉', 'success');
        
        // Hide progress after delay
        setTimeout(() => {
            elements.enhanceProgress?.classList.add('hidden');
        }, 2000);
        
    } catch (error) {
        console.error('Enhancement error:', error);
        showToast('Fejl under enhancement: ' + error.message, 'error');
        elements.enhanceProgress?.classList.add('hidden');
    }
}

function updateProgress(percent, text) {
    if (elements.enhanceProgressBar) {
        elements.enhanceProgressBar.style.width = `${percent}%`;
    }
    if (elements.progressPercent) {
        elements.progressPercent.textContent = `${percent}%`;
    }
    if (elements.progressText) {
        elements.progressText.textContent = text;
    }
}

async function applyLoudnessAndLimiter(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    
    // Create new buffer
    const newBuffer = state.audioContext.createBuffer(numChannels, length, sampleRate);
    
    // Calculate current loudness
    let sumSquares = 0;
    for (let ch = 0; ch < numChannels; ch++) {
        const data = audioBuffer.getChannelData(ch);
        for (let i = 0; i < length; i++) {
            sumSquares += data[i] * data[i];
        }
    }
    const rms = Math.sqrt(sumSquares / (length * numChannels));
    const currentLufs = -0.691 + 10 * Math.log10(Math.max(rms * rms, 1e-10));
    
    // Calculate gain needed
    const targetLufs = state.enhanceSettings.loudness.target;
    const gainDb = state.enhanceSettings.loudness.enabled ? (targetLufs - currentLufs) : 0;
    const gain = Math.pow(10, gainDb / 20);
    
    // Limiter ceiling
    const ceiling = Math.pow(10, state.enhanceSettings.limiter.ceiling / 20);
    
    // Process each channel
    for (let ch = 0; ch < numChannels; ch++) {
        const inputData = audioBuffer.getChannelData(ch);
        const outputData = newBuffer.getChannelData(ch);
        
        for (let i = 0; i < length; i++) {
            let sample = inputData[i] * gain;
            
            // Soft limiter (tanh-based)
            if (state.enhanceSettings.limiter.enabled) {
                if (Math.abs(sample) > ceiling * 0.8) {
                    sample = Math.tanh(sample / ceiling) * ceiling;
                }
                // Hard clip as safety
                sample = Math.max(-ceiling, Math.min(ceiling, sample));
            }
            
            outputData[i] = sample;
        }
    }
    
    return newBuffer;
}

function applyStereoWidening(audioBuffer) {
    if (audioBuffer.numberOfChannels < 2) return audioBuffer;
    
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const width = state.enhanceSettings.stereo.width / 100;
    
    const newBuffer = state.audioContext.createBuffer(2, length, sampleRate);
    
    const leftIn = audioBuffer.getChannelData(0);
    const rightIn = audioBuffer.getChannelData(1);
    const leftOut = newBuffer.getChannelData(0);
    const rightOut = newBuffer.getChannelData(1);
    
    for (let i = 0; i < length; i++) {
        const mid = (leftIn[i] + rightIn[i]) * 0.5;
        const side = (leftIn[i] - rightIn[i]) * 0.5;
        
        // Increase side signal for wider stereo
        const wideSide = side * (1 + width);
        
        leftOut[i] = mid + wideSide;
        rightOut[i] = mid - wideSide;
        
        // Normalize to prevent clipping
        const maxSample = Math.max(Math.abs(leftOut[i]), Math.abs(rightOut[i]));
        if (maxSample > 0.99) {
            leftOut[i] /= maxSample;
            rightOut[i] /= maxSample;
        }
    }
    
    return newBuffer;
}

function audioBufferToWav(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const length = audioBuffer.length;
    const dataSize = length * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    
    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    
    // Interleave audio data
    const channels = [];
    for (let ch = 0; ch < numChannels; ch++) {
        channels.push(audioBuffer.getChannelData(ch));
    }
    
    let offset = 44;
    for (let i = 0; i < length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const sample = Math.max(-1, Math.min(1, channels[ch][i]));
            const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, intSample, true);
            offset += 2;
        }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function playEnhancedAudio() {
    if (!state.enhancedBlob) return;
    
    const url = URL.createObjectURL(state.enhancedBlob);
    state.audio.src = url;
    state.audio.play();
    state.isPlaying = true;
    updatePlayButton();
    
    elements.audioPlayer.classList.remove('hidden');
    document.querySelector('.player-title').textContent = state.tracks[state.currentTrackIndex]?.name + ' (Enhanced)';
    document.querySelector('.player-artist').textContent = 'Enhanced';
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
    try {
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.duration;
        
        // Limit analysis to 30 seconds max (from middle of track)
        const maxSamples = Math.min(channelData.length, sampleRate * 30);
        const startOffset = Math.floor((channelData.length - maxSamples) / 2);
        
        // Downsample significantly for faster processing
        const downsampleFactor = Math.max(1, Math.floor(sampleRate / 4000)); // Target ~4kHz
        const samples = [];
        
        for (let i = 0; i < maxSamples; i += downsampleFactor) {
            samples.push(Math.abs(channelData[startOffset + i]));
        }
        
        const effectiveSampleRate = sampleRate / downsampleFactor;
        
        // Simple low-pass filter using moving average
        const windowSize = Math.floor(effectiveSampleRate / 20); // 50ms window
        const filtered = [];
        
        for (let i = 0; i < samples.length; i++) {
            let sum = 0;
            let count = 0;
            const start = Math.max(0, i - windowSize);
            const end = Math.min(samples.length, i + windowSize);
            
            for (let j = start; j < end; j++) {
                sum += samples[j];
                count++;
            }
            filtered.push(sum / count);
        }
        
        // Find threshold for peaks
        let maxVal = 0;
        for (let i = 0; i < filtered.length; i++) {
            if (filtered[i] > maxVal) maxVal = filtered[i];
        }
        const threshold = maxVal * 0.4;
        
        // Detect peaks with minimum distance
        const minPeakDistance = Math.floor(effectiveSampleRate * 0.25); // Min 0.25s between beats
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
        
        if (peaks.length < 4) {
            // Fallback to energy-based detection
            return detectBPMEnergy(samples, effectiveSampleRate);
        }
        
        // Calculate intervals
        const intervals = [];
        for (let i = 1; i < peaks.length; i++) {
            intervals.push(peaks[i] - peaks[i - 1]);
        }
        
        // Find median interval (more robust than mean)
        intervals.sort((a, b) => a - b);
        const medianInterval = intervals[Math.floor(intervals.length / 2)];
        
        // Convert to BPM
        const secondsPerBeat = medianInterval / effectiveSampleRate;
        let bpm = Math.round(60 / secondsPerBeat);
        
        // Normalize to 60-180 range
        while (bpm < 60) bpm *= 2;
        while (bpm > 180) bpm /= 2;
        
        return bpm;
        
    } catch (error) {
        console.error('BPM detection error:', error);
        return 120; // Default fallback
    }
}

// Energy-based BPM detection fallback
function detectBPMEnergy(samples, sampleRate) {
    try {
        // Calculate energy in windows
        const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
        const energies = [];
        
        for (let i = 0; i < samples.length - windowSize; i += windowSize) {
            let energy = 0;
            for (let j = 0; j < windowSize; j++) {
                energy += samples[i + j] * samples[i + j];
            }
            energies.push(energy);
        }
        
        // Find peaks in energy
        const avgEnergy = energies.reduce((a, b) => a + b, 0) / energies.length;
        let beatCount = 0;
        let wasAbove = false;
        
        for (let i = 0; i < energies.length; i++) {
            const isAbove = energies[i] > avgEnergy * 1.2;
            if (isAbove && !wasAbove) {
                beatCount++;
            }
            wasAbove = isAbove;
        }
        
        // Calculate BPM from beat count
        const durationSeconds = samples.length / sampleRate;
        let bpm = Math.round((beatCount / durationSeconds) * 60);
        
        // Normalize
        while (bpm < 60) bpm *= 2;
        while (bpm > 180) bpm /= 2;
        
        return bpm || 120;
        
    } catch (error) {
        return 120;
    }
}

// Loudness (LUFS) calculation
async function calculateLUFS(audioBuffer) {
    try {
        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const totalSamples = audioBuffer.length;
        
        // Limit to 60 seconds max for analysis
        const maxSamples = Math.min(totalSamples, sampleRate * 60);
        const startOffset = Math.floor((totalSamples - maxSamples) / 2);
        
        let totalMeanSquare = 0;
        
        for (let ch = 0; ch < numChannels; ch++) {
            const channelData = audioBuffer.getChannelData(ch);
            let sumSquares = 0;
            let prevSample = 0;
            
            // Process in chunks to avoid stack issues
            for (let i = startOffset; i < startOffset + maxSamples; i++) {
                // Simple high-pass filter
                const filtered = channelData[i] - 0.995 * prevSample;
                prevSample = channelData[i];
                
                sumSquares += filtered * filtered;
            }
            
            totalMeanSquare += sumSquares / maxSamples;
        }
        
        // Average across channels
        totalMeanSquare /= numChannels;
        
        // Convert to LUFS
        const lufs = -0.691 + 10 * Math.log10(Math.max(totalMeanSquare, 1e-10));
        
        return Math.round(lufs * 10) / 10;
        
    } catch (error) {
        console.error('LUFS calculation error:', error);
        return -14; // Default fallback
    }
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
