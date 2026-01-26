/* SunoShip v4.8 */
'use strict';

const $ = id => document.getElementById(id);

// State
let coverData = null;
let audioFile = null;
let audioDuration = 0;
let Mp4Muxer = null;

// Load mp4-muxer dynamically
async function loadMuxer() {
    if (Mp4Muxer) return Mp4Muxer;
    Mp4Muxer = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/+esm');
    return Mp4Muxer;
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    // Gateway buttons
    $('pathAmuse').onclick = () => showPath('amuse');
    $('pathSocial').onclick = () => showPath('social');
    $('backFromAmuse').onclick = () => showPath('gateway');
    $('backFromSocial').onclick = () => showPath('gateway');
    
    // Prompt generator
    $('generatePrompt').onclick = generatePrompt;
    $('copyPrompt').onclick = copyPrompt;
    
    // Social media video
    initSocialUploads();
    $('makeVideo').onclick = makeVideo;
});

function showPath(path) {
    $('gateway').classList.toggle('hidden', path !== 'gateway');
    $('amusePath').classList.toggle('hidden', path !== 'amuse');
    $('socialPath').classList.toggle('hidden', path !== 'social');
}

/* ===== PROMPT GENERATOR ===== */
function generatePrompt() {
    const title = $('promptTitle').value || 'Untitled';
    const genre = $('promptGenre').value || 'music';
    const style = $('promptStyle').value;
    const extra = $('promptExtra').value;

    const styles = {
        retro: 'vintage 70s/80s aesthetic, warm colors, retro typography',
        abstract: 'abstract geometric shapes, bold colors, modern',
        neon: 'neon lights, synthwave colors (pink, blue, purple)',
        minimal: 'minimalist, clean lines, elegant negative space',
        tropical: 'tropical paradise, palm trees, sunset colors',
        psychedelic: 'psychedelic patterns, vibrant swirling colors'
    };

    const prompt = `Square album cover for a ${genre} track titled "${title}".
Style: ${styles[style]}
${extra ? 'Details: ' + extra : ''}
Requirements:
- Title "${title}" in stylish typography
- NO logos or watermarks
- 3000x3000 px, professional quality`;

    $('generatedPrompt').value = prompt;
    $('promptResult').classList.remove('hidden');
    toast('Prompt klar!');
}

function copyPrompt() {
    navigator.clipboard.writeText($('generatedPrompt').value);
    toast('Kopieret! 📋');
}

/* ===== SOCIAL VIDEO ===== */
function initSocialUploads() {
    // Cover upload
    $('coverDrop').onclick = () => $('coverInput').click();
    $('coverInput').onchange = e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = ev => {
                coverData = ev.target.result;
                $('coverDrop').innerHTML = '<span>✅</span><span>Cover klar</span>';
                $('coverDrop').classList.add('done');
                checkReady();
            };
            reader.readAsDataURL(file);
        }
    };
    
    // Audio upload
    $('audioDrop').onclick = () => $('audioInput').click();
    $('audioInput').onchange = e => {
        const file = e.target.files[0];
        if (file) {
            audioFile = file;
            const audio = new Audio(URL.createObjectURL(file));
            audio.onloadedmetadata = () => {
                audioDuration = audio.duration;
                $('audioDrop').innerHTML = '<span>✅</span><span>Musik klar</span>';
                $('audioDrop').classList.add('done');
                checkReady();
            };
        }
    };
}

function checkReady() {
    $('makeVideo').disabled = !(coverData && audioFile);
}

