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
  id: string;
  name: string;
  category: string;
}

function getTodaysChannel(): Channel {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (now.getTime() - start.getTime()) / 86400000
  );
  const channels = channelsData.channels;
  return channels[dayOfYear % channels.length];
}

async function fetchFromAPI(channel: Channel): Promise<YouTubeVideo | null> {
  try {
    // Calls our own server-side API route — key never leaves the server
    const res = await fetch(`/api/youtube?channelId=${channel.id}`);

    if (!res.ok) return null;

    const data = await res.json();
    const item = data.items?.[0];
    if (!item) return null;

    return {
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelName: channel.name,
      category: channel.category,
      thumbnailUrl:
        item.snippet.thumbnails.high?.url ||
        item.snippet.thumbnails.medium?.url ||
        item.snippet.thumbnails.default?.url,
      publishedAt: item.snippet.publishedAt,
      youtubeUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    };
  } catch {
    return null;
  }
}

// Mock data for when API key is not configured or API fails
const MOCK_VIDEOS: Record<string, YouTubeVideo> = {
  podcast: {
    videoId: "",
    title: "Latest Episode \u2014 Deep Conversations on Life and Purpose",
    channelName: "",
    category: "podcast",
    thumbnailUrl: "",
    publishedAt: new Date().toISOString(),
    youtubeUrl: "#",
  },
  music: {
    videoId: "",
    title: "New Release \u2014 Country Roads & Open Skies",
    channelName: "",
    category: "music",
    thumbnailUrl: "",
    publishedAt: new Date().toISOString(),
    youtubeUrl: "#",
  },
  motivational: {
    videoId: "",
    title: "Stay Hard \u2014 Morning Motivation Discipline Talk",
    channelName: "",
    category: "motivational",
    thumbnailUrl: "",
    publishedAt: new Date().toISOString(),
    youtubeUrl: "#",
  },
  comedy: {
    videoId: "",
    title: "Stand-Up Clips \u2014 Best of This Week",
    channelName: "",
    category: "comedy",
    thumbnailUrl: "",
    publishedAt: new Date().toISOString(),
    youtubeUrl: "#",
  },
};

function getMockVideo(channel: Channel): YouTubeVideo {
  const mock = MOCK_VIDEOS[channel.category] || MOCK_VIDEOS.podcast;
  return {
    ...mock,
    channelName: channel.name,
  };
}

export async function fetchTodaysVideo(): Promise<YouTubeVideo> {
  const channel = getTodaysChannel();

  const live = await fetchFromAPI(channel);
  if (live) return live;

  return getMockVideo(channel);
}
