"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { fetchAllChannelVideos, type YouTubeVideo } from "@/lib/youtube";

const CATEGORY_LABELS: Record<string, string> = {
  podcast: "Podcast",
  music: "Music",
  motivational: "Motivation",
  comedy: "Comedy",
  educational: "Learn",
};

const CATEGORY_ICONS: Record<string, string> = {
  podcast: "\uD83C\uDFA7",
  music: "\uD83C\uDFB5",
  motivational: "\uD83D\uDD25",
  comedy: "\uD83D\uDE02",
  educational: "\uD83D\uDCDA",
};

export default function MediaSection() {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    fetchAllChannelVideos()
      .then((vids) => {
        // Sort by newest upload first
        vids.sort((a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
        setVideos(vids);
        setIndex(0);
      })
      .finally(() => setLoading(false));
  }, []);

  const next = useCallback(() => {
    setIndex((prev) => (prev + 1) % videos.length);
  }, [videos.length]);

  const prev = useCallback(() => {
    setIndex((prev) => (prev - 1 + videos.length) % videos.length);
  }, [videos.length]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const delta = e.changedTouches[0].clientX - touchStartX.current;
      if (delta > 50) {
        prev();
      }
      touchStartX.current = null;
    },
    [prev]
  );

  const handleClick = useCallback(() => {
    next();
  }, [next]);

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/3 mb-4" />
        <div className="h-48 bg-white/10 rounded-xl mb-3" />
        <div className="h-4 bg-white/10 rounded w-2/3" />
      </div>
    );
  }

  if (videos.length === 0) return null;

  const video = videos[index];
  const timeAgo = getTimeAgo(video.publishedAt);

  return (
    <div
      className="card cursor-pointer select-none active:scale-[0.98] transition-transform"
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-accent text-lg">
            {CATEGORY_ICONS[video.category] || "\uD83C\uDFAC"}
          </span>
          <h2 className="text-accent font-semibold text-sm uppercase tracking-wider">
            Today&apos;s {CATEGORY_LABELS[video.category] || "Media"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-600 text-xs">tap / swipe</span>
          <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
            {index + 1}/{videos.length}
          </span>
        </div>
      </div>

      {/* Thumbnail */}
      <div className="mb-4 rounded-xl overflow-hidden bg-dark-surface relative">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="w-full h-48 object-cover"
          loading="lazy"
        />
        {/* Play button overlay */}
        <a
          href={video.youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-14 h-14 bg-black/60 rounded-full flex items-center justify-center hover:bg-red-600/90 transition-colors">
            <svg
              className="w-6 h-6 text-white ml-1"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </a>
      </div>

      {/* Video info */}
      <h3 className="text-lg font-semibold text-gray-100 mb-2 leading-snug">
        {video.title}
      </h3>

      <div className="flex items-center justify-between">
        <p className="text-accent-light text-sm font-medium">
          {video.channelName}
        </p>
        <span className="text-gray-500 text-xs">{timeAgo}</span>
      </div>

      {/* Open in YouTube button */}
      <a
        href={video.youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 transition-colors rounded-xl py-3 text-sm text-gray-300"
        onClick={(e) => e.stopPropagation()}
      >
        <svg
          className="w-5 h-5 text-red-500"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
          <path
            d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z"
            fill="white"
          />
        </svg>
        Open in YouTube
      </a>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "just now";
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}
