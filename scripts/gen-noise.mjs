// Generates public/brown-noise.wav — a 3-minute seamlessly-looping WAV.
// Run with: node scripts/gen-noise.mjs
import { writeFileSync } from "fs";

const SAMPLE_RATE = 22050;
const DURATION = 180;       // 3 minutes
const CROSSFADE = 3;        // 3-second crossfade baked into the loop boundary

const numSamples = SAMPLE_RATE * DURATION;
const xfadeSamples = SAMPLE_RATE * CROSSFADE;

// Generate (DURATION + CROSSFADE) seconds of raw noise so we have extra
// samples to blend at the loop boundary.
const totalRaw = numSamples + xfadeSamples;
const raw = new Float32Array(totalRaw);
let last = 0;
for (let i = 0; i < totalRaw; i++) {
  const white = Math.random() * 2 - 1;
  last = (last + 0.02 * white) / 1.02;
  raw[i] = Math.max(-1, Math.min(1, last * 3.5));
}

// Build WAV buffer of exactly DURATION seconds.
// Last CROSSFADE seconds fade out the raw end while fading in the beginning,
// so when the player loops back to sample 0 the transition is inaudible.
const dataBytes = numSamples * 2;
const buf = Buffer.alloc(44 + dataBytes);

buf.write("RIFF", 0, "ascii");
buf.writeUInt32LE(36 + dataBytes, 4);
buf.write("WAVE", 8, "ascii");
buf.write("fmt ", 12, "ascii");
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);               // PCM
buf.writeUInt16LE(1, 22);               // mono
buf.writeUInt32LE(SAMPLE_RATE, 24);
buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36, "ascii");
buf.writeUInt32LE(dataBytes, 40);

for (let i = 0; i < numSamples; i++) {
  let s = raw[i];
  if (i >= numSamples - xfadeSamples) {
    // t goes 0→1 through the crossfade region
    const t = (i - (numSamples - xfadeSamples)) / xfadeSamples;
    // Fade out the "end" noise, fade in the "beginning" noise
    s = raw[i] * (1 - t) + raw[i - (numSamples - xfadeSamples)] * t;
  }
  s = Math.max(-1, Math.min(1, s));
  buf.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), 44 + i * 2);
}

writeFileSync("public/brown-noise.wav", buf);
console.log(`✓ public/brown-noise.wav — ${(buf.length / 1024 / 1024).toFixed(1)} MB`);
