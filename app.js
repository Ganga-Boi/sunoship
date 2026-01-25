/* =====================================================
   SUNOSHIP LITE v4.0 - Suno → Amuse
   ===================================================== */
'use strict';
console.log('%c🚢 SunoShip Lite v4.0', 'color: #1DB954; font-size: 16px; font-weight: bold');

const $ = id => document.getElementById(id);

let state = {
    file: null,
    audioBuffer: null,
    lufs: null
};

/* ========= INIT ========= */
document.addEventListener('DOMContentLoaded', () => {
    initUpload();
    initPromptGenerator();
    initVideoCreator();
});

/* ========= UPLOAD & ANALYZE ========= */
function initUpload() {
    const dropzone = $('dropzone');
    const input = $('audioInput');

    dropzone?.addEventListener('click', () => input?.click());
    
    input?.addEventListener('change', e => {
        if (e.target.files[0]) handleFile(e.target.files[0]);
    });

    dropzone?.addEventListener('dragover', e => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });
    
    dropzone?.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-over');
    });
    
    dropzone?.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });

    $('normalizeBtn')?.addEventListener('click', normalizeAudio);
}

async function handleFile(file) {
    state.file = file;
    
    // Show analysis section
    $('analysis')?.classList.remove('hidden');
    
    // Track name (remove extension)
    const name = file.name.replace(/\.[^/.]+$/, '');
    if ($('trackName')) $('trackName').textContent = name;
    if ($('songTitle')) $('songTitle').value = name;
    
    // Format
    const ext = file.name.split('.').pop().toUpperCase();
    if ($('format')) $('format').textContent = ext;
    
    // Analyze audio
    toast('Analyserer...');
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        state.audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        
        // Duration
        const duration = state.audioBuffer.duration;
        const mins = Math.floor(duration / 60);
        const secs = Math.floor(duration % 60);
        if ($('duration')) $('duration').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        
        // Calculate LUFS
        state.lufs = calculateLUFS(state.audioBuffer);
        if ($('lufsValue')) $('lufsValue').textContent = `${state.lufs.toFixed(1)} LUFS`;
        
        // Check if within acceptable range (-13 to -15 LUFS)
        const isGood = state.lufs >= -15 && state.lufs <= -13;
        
        if (isGood) {
            $('lufsOk')?.classList.remove('hidden');
            $('lufsWarning')?.classList.add('hidden');
            if ($('lufsStatus')) $('lufsStatus').textContent = '✅';
        } else {
            $('lufsWarning')?.classList.remove('hidden');
            $('lufsOk')?.classList.add('hidden');
            if ($('lufsStatus')) $('lufsStatus').textContent = '⚠️';
        }
        
        // Auto-check audio in checklist
        if ($('checkAudio')) $('checkAudio').checked = true;
        
        // Enable video buttons if cover is also loaded
        updateVideoButtons();
        
        toast('Analyse færdig!');
        
    } catch (err) {
        console.error('Analyse fejl:', err);
        toast('Kunne ikke analysere fil', 'error');
    }
}

function calculateLUFS(audioBuffer) {
    // Simplified LUFS calculation
    const channelData = audioBuffer.getChannelData(0);
    let sum = 0;
    
    for (let i = 0; i < channelData.length; i++) {
        sum += channelData[i] * channelData[i];
    }
    
    const rms = Math.sqrt(sum / channelData.length);
    const lufs = 20 * Math.log10(rms) - 0.691;
    
    return Math.max(-60, Math.min(0, lufs));
}

async function normalizeAudio() {
    if (!state.audioBuffer) {
        toast('Upload en fil først', 'error');
        return;
    }

    toast('Normaliserer til -14 LUFS...');

    const targetLUFS = -14;
    const currentLUFS = state.lufs;
    const gainDB = targetLUFS - currentLUFS;
    const gainLinear = Math.pow(10, gainDB / 20);

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const numChannels = state.audioBuffer.numberOfChannels;
    const length = state.audioBuffer.length;
    const sampleRate = state.audioBuffer.sampleRate;

    const newBuffer = audioCtx.createBuffer(numChannels, length, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const inputData = state.audioBuffer.getChannelData(channel);
        const outputData = newBuffer.getChannelData(channel);
        
        for (let i = 0; i < length; i++) {
            let sample = inputData[i] * gainLinear;
            // Soft limiting
            if (sample > 0.95) sample = 0.95 + (sample - 0.95) * 0.1;
            if (sample < -0.95) sample = -0.95 + (sample + 0.95) * 0.1;
            outputData[i] = sample;
        }
    }

    state.audioBuffer = newBuffer;
    state.lufs = targetLUFS;

    // Update UI
    if ($('lufsValue')) $('lufsValue').textContent = '-14.0 LUFS';
    if ($('lufsStatus')) $('lufsStatus').textContent = '✅';
    $('lufsOk')?.classList.remove('hidden');
    $('lufsWarning')?.classList.add('hidden');

    // Create download
    const wavBlob = audioBufferToWav(newBuffer);
    const name = state.file.name.replace(/\.[^/.]+$/, '') + '_normalized.wav';
    
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);

    toast('Normaliseret og downloadet! ✅');
}

