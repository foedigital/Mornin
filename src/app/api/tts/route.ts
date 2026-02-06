import { NextRequest, NextResponse } from "next/server";
import { EdgeTTS } from "@andresaya/edge-tts";

export const maxDuration = 60;

const VALID_VOICES = [
  "en-US-AndrewMultilingualNeural",
  "en-US-AvaMultilingualNeural",
  "en-US-BrianMultilingualNeural",
  "en-US-ChristopherNeural",
  "en-US-JennyNeural",
  "en-US-AriaNeural",
  "en-US-GuyNeural",
  "en-GB-SoniaNeural",
  "en-GB-RyanNeural",
];

const AUDIO_FORMAT = "audio-24khz-96kbitrate-mono-mp3";

const MAX_CHUNK_CHARS = 5000;
const MAX_TOTAL_CHARS = 50000; // ~7500 words safety cap

/** Split text into chunks at sentence boundaries, each under MAX_CHUNK_CHARS */
function splitTextForTTS(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHUNK_CHARS) {
      chunks.push(remaining);
      break;
    }

    // Find the last sentence boundary within the limit
    const window = remaining.slice(0, MAX_CHUNK_CHARS);
    let splitIdx = -1;

    // Try sentence-ending punctuation followed by space
    for (let i = window.length - 1; i > MAX_CHUNK_CHARS * 0.3; i--) {
      if (
        (window[i] === "." || window[i] === "!" || window[i] === "?") &&
        (i + 1 >= window.length || /\s/.test(window[i + 1]))
      ) {
        splitIdx = i + 1;
        break;
      }
    }

    // Fallback: split at last space
    if (splitIdx === -1) {
      splitIdx = window.lastIndexOf(" ");
    }

    // Last resort: hard cut
    if (splitIdx <= 0) {
      splitIdx = MAX_CHUNK_CHARS;
    }

    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }

  return chunks.filter((c) => c.length > 0);
}

/** Synthesize a single text chunk to MP3 audio buffer at high quality */
async function synthesizeChunk(text: string, voice: string): Promise<Buffer> {
  const tts = new EdgeTTS();
  await tts.synthesize(text, voice, { outputFormat: AUDIO_FORMAT });
  const buf = tts.toBuffer();
  if (!buf || buf.byteLength === 0) {
    throw new Error("No audio generated for chunk");
  }
  return buf;
}

export async function POST(req: NextRequest) {
  try {
    const { text, voice = "en-US-AndrewMultilingualNeural" } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (!VALID_VOICES.includes(voice)) {
      return NextResponse.json({ error: "Invalid voice" }, { status: 400 });
    }

    // Safety cap to prevent abuse
    const trimmedText = text.slice(0, MAX_TOTAL_CHARS);

    // Split long text into chunks and synthesize each
    const textChunks = splitTextForTTS(trimmedText);
    const audioBuffers: Buffer[] = [];

    for (const chunk of textChunks) {
      const buf = await synthesizeChunk(chunk, voice);
      audioBuffers.push(buf);
    }

    if (audioBuffers.length === 0) {
      return NextResponse.json(
        { error: "No audio generated" },
        { status: 500 }
      );
    }

    const audioBuffer = Buffer.concat(audioBuffers);

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("TTS error:", err);
    return NextResponse.json(
      { error: "TTS synthesis failed" },
      { status: 500 }
    );
  }
}
