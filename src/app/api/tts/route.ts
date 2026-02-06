import { NextRequest, NextResponse } from "next/server";
import { Communicate } from "edge-tts-universal";

export const maxDuration = 30;

const VALID_VOICES = [
  "en-US-GuyNeural",
  "en-US-ChristopherNeural",
  "en-US-JennyNeural",
  "en-US-AriaNeural",
  "en-GB-RyanNeural",
];

export async function POST(req: NextRequest) {
  try {
    const { text, voice = "en-US-GuyNeural" } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (!VALID_VOICES.includes(voice)) {
      return NextResponse.json({ error: "Invalid voice" }, { status: 400 });
    }

    // Limit text length to prevent abuse (~5000 chars ≈ 750 words)
    const trimmedText = text.slice(0, 6000);

    const communicate = new Communicate(trimmedText, { voice });

    const audioChunks: Buffer[] = [];
    for await (const chunk of communicate.stream()) {
      if (chunk.type === "audio" && chunk.data) {
        audioChunks.push(chunk.data);
      }
    }

    if (audioChunks.length === 0) {
      return NextResponse.json(
        { error: "No audio generated" },
        { status: 500 }
      );
    }

    const audioBuffer = Buffer.concat(audioChunks);

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