function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const dataLength = buffer.length * blockAlign;
    const bufferLength = 44 + dataLength;
    
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Interleave channels
    const channels = [];
    for (let i = 0; i < numChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }
    
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const sample = Math.max(-1, Math.min(1, channels[ch][i]));
            const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, intSample, true);
            offset += 2;
        }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

/* ========= COVER PROMPT GENERATOR ========= */
function initPromptGenerator() {
    $('generatePrompt')?.addEventListener('click', generatePrompt);
    $('copyPrompt')?.addEventListener('click', copyPrompt);
}

function generatePrompt() {
    const title = $('songTitle')?.value || 'Untitled';
    const genre = $('songGenre')?.value || 'music';
    const style = $('coverStyle')?.value || 'retro';
    const extra = $('extraDetails')?.value || '';

    const styleDescriptions = {
        retro: 'vintage 70s/80s aesthetic, warm colors, retro typography vibes, nostalgic feel',
        abstract: 'abstract geometric shapes, bold colors, modern artistic composition',
        neon: 'neon lights, cyberpunk city, synthwave colors (pink, blue, purple), glowing effects',
        minimal: 'minimalist design, clean lines, simple shapes, elegant negative space',
        tropical: 'tropical paradise, palm trees, sunset colors, beach vibes',
        urban: 'urban street art style, graffiti elements, city backdrop, gritty texture',
        psychedelic: 'psychedelic patterns, vibrant swirling colors, trippy visuals, 60s inspired',
        nature: 'organic natural elements, earth tones, flowing forms, peaceful atmosphere'
    };

    const prompt = `Square album cover for a ${genre} track titled "${title}".

Style: ${styleDescriptions[style]}
${extra ? `\nDetails: ${extra}` : ''}

Requirements:
- Include title "${title}" in stylish typography
- NO logos, watermarks, or social media handles
- High detail, professional album-ready artwork
- 1:1 aspect ratio, 3000x3000 px
- Clean composition, visually striking`;

    if ($('generatedPrompt')) $('generatedPrompt').value = prompt;
    $('promptResult')?.classList.remove('hidden');
    
    // Auto-check in checklist
    if ($('checkTitle')) $('checkTitle').checked = true;
    
    toast('Prompt genereret! 🎨');
}

function copyPrompt() {
    const prompt = $('generatedPrompt')?.value;
    if (!prompt) return;

    navigator.clipboard.writeText(prompt).then(() => {
        toast('Kopieret! 📋');
    }).catch(() => {
        $('generatedPrompt')?.select();
        document.execCommand('copy');
        toast('Kopieret! 📋');
    });
}

/* ========= TOAST ========= */
function toast(message, type = 'success') {
    const el = $('toast');
    if (!el) return;
    
    el.textContent = message;
    el.className = `toast ${type}`;
    
    setTimeout(() => el.classList.add('hidden'), 3000);
}

/* ========= VIDEO CREATOR ========= */
let coverImageData = null;

function initVideoCreator() {
    const coverDropzone = $('coverDropzone');
    const coverInput = $('coverInput');

    coverDropzone?.addEventListener('click', () => coverInput?.click());
    
    coverInput?.addEventListener('change', e => {
        if (e.target.files[0]) handleCoverFile(e.target.files[0]);
    });

    coverDropzone?.addEventListener('dragover', e => {
        e.preventDefault();
        coverDropzone.classList.add('drag-over');
    });
    
    coverDropzone?.addEventListener('dragleave', () => {
        coverDropzone.classList.remove('drag-over');
    });
    
    coverDropzone?.addEventListener('drop', e => {
        e.preventDefault();
        coverDropzone.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) handleCoverFile(e.dataTransfer.files[0]);
    });

    $('createReels')?.addEventListener('click', () => createSocialVideo(30, 'reels'));
    $('createFeed')?.addEventListener('click', () => createSocialVideo('full', 'feed'));
}

