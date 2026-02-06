import { NextRequest, NextResponse } from "next/server";
import { EdgeTTS } from "@andresaya/edge-tts";

export const maxDuration = 300; // 5 minutes for full book generation

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
const MAX_CHUNK_CHARS = 12000;
const MAX_TOTAL_CHARS = 100000;

function normalizeForTTS(text: string): string {
  let t = text;
  t = t.replace(/\[Illustration[^\]]*\]/gi, "");
  t = t.replace(/\[Footnote[^\]]*\]/gi, "");
  t = t.replace(/\[Transcriber'?s? [Nn]ote[^\]]*\]/gi, "");
  t = t.replace(/\[Editor'?s? [Nn]ote[^\]]*\]/gi, "");
  t = t.replace(/\[pg \d+\]/gi, "");
  t = t.replace(/\*\*\*/g, "");
  t = t.replace(/_{3,}/g, "");
  t = t.replace(/-{3,}/g, " — ");
  t = t.replace(/\r\n/g, "\n");
  t = t.replace(/\n{2,}/g, " \n\n ");
  t = t.replace(/\n/g, " ");
  t = t.replace(/ \n\n /g, ". ");
  t = t.replace(/\.\s*\.\s*/g, ". ");
  t = t.replace(/[.!?]\s*\.\s+/g, (m) => m[0] + " ");
  t = t.replace(/\t/g, " ");
  t = t.replace(/ {2,}/g, " ");
  t = t.replace(/—/g, " — ");
  t = t.replace(/\s+—\s+/g, " — ");
  t = t.replace(/\.{3,}/g, "...");
  t = t.replace(/\[\d+\]/g, "");
  t = t.replace(/\{[^}]*\}/g, "");
  return t.trim();
}

function splitTextForTTS(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHUNK_CHARS) {
      chunks.push(remaining);
      break;
    }
    const window = remaining.slice(0, MAX_CHUNK_CHARS);
    let splitIdx = -1;
    for (let i = window.length - 1; i > MAX_CHUNK_CHARS * 0.3; i--) {
      if (
        (window[i] === "." || window[i] === "!" || window[i] === "?") &&
        (i + 1 >= window.length || /\s/.test(window[i + 1]))
      ) {
        splitIdx = i + 1;
        break;
      }
    }
    if (splitIdx === -1) splitIdx = window.lastIndexOf(" ");
    if (splitIdx <= 0) splitIdx = MAX_CHUNK_CHARS;
    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }
  return chunks.filter((c) => c.length > 0);
}

async function synthesizeChunk(text: string, voice: string): Promise<Buffer> {
  const tts = new EdgeTTS();
  await tts.synthesize(text, voice, { outputFormat: AUDIO_FORMAT });
  const buf = tts.toBuffer();
  if (!buf || buf.byteLength === 0) throw new Error("No audio generated");
  return buf;
}

/** Synthesize a full chapter text into one MP3 buffer */
async function synthesizeChapter(text: string, voice: string): Promise<Buffer> {
  const normalized = normalizeForTTS(text.slice(0, MAX_TOTAL_CHARS));
  const chunks = splitTextForTTS(normalized);

  // Synthesize all chunks for this chapter in parallel
  const buffers = await Promise.all(
    chunks.map((chunk) => synthesizeChunk(chunk, voice))
  );

  return Buffer.concat(buffers);
}

/**
 * Batch TTS endpoint — synthesizes multiple chapters in one request.
 * Body: { texts: string[], voice?: string, skip?: number[] }
 * skip: chapter indices to skip (already cached on client)
 * Returns: JSON array of base64-encoded MP3s (null for skipped/failed)
 */
export async function POST(req: NextRequest) {
  try {
    const { texts, voice = "en-US-AndrewMultilingualNeural", skip = [] } = await req.json();

    if (!Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: "texts array is required" }, { status: 400 });
    }
    if (texts.length > 50) {
      return NextResponse.json({ error: "Max 50 chapters per batch" }, { status: 400 });
    }
    if (!VALID_VOICES.includes(voice)) {
      return NextResponse.json({ error: "Invalid voice" }, { status: 400 });
    }

    const skipSet = new Set(skip as number[]);

    // Process up to 5 chapters concurrently
    const CHAPTER_CONCURRENCY = 5;
    const results: (string | null)[] = new Array(texts.length).fill(null);

    for (let batch = 0; batch < texts.length; batch += CHAPTER_CONCURRENCY) {
      const batchIndices: number[] = [];
      for (let j = batch; j < Math.min(batch + CHAPTER_CONCURRENCY, texts.length); j++) {
        if (!skipSet.has(j) && texts[j] && typeof texts[j] === "string") {
          batchIndices.push(j);
        }
      }

      const batchResults = await Promise.allSettled(
        batchIndices.map(async (i) => {
          const buf = await synthesizeChapter(texts[i], voice);
          return { index: i, data: buf.toString("base64") };
        })
      );

      for (const r of batchResults) {
        if (r.status === "fulfilled") {
          results[r.value.index] = r.value.data;
        }
      }
    }

    return NextResponse.json({ chapters: results });
  } catch (err) {
    console.error("Batch TTS error:", err);
    return NextResponse.json({ error: "Batch TTS failed" }, { status: 500 });
  }
}
