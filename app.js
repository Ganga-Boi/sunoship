/* SunoShip v4.2 */
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
    const prog = $('progress');
    const bar = $('bar');
    
    btn.disabled = true;
    btn.textContent = '⏳ Arbejder...';
    prog.classList.remove('hidden');

    // Get duration
    const durVal = document.querySelector('input[name="dur"]:checked').value;
    const targetDur = durVal === 'full' ? audioDuration : Math.min(+durVal, audioDuration);

    try {
        // Canvas setup
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');

        // Load image
        const img = new Image();
        await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = rej;
            img.src = coverData;
        });
        ctx.drawImage(img, 0, 0, 1080, 1080);

        // Audio setup
        const audioEl = new Audio(URL.createObjectURL(audioFile));
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaElementSource(audioEl);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);

        // Combine streams
        const canvasStream = canvas.captureStream(30);
        const combined = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...dest.stream.getAudioTracks()
        ]);

        // Try MP4 first, fallback to WebM
        let mimeType = 'video/mp4';
        let fileExt = 'mp4';
        
        if (!MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/webm';
            fileExt = 'webm';
        }

        // Record
        const chunks = [];
        const rec = new MediaRecorder(combined, {
            mimeType: mimeType,
            videoBitsPerSecond: 4000000
        });
        
        rec.ondataavailable = e => chunks.push(e.data);
        
        rec.onstop = () => {
            const blob = new Blob(chunks, {type: mimeType});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `facebook_video.${fileExt}`;
            a.click();
            
            btn.disabled = false;
            btn.textContent = '🎬 Lav Video';
            prog.classList.add('hidden');
            bar.style.width = '0%';
            
            if (fileExt === 'webm') {
                toast('Video klar! Konverter til MP4 på cloudconvert.com for FB', 'warning');
            } else {
                toast('Video klar! 🎬');
            }
        };

        // Start
        rec.start();
        audioEl.play();

        // Progress
        const update = () => {
            if (audioEl.currentTime < targetDur) {
                bar.style.width = (audioEl.currentTime / targetDur * 100) + '%';
                requestAnimationFrame(update);
            }
        };
        update();

        // Stop after duration
        setTimeout(() => {
            audioEl.pause();
            rec.stop();
            audioCtx.close();
        }, targetDur * 1000);

    } catch (err) {
        console.error(err);
        toast('Fejl - prøv igen', 'error');
        btn.disabled = false;
        btn.textContent = '🎬 Lav Video';
        prog.classList.add('hidden');
    }
}

/* ===== TOAST ===== */
function toast(msg, type = 'success') {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast ' + type;
    setTimeout(() => t.classList.add('hidden'), 3000);
}