function handleCoverFile(file) {
    if (!file.type.startsWith('image/')) {
        toast('Kun billeder tilladt', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        coverImageData = e.target.result;
        
        // Show preview
        const preview = $('coverPreview');
        const img = $('previewImg');
        if (img) img.src = coverImageData;
        preview?.classList.remove('hidden');
        $('coverDropzone')?.classList.add('hidden');
        
        // Enable video buttons if audio is also loaded
        updateVideoButtons();
        
        // Check in checklist
        if ($('checkCover')) $('checkCover').checked = true;
        
        toast('Cover uploadet! 🖼️');
    };
    reader.readAsDataURL(file);
}

function updateVideoButtons() {
    const ready = state.file && coverImageData;
    const reelsBtn = $('createReels');
    const feedBtn = $('createFeed');
    if (reelsBtn) reelsBtn.disabled = !ready;
    if (feedBtn) feedBtn.disabled = !ready;
}

async function createSocialVideo(duration, type) {
    if (!state.file || !coverImageData) {
        toast('Upload både lyd og cover først', 'error');
        return;
    }

    const reelsBtn = $('createReels');
    const feedBtn = $('createFeed');
    const progress = $('videoProgress');
    const progressBar = $('progressBar');
    const progressText = $('progressText');
    
    // Disable both buttons
    if (reelsBtn) reelsBtn.disabled = true;
    if (feedBtn) feedBtn.disabled = true;
    progress?.classList.remove('hidden');

    try {
        // Get duration
        const audioDuration = state.audioBuffer?.duration || 30;
        let targetDuration;
        
        if (duration === 'full') {
            targetDuration = audioDuration;
        } else {
            targetDuration = Math.min(duration, audioDuration);
        }

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = 1080;  // Instagram/FB optimal
        canvas.height = 1080; // Square format
        const ctx = canvas.getContext('2d');

        // Load cover image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = coverImageData;
        });

        // Draw image to canvas
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Create audio element
        const audio = new Audio();
        audio.src = URL.createObjectURL(state.file);
        await new Promise(resolve => {
            audio.oncanplaythrough = resolve;
            audio.load();
        });

        // Get audio stream
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaElementSource(audio);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        source.connect(audioCtx.destination); // Also connect to speakers for monitoring

        // Create video stream from canvas
        const canvasStream = canvas.captureStream(30); // 30 FPS
        
        // Combine video and audio streams
        const combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...dest.stream.getAudioTracks()
        ]);

        // Set up MediaRecorder
        const chunks = [];
        const recorder = new MediaRecorder(combinedStream, {
            mimeType: 'video/webm;codecs=vp9,opus',
            videoBitsPerSecond: 5000000 // 5 Mbps for good quality
        });

        recorder.ondataavailable = e => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            
            // Download
            const a = document.createElement('a');
            a.href = url;
            const title = $('songTitle')?.value || 'song';
            a.download = `${title}_${type}.webm`;
            a.click();
            
            URL.revokeObjectURL(url);
            URL.revokeObjectURL(audio.src);
            
            // Reset UI
            updateVideoButtons();
            progress?.classList.add('hidden');
            
            toast(`${type === 'reels' ? 'Reels' : 'Feed'} video klar! 🎬`);
        };

        // Start recording
        recorder.start();
        audio.currentTime = 0;
        audio.play();

        // Update progress
        const updateProgress = () => {
            if (audio.currentTime < targetDuration && recorder.state === 'recording') {
                const percent = Math.round((audio.currentTime / targetDuration) * 100);
                if (progressBar) progressBar.style.width = `${percent}%`;
                if (progressText) progressText.textContent = `${percent}%`;
                requestAnimationFrame(updateProgress);
            }
        };
        updateProgress();

        // Stop after target duration
        setTimeout(() => {
            audio.pause();
            recorder.stop();
            audioCtx.close();
        }, targetDuration * 1000);

    } catch (err) {
        console.error('Video creation error:', err);
        toast('Fejl ved oprettelse af video', 'error');
        updateVideoButtons();
        progress?.classList.add('hidden');
    }
}
