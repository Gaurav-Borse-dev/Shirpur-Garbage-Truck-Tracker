const fs = require('fs');
const path = require('path');

// 44.1 kHz, 16-bit PCM Mono
const sampleRate = 44100;

function createChimeWav() {
  const notes = [
    { freq: 523.25, start: 0.0, dur: 0.45, vol: 0.35 },   // C5
    { freq: 659.25, start: 0.14, dur: 0.45, vol: 0.38 },  // E5
    { freq: 783.99, start: 0.28, dur: 0.85, vol: 0.42 },  // G5
  ];

  const totalDuration = 1.3;
  const numSamples = Math.floor(sampleRate * totalDuration);
  const buffer = new Float32Array(numSamples);

  for (const note of notes) {
    const startSample = Math.floor(note.start * sampleRate);
    const noteSamples = Math.floor(note.dur * sampleRate);

    for (let i = 0; i < noteSamples; i++) {
      const idx = startSample + i;
      if (idx >= numSamples) break;

      const t = i / sampleRate;
      // Exponential decay envelope
      const decay = Math.exp(-t * (4.5 / note.dur));
      // Attack envelope (10ms)
      const attack = Math.min(1.0, t / 0.012);
      const env = attack * decay * note.vol;

      // Fundamental + 2.02x bell harmonic + 3.01x sparkle overtone
      const s1 = Math.sin(2 * Math.PI * note.freq * t);
      const s2 = 0.35 * Math.sin(2 * Math.PI * note.freq * 2.02 * t);
      const s3 = 0.18 * Math.sin(2 * Math.PI * note.freq * 3.01 * t);

      buffer[idx] += (s1 + s2 + s3) * env;
    }
  }

  // Normalize to prevent clipping
  let maxAmp = 0;
  for (let i = 0; i < numSamples; i++) {
    const abs = Math.abs(buffer[i]);
    if (abs > maxAmp) maxAmp = abs;
  }
  const gain = maxAmp > 0.95 ? 0.95 / maxAmp : 1.0;

  // Build 16-bit PCM WAV
  const byteLength = numSamples * 2;
  const wavHeader = Buffer.alloc(44);

  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + byteLength, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
  wavHeader.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  wavHeader.writeUInt16LE(1, 22);  // NumChannels (1 = Mono)
  wavHeader.writeUInt32LE(sampleRate, 24); // SampleRate
  wavHeader.writeUInt32LE(sampleRate * 2, 28); // ByteRate
  wavHeader.writeUInt16LE(2, 32);  // BlockAlign (2 bytes)
  wavHeader.writeUInt16LE(16, 34); // BitsPerSample
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(byteLength, 40);

  const dataBuffer = Buffer.alloc(byteLength);
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.max(-1, Math.min(1, buffer[i] * gain));
    const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    dataBuffer.writeInt16LE(Math.floor(int16), i * 2);
  }

  return Buffer.concat([wavHeader, dataBuffer]);
}

const wavBytes = createChimeWav();

// Ensure targets exist
const publicDir = path.resolve(__dirname, '../frontend/public');
const rootPublicDir = path.resolve(__dirname, '../public');
const rawDir = path.resolve(__dirname, '../android/app/src/main/res/raw');

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
if (!fs.existsSync(rootPublicDir)) fs.mkdirSync(rootPublicDir, { recursive: true });
if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir, { recursive: true });

fs.writeFileSync(path.join(publicDir, 'truck_bell.wav'), wavBytes);
fs.writeFileSync(path.join(rootPublicDir, 'truck_bell.wav'), wavBytes);
fs.writeFileSync(path.join(rawDir, 'truck_bell.wav'), wavBytes);

console.log(`Generated truck_bell.wav (${wavBytes.length} bytes) to public and android raw directories.`);
