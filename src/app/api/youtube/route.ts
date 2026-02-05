import { NextResponse } from "next/server";

/**
 * Server-side proxy for YouTube API calls.
 * Uses the PlaylistItems API with the channel's uploads playlist
 * (more reliable than Search API for getting the latest video).
 * The API key stays on the server - never exposed to the browser.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");

  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 503 });
  }

  try {
    // Every channel's uploads playlist ID = channel ID with "UC" replaced by "UU"
    const uploadsPlaylistId = channelId.replace(/^UC/, "UU");

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?` +
        `part=snippet&playlistId=${uploadsPlaylistId}` +
        `&maxResults=1&key=${apiKey}`,
      { next: { revalidate: 3600 } } // cache for 1 hour
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "YouTube API error", details: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch from YouTube" },
      { status: 500 }
    );
  }
}
