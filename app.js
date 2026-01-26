/* SunoShip v4.4 */
'use strict';

const $ = id => document.getElementById(id);

// State
let coverData = null;
let audioFile = null;
let audioDuration = 0;

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
    statusText.textContent = 'Opretter video...';

    const durVal = document.querySelector('input[name="dur"]:checked').value;
    const targetDur = durVal === 'full' ? audioDuration : Math.min(+durVal, audioDuration);

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
        
        // Add audio
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
        
        rec.onstop = async () => {
            const webmBlob = new Blob(chunks, { type: 'video/webm' });
            
            // Convert to MP4 using ffmpeg.wasm
            statusText.textContent = 'Konverterer til MP4...';
            
            try {
                const { FFmpeg } = FFmpegWASM;
                const { fetchFile } = FFmpegUtil;
                
                const ffmpeg = new FFmpeg();
                
                ffmpeg.on('progress', ({ progress }) => {
                    statusText.textContent = `Konverterer... ${Math.round(progress * 100)}%`;
                });
                
                statusText.textContent = 'Loader konverter...';
                await ffmpeg.load({
                    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js'
                });
                
                statusText.textContent = 'Konverterer til MP4...';
                
                const webmData = new Uint8Array(await webmBlob.arrayBuffer());
                await ffmpeg.writeFile('input.webm', webmData);
                
                await ffmpeg.exec([
                    '-i', 'input.webm',
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    '-movflags', '+faststart',
                    'output.mp4'
                ]);
                
                const mp4Data = await ffmpeg.readFile('output.mp4');
                const mp4Blob = new Blob([mp4Data], { type: 'video/mp4' });
                
                const url = URL.createObjectURL(mp4Blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'facebook_video.mp4';
                a.click();
                URL.revokeObjectURL(url);
                
                toast('MP4 klar til Facebook! 🎬');
                
            } catch (convErr) {
                console.error('FFmpeg fejl:', convErr);
                
                // Fallback - download WebM
                const url = URL.createObjectURL(webmBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'video.webm';
                a.click();
                URL.revokeObjectURL(url);
                
                window.open('https://cloudconvert.com/webm-to-mp4', '_blank');
                toast('Konvertering fejlede - brug cloudconvert', 'error');
            }
            
            statusBox.classList.add('hidden');
            btn.disabled = false;
        };
        
        rec.onerror = () => {
            throw new Error('Recording failed');
        };
        
        // Progress updates
        const updateStatus = () => {
            if (audioEl.currentTime < targetDur && rec.state === 'recording') {
                const pct = Math.round((audioEl.currentTime / targetDur) * 100);
                statusText.textContent = `Optager... ${pct}%`;
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
