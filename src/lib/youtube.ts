/**
 * YouTube Integration
 *
 * The API key is stored server-side only (never in the browser).
 * Client calls /api/youtube which proxies to YouTube's API.
 *
 * Setup: API key is configured via environment variable YOUTUBE_API_KEY
 * on Vercel and in .env.local for local dev.
 */

import channelsData from "../../data/channels.json";

export interface YouTubeVideo {
  videoId: string;
  title: string;
  channelName: string;
  category: string;
  thumbnailUrl: string;
  publishedAt: string;
  youtubeUrl: string;
}

interface Channel {
  id?: string;
  name: string;
  category: string;
  playlistId?: string;
}

async function fetchVideoForChannel(
  channel: Channel
): Promise<YouTubeVideo | null> {
  try {
    const query = channel.playlistId
      ? `playlistId=${channel.playlistId}`
      : `channelId=${channel.id}`;
    const res = await fetch(`/api/youtube?${query}`);
    if (!res.ok) return null;

    const data = await res.json();
    const item = data.items?.[0];
    if (!item) return null;

    // PlaylistItems API nests the video ID under snippet.resourceId
    const videoId = item.snippet.resourceId.videoId;

    return {
      videoId,
      title: item.snippet.title,
      channelName: channel.name,
      category: channel.category,
      thumbnailUrl:
        item.snippet.thumbnails.high?.url ||
        item.snippet.thumbnails.medium?.url ||
        item.snippet.thumbnails.default?.url,
      publishedAt: item.snippet.publishedAt,
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  } catch {
    return null;
  }
}

export function getChannels(): Channel[] {
  return channelsData.channels;
}

export async function fetchAllChannelVideos(): Promise<YouTubeVideo[]> {
  const channels = channelsData.channels;

  const results = await Promise.allSettled(
    channels.map((ch) => fetchVideoForChannel(ch))
  );

  return results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((v): v is YouTubeVideo => v !== null);
}
