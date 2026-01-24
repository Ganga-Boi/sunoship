const audioInput = document.getElementById('audioInput');
const enhanceBtn = document.getElementById('enhanceBtn');

const progressBox = document.getElementById('enhanceProgress');
const progressText = document.getElementById('progressText');
const progressPercent = document.getElementById('progressPercent');
const progressBar = document.getElementById('enhanceProgressBar');

const audioPlayer = document.getElementById('audioPlayer');

let originalBuffer = null;

audioInput.addEventListener('change', async () => {
  const file = audioInput.files[0];
  if (!file) return;

  const ctx = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  originalBuffer = await ctx.decodeAudioData(arrayBuffer);

  audioPlayer.src = URL.createObjectURL(file);
});

enhanceBtn.addEventListener('click', async () => {
  if (!originalBuffer) {
    alert('Upload en lydfil først');
    return;
  }

  progressBox.classList.remove('hidden');
  updateProgress('Starter enhancement…', 0);

  const sampleRate = originalBuffer.sampleRate;
  const offlineCtx = new OfflineAudioContext(
    originalBuffer.numberOfChannels,
    originalBuffer.length,
    sampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = originalBuffer;

  const gain = offlineCtx.createGain();
  gain.gain.value = 2.5; // ≈ +8 dB (simpel loudness-løft)

  source.connect(gain);
  gain.connect(offlineCtx.destination);
  source.start();

  updateProgress('Renderer audio…', 40);

  const renderedBuffer = await offlineCtx.startRendering();

  updateProgress('Eksporterer…', 80);

  const wavBlob = bufferToWav(renderedBuffer);
  audioPlayer.src = URL.createObjectURL(wavBlob);

  updateProgress('Færdig', 100);
});

function updateProgress(text, percent) {
  progressText.textContent = text;
  progressPercent.textContent = percent + '%';
  progressBar.style.width = percent + '%';
}

/* === WAV EXPORT === */
function bufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length * numChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);

  let offset = 0;
  const writeString = s => { for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i)); };

  writeString('RIFF');
  view.setUint32(offset, 36 + buffer.length * 2, true); offset += 4;
  writeString('WAVEfmt ');
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, buffer.sampleRate, true); offset += 4;
  view.setUint32(offset, buffer.sampleRate * numChannels * 2, true); offset += 4;
  view.setUint16(offset, numChannels * 2, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2;
  writeString('data');
  view.setUint32(offset, buffer.length * 2, true); offset += 4;

  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = buffer.getChannelData(ch)[i];
      view.setInt16(offset, sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