async function makeVideo() {
    if (!coverData || !audioFile) return;
    
    const btn = $('makeVideo');
    const statusBox = $('statusBox');
    const statusText = $('statusText');
    
    btn.disabled = true;
    statusBox.classList.remove('hidden');
    statusText.textContent = 'Checker browser...';

    const durVal = document.querySelector('input[name="dur"]:checked').value;
    const targetDur = durVal === 'full' ? audioDuration : Math.min(+durVal, audioDuration);

    // Check for WebCodecs support
    if (typeof VideoEncoder === 'undefined') {
        statusText.textContent = 'Browser understøtter ikke MP4...';
        await fallbackWebM(targetDur, btn, statusBox, statusText);
        return;
    }

    try {
        statusText.textContent = 'Loader encoder...';
        const muxer = await loadMuxer();

        statusText.textContent = 'Forbereder billede...';
        
        // Setup canvas
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        
        const img = new Image();
        await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = rej;
            img.src = coverData;
        });
        ctx.drawImage(img, 0, 0, 1080, 1080);

        // Decode audio first
        statusText.textContent = 'Decoder lyd...';
        const audioCtx = new AudioContext({ sampleRate: 48000 });
        const arrayBuffer = await audioFile.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        
        const numSamples = Math.min(
            Math.floor(targetDur * 48000),
            audioBuffer.length
        );

        statusText.textContent = 'Opretter MP4...';

        const fps = 1;
        const totalFrames = Math.ceil(targetDur * fps);
        
        // Create muxer with both video and audio
        const mp4 = new muxer.Muxer({
            target: new muxer.ArrayBufferTarget(),
            video: {
                codec: 'avc',
                width: 1080,
                height: 1080
            },
            audio: {
                codec: 'aac',
                numberOfChannels: 2,
                sampleRate: 48000
            },
            fastStart: 'in-memory'
        });

        // Video encoder
        const videoEncoder = new VideoEncoder({
            output: (chunk, meta) => mp4.addVideoChunk(chunk, meta),
            error: e => { throw new Error('Video encoding fejl: ' + e.message); }
        });

        await videoEncoder.configure({
            codec: 'avc1.42001f',
            width: 1080,
            height: 1080,
            bitrate: 1_000_000,
            framerate: fps
        });

        // Encode video frames
        for (let i = 0; i < totalFrames; i++) {
            const frame = new VideoFrame(canvas, {
                timestamp: (i / fps) * 1_000_000
            });
            
            videoEncoder.encode(frame, { keyFrame: true });
            frame.close();
            
            statusText.textContent = `Video: ${Math.round((i+1)/totalFrames*100)}%`;
        }

        await videoEncoder.flush();
        videoEncoder.close();

        // Audio encoder
        statusText.textContent = 'Encoder lyd...';
        
        const audioEncoder = new AudioEncoder({
            output: (chunk, meta) => mp4.addAudioChunk(chunk, meta),
            error: e => { throw new Error('Audio encoding fejl: ' + e.message); }
        });

        // Check if AAC is supported
        const aacSupport = await AudioEncoder.isConfigSupported({
            codec: 'mp4a.40.2',
            numberOfChannels: 2,
            sampleRate: 48000,
            bitrate: 128000
        });

        if (!aacSupport.supported) {
            throw new Error('AAC audio ikke understøttet');
        }

        await audioEncoder.configure({
            codec: 'mp4a.40.2',
            numberOfChannels: 2,
            sampleRate: 48000,
            bitrate: 128000
        });

        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.numberOfChannels > 1 
            ? audioBuffer.getChannelData(1) 
            : leftChannel;

        const samplesPerChunk = 1024;
        for (let i = 0; i < numSamples; i += samplesPerChunk) {
            const chunkSize = Math.min(samplesPerChunk, numSamples - i);
            
            const leftData = new Float32Array(chunkSize);
            const rightData = new Float32Array(chunkSize);
            
            for (let j = 0; j < chunkSize; j++) {
                leftData[j] = leftChannel[i + j] || 0;
                rightData[j] = rightChannel[i + j] || 0;
            }
            
            const audioData = new AudioData({
                format: 'f32-planar',
                sampleRate: 48000,
                numberOfFrames: chunkSize,
                numberOfChannels: 2,
                timestamp: (i / 48000) * 1_000_000,
                data: new Float32Array([...leftData, ...rightData])
            });
            
            audioEncoder.encode(audioData);
            audioData.close();
            
            if (i % (48000 * 2) === 0) {
                statusText.textContent = `Lyd: ${Math.round(i/numSamples*100)}%`;
            }
        }

        await audioEncoder.flush();
        audioEncoder.close();
        await audioCtx.close();

        // Finalize
        statusText.textContent = 'Gemmer fil...';
        mp4.finalize();

        const mp4Blob = new Blob([mp4.target.buffer], { type: 'video/mp4' });
        
        const url = URL.createObjectURL(mp4Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'facebook_video.mp4';
        a.click();
        URL.revokeObjectURL(url);
        
        statusBox.classList.add('hidden');
        btn.disabled = false;
        toast('MP4 klar til Facebook! 🎬');

    } catch (err) {
        console.error('MP4 fejl:', err);
        statusText.textContent = 'Fejl: ' + err.message;
        
        // Wait a moment to show error, then fallback
        await new Promise(r => setTimeout(r, 1500));
        statusText.textContent = 'Bruger alternativ metode...';
        await fallbackWebM(targetDur, btn, statusBox, statusText);
    }
}

async function fallbackWebM(targetDur, btn, statusBox, statusText) {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        
        const img = new Image();
        await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = rej;
            img.src = coverData;
        });
        ctx.drawImage(img, 0, 0, 1080, 1080);
        
        const stream = canvas.captureStream(30);
        
        const audioEl = new Audio(URL.createObjectURL(audioFile));
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaElementSource(audioEl);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        
        const combined = new MediaStream([
            ...stream.getVideoTracks(),
            ...dest.stream.getAudioTracks()
        ]);
        
        const chunks = [];
        const rec = new MediaRecorder(combined, { 
            mimeType: 'video/webm',
            videoBitsPerSecond: 5000000 
        });
        
        rec.ondataavailable = e => chunks.push(e.data);
        
        rec.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'video_til_facebook.webm';
            a.click();
            URL.revokeObjectURL(url);
            
            setTimeout(() => {
                window.open('https://cloudconvert.com/webm-to-mp4', '_blank');
            }, 500);
            
            statusBox.classList.add('hidden');
            btn.disabled = false;
            toast('WebM klar - konverter i nyt vindue');
        };
        
        const updateStatus = () => {
            if (audioEl.currentTime < targetDur && rec.state === 'recording') {
                statusText.textContent = `Optager... ${Math.round((audioEl.currentTime / targetDur) * 100)}%`;
                requestAnimationFrame(updateStatus);
            }
        };
        
        rec.start();
        audioEl.play();
        updateStatus();
        
        setTimeout(() => {
            audioEl.pause();
            rec.stop();
            audioCtx.close();
        }, targetDur * 1000);

    } catch (err) {
        console.error(err);
        toast('Fejl - prøv igen', 'error');
        statusBox.classList.add('hidden');
        btn.disabled = false;
    }
}

/* ===== TOAST ===== */
function toast(msg, type = 'success') {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast ' + type;
    setTimeout(() => t.classList.add('hidden'), 3000);
}
