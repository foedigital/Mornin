import { NextResponse } from "next/server";

const SAMPLE_RATE = 22050;
const SECONDS = 60;

function buildWav(): Buffer {
  const numSamples = SAMPLE_RATE * SECONDS;
  const dataBytes = numSamples * 2; // 16-bit mono
  const buf = Buffer.alloc(44 + dataBytes);

  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);            // PCM
  buf.writeUInt16LE(1, 22);            // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);

  let last = 0;
  for (let i = 0; i < numSamples; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    const s = Math.max(-1, Math.min(1, last * 3.5));
    buf.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), 44 + i * 2);
  }

  return buf;
}

// Generate once per server instance; reused on every request
let wav: Buffer | null = null;

export async function GET() {
  if (!wav) wav = buildWav();

  return new NextResponse(new Uint8Array(wav), {
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": String(wav.length),
      "Cache-Control": "public, max-age=86400",
      "Accept-Ranges": "bytes",
    },
  });
}
