import { NextResponse } from "next/server";

/** Parse ISO 8601 duration (PT1H2M3S) to seconds */
function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || "0") * 3600) +
         (parseInt(m[2] || "0") * 60) +
         (parseInt(m[3] || "0"));
}

/**
 * Server-side proxy for YouTube API calls.
 * Fetches recent uploads then filters out Shorts/clips (< 5 min)
 * to return only the latest full-length video.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");
  const playlistId = searchParams.get("playlistId");

  if (!channelId && !playlistId) {
    return NextResponse.json({ error: "channelId or playlistId required" }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 503 });
  }

  try {
    // Use explicit playlistId if provided, otherwise derive uploads playlist from channel ID
    const uploadsPlaylistId = playlistId || channelId!.replace(/^UC/, "UU");

    // Step 1: Fetch recent uploads (grab 10 to have room after filtering Shorts)
    const playlistRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?` +
        `part=snippet&playlistId=${uploadsPlaylistId}` +
        `&maxResults=10&key=${apiKey}`,
      { next: { revalidate: 3600 } }
    );

    if (!playlistRes.ok) {
      const text = await playlistRes.text();
      return NextResponse.json(
        { error: "YouTube API error", details: text },
        { status: playlistRes.status }
      );
    }

    const playlistData = await playlistRes.json();
    const items = playlistData.items;
    if (!items?.length) {
      return NextResponse.json({ items: [] });
    }

    // Step 2: Get durations for these videos
    const videoIds = items.map((item: { snippet: { resourceId: { videoId: string } } }) =>
      item.snippet.resourceId.videoId
    ).join(",");

    const videosRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?` +
        `part=contentDetails&id=${videoIds}&key=${apiKey}`,
      { next: { revalidate: 3600 } }
    );

    if (!videosRes.ok) {
      // Fall back to first item if duration check fails
      return NextResponse.json({ items: [items[0]] });
    }

    const videosData = await videosRes.json();
    const durations = new Map<string, number>();
    for (const v of videosData.items || []) {
      durations.set(v.id, parseDuration(v.contentDetails.duration));
    }

    // Step 3: Find the most recent video that's >= 5 minutes (skip Shorts/clips)
    const fullVideo = items.find((item: { snippet: { resourceId: { videoId: string } } }) => {
      const dur = durations.get(item.snippet.resourceId.videoId) || 0;
      return dur >= 300;
    });

    return NextResponse.json({ items: fullVideo ? [fullVideo] : [items[0]] });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch from YouTube" },
      { status: 500 }
    );
  }
}
