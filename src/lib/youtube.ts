/**
 * YouTube Data API v3 Integration
 *
 * ============================================================
 * HOW TO GET YOUR YOUTUBE API KEY:
 * ============================================================
 *
 * 1. Go to https://console.cloud.google.com
 * 2. Click "Select a project" at the top → "New Project"
 *    - Name it "Mornin" or whatever you like → Create
 * 3. With your new project selected, go to:
 *    APIs & Services → Library
 * 4. Search for "YouTube Data API v3" → click it → Enable
 * 5. Go to: APIs & Services → Credentials
 * 6. Click "+ Create Credentials" → "API key"
 * 7. Copy the key
 * 8. (Recommended) Click "Edit API key" → under "API restrictions",
 *    select "Restrict key" and choose only "YouTube Data API v3"
 *
 * Then create a file called .env.local in the project root:
 *
 *   NEXT_PUBLIC_YOUTUBE_API_KEY=your_key_here
 *
 * And add the same key to Vercel:
 *   vercel env add NEXT_PUBLIC_YOUTUBE_API_KEY
 *
 * Free tier: 10,000 quota units/day. Each search costs 100 units.
 * With 12 channels rotating daily, you'll use ~100 units/day.
 * ============================================================
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

const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

async function fetchFromAPI(channel: Channel): Promise<YouTubeVideo | null> {
  if (!YOUTUBE_API_KEY) return null;

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet&channelId=${channel.id}&order=date` +
        `&maxResults=1&type=video&key=${YOUTUBE_API_KEY}`
    );

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

// Mock data for when no API key is configured
const MOCK_VIDEOS: Record<string, YouTubeVideo> = {
  podcast: {
    videoId: "dQw4w9WgXcQ",
    title: "Latest Episode — Deep Conversations on Life and Purpose",
    channelName: "",
    category: "podcast",
    thumbnailUrl: "",
    publishedAt: new Date().toISOString(),
    youtubeUrl: "#",
  },
  music: {
    videoId: "dQw4w9WgXcQ",
    title: "New Release — Country Roads & Open Skies",
    channelName: "",
    category: "music",
    thumbnailUrl: "",
    publishedAt: new Date().toISOString(),
    youtubeUrl: "#",
  },
  motivational: {
    videoId: "dQw4w9WgXcQ",
    title: "Stay Hard — Morning Motivation Discipline Talk",
    channelName: "",
    category: "motivational",
    thumbnailUrl: "",
    publishedAt: new Date().toISOString(),
    youtubeUrl: "#",
  },
  comedy: {
    videoId: "dQw4w9WgXcQ",
    title: "Stand-Up Clips — Best of This Week",
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

  // Try live API first
  const live = await fetchFromAPI(channel);
  if (live) return live;

  // Fall back to mock data
  return getMockVideo(channel);
}

export function isUsingMockData(): boolean {
  return !YOUTUBE_API_KEY;
}
