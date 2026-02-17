import { put, head, del } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

function blobKey(userId: string): string {
  return `backups/${userId}.json.gz`;
}

export async function PUT(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId") || "default";
  const body = await req.blob();

  if (!body || body.size === 0) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }

  // 4.5 MB limit (Vercel Blob free tier is generous, but keep payloads reasonable)
  if (body.size > 4.5 * 1024 * 1024) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  try {
    // Delete old blob first (put with same name creates a new one each time)
    const key = blobKey(userId);
    try {
      const existing = await head(key);
      if (existing) await del(existing.url);
    } catch {
      // No existing blob, that's fine
    }

    const blob = await put(key, body, {
      access: "public",
      contentType: "application/gzip",
      addRandomSuffix: false,
    });

    return NextResponse.json({ ok: true, url: blob.url, size: body.size });
  } catch (err) {
    console.error("[sync] PUT failed:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId") || "default";
  const key = blobKey(userId);

  try {
    const meta = await head(key);
    if (!meta) {
      return NextResponse.json({ error: "No backup found" }, { status: 404 });
    }

    // Fetch the blob content and stream it back
    const response = await fetch(meta.url);
    if (!response.ok) {
      return NextResponse.json({ error: "Blob fetch failed" }, { status: 502 });
    }

    const data = await response.blob();
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    // head() throws if blob doesn't exist
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not found") || message.includes("404")) {
      return NextResponse.json({ error: "No backup found" }, { status: 404 });
    }
    console.error("[sync] GET failed:", err);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
