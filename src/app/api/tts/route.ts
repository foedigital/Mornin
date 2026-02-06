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

/** Clean text for natural TTS reading — removes artifacts that cause pauses/choppiness */
function normalizeForTTS(text: string): string {
  let t = text;

  // Remove Gutenberg/editorial artifacts
  t = t.replace(/\[Illustration[^\]]*\]/gi, "");
  t = t.replace(/\[Footnote[^\]]*\]/gi, "");
  t = t.replace(/\[Transcriber'?s? [Nn]ote[^\]]*\]/gi, "");
  t = t.replace(/\[Editor'?s? [Nn]ote[^\]]*\]/gi, "");
  t = t.replace(/\[pg \d+\]/gi, "");
  t = t.replace(/\*\*\*/g, "");
  t = t.replace(/_{3,}/g, "");
  t = t.replace(/-{3,}/g, " — ");

  // Normalize line breaks: replace single newlines with spaces (prose flow)
  // but preserve paragraph breaks (double newline → single period-space pause)
  t = t.replace(/\r\n/g, "\n");
  t = t.replace(/\n{2,}/g, " \n\n ");  // mark paragraph breaks
  t = t.replace(/\n/g, " ");            // single newlines → space
  t = t.replace(/ \n\n /g, ". ");       // paragraph breaks → gentle sentence pause
  // Clean up double periods from paragraph break conversion
  t = t.replace(/\.\s*\.\s*/g, ". ");
  t = t.replace(/[.!?]\s*\.\s+/g, (m) => m.replace(/\.\s+$/, " "));

  // Normalize whitespace
  t = t.replace(/\t/g, " ");
  t = t.replace(/ {2,}/g, " ");

  // Fix common OCR/encoding artifacts
  t = t.replace(/—/g, " — ");
  t = t.replace(/\s+—\s+/g, " — ");
  t = t.replace(/\.{3,}/g, "...");

  // Remove stray brackets/formatting markers
  t = t.replace(/\[\d+\]/g, "");        // footnote numbers like [1]
  t = t.replace(/\{[^}]*\}/g, "");      // stray curly brace content

  return t.trim();
}

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

    // Safety cap, then normalize for clean TTS reading
    const normalizedText = normalizeForTTS(text.slice(0, MAX_TOTAL_CHARS));

    // Split long text into chunks and synthesize in parallel (up to 4 at once)
    const textChunks = splitTextForTTS(normalizedText);
    const CONCURRENCY = 4;
    const audioBuffers: Buffer[] = new Array(textChunks.length);

    for (let batch = 0; batch < textChunks.length; batch += CONCURRENCY) {
      const slice = textChunks.slice(batch, batch + CONCURRENCY);
      const results = await Promise.all(
        slice.map((chunk) => synthesizeChunk(chunk, voice))
      );
      for (let j = 0; j < results.length; j++) {
        audioBuffers[batch + j] = results[j];
      }
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
