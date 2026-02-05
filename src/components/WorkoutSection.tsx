"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { fetchFitnessVideos, type YouTubeVideo } from "@/lib/youtube";

/* ── Constants ─────────────────────────────────────────────────── */

const STORAGE_KEY = "mornin-fitness-saved";
const CATEGORY_ICONS: Record<string, string> = {
  yoga: "\uD83E\uDDD8",
  workout: "\uD83C\uDFCB\uFE0F",
  cardio: "\uD83C\uDFC3",
  bodyweight: "\uD83D\uDCAA",
  mobility: "\uD83E\uDDB5",
};

/* ── Helpers ───────────────────────────────────────────────────── */

interface SavedVideo {
  videoId: string;
  title: string;
  channelName: string;
  category: string;
  thumbnailUrl: string;
  youtubeUrl: string;
  savedAt: string;
}

function loadSaved(): SavedVideo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SavedVideo[];
  } catch {}
  return [];
}

function saveSaved(videos: SavedVideo[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
  } catch {}
}

function getTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diffMs / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

/* ── Component ─────────────────────────────────────────────────── */

export default function WorkoutSection() {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [vidIndex, setVidIndex] = useState(0);
  const [vidLoading, setVidLoading] = useState(true);
  const [saved, setSaved] = useState<SavedVideo[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const touchStartX = useRef<number | null>(null);

  /* Fetch fitness videos */
  useEffect(() => {
    fetchFitnessVideos()
      .then((vids) => {
        vids.sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() -
            new Date(a.publishedAt).getTime()
        );
        setVideos(vids);
        setVidIndex(0);
      })
      .finally(() => setVidLoading(false));
    setSaved(loadSaved());
  }, []);

  /* Handlers */
  const toggleSaved = useCallback((video: YouTubeVideo) => {
    setSaved((prev) => {
      const exists = prev.some((v) => v.videoId === video.videoId);
      let next: SavedVideo[];
      if (exists) {
        next = prev.filter((v) => v.videoId !== video.videoId);
      } else {
        const newSaved: SavedVideo = {
          videoId: video.videoId,
          title: video.title,
          channelName: video.channelName,
          category: video.category,
          thumbnailUrl: video.thumbnailUrl,
          youtubeUrl: video.youtubeUrl,
          savedAt: new Date().toISOString(),
        };
        next = [newSaved, ...prev];
      }
      saveSaved(next);
      return next;
    });
  }, []);

  const removeSaved = useCallback((videoId: string) => {
    setSaved((prev) => {
      const next = prev.filter((v) => v.videoId !== videoId);
      saveSaved(next);
      return next;
    });
  }, []);

  const nextVid = useCallback(() => {
    setVidIndex((p) => (p + 1) % videos.length);
  }, [videos.length]);

  const prevVid = useCallback(() => {
    setVidIndex((p) => (p - 1 + videos.length) % videos.length);
  }, [videos.length]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const delta = e.changedTouches[0].clientX - touchStartX.current;
      if (delta > 50) prevVid();
      touchStartX.current = null;
    },
    [prevVid]
  );

  const currentVideo = videos[vidIndex];
  const isSaved = currentVideo
    ? saved.some((v) => v.videoId === currentVideo.videoId)
    : false;

  return (
    <div className="space-y-6">
      {/* ── Section Header ──────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-accent text-xl">{"\uD83C\uDFCB\uFE0F"}</span>
        <h2 className="text-accent font-semibold text-sm uppercase tracking-wider">
          Fitness
        </h2>
      </div>

      {/* ── Fitness Videos ──────────────────────────────── */}
      {vidLoading ? (
        <div className="card animate-pulse">
          <div className="h-4 bg-white/10 rounded w-1/3 mb-4" />
          <div className="h-48 bg-white/10 rounded-xl mb-3" />
          <div className="h-4 bg-white/10 rounded w-2/3" />
        </div>
      ) : videos.length > 0 && currentVideo ? (
        <div
          className="card cursor-pointer select-none active:scale-[0.98] transition-transform"
          onClick={nextVid}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-accent text-lg">
                {CATEGORY_ICONS[currentVideo.category] || "\uD83C\uDFAC"}
              </span>
              <h3 className="text-accent font-semibold text-sm uppercase tracking-wider">
                Fitness Videos
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600 text-xs">tap / swipe</span>
              <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
                {vidIndex + 1}/{videos.length}
              </span>
            </div>
          </div>

          <div className="mb-4 rounded-xl overflow-hidden bg-dark-surface relative">
            <img
              src={currentVideo.thumbnailUrl}
              alt={currentVideo.title}
              className="w-full h-48 object-cover"
              loading="lazy"
            />
            <a
              href={currentVideo.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 bg-black/60 rounded-full flex items-center justify-center hover:bg-red-600/90 transition-colors">
                <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </a>
          </div>

          <h4 className="text-lg font-semibold text-gray-100 mb-2 leading-snug">
            {currentVideo.title}
          </h4>
          <div className="flex items-center justify-between">
            <p className="text-accent-light text-sm font-medium">
              {currentVideo.channelName}
            </p>
            <span className="text-gray-500 text-xs">
              {getTimeAgo(currentVideo.publishedAt)}
            </span>
          </div>

          {/* Save button */}
          <button
            className={`mt-4 flex items-center gap-3 w-full rounded-xl py-3 px-4 text-sm transition-colors ${
              isSaved
                ? "bg-accent/10 text-accent"
                : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              toggleSaved(currentVideo);
            }}
          >
            <svg
              className={`w-5 h-5 ${isSaved ? "fill-accent" : "fill-none stroke-current"}`}
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
            {isSaved ? "Saved" : "Save"}
            {saved.length > 0 && (
              <span className="ml-auto text-xs text-gray-500">
                {saved.length} saved
              </span>
            )}
          </button>

          <a
            href={currentVideo.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 transition-colors rounded-xl py-3 text-sm text-gray-300"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
              <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="white" />
            </svg>
            Open in YouTube
          </a>
        </div>
      ) : null}

      {/* ── Saved Videos Archive ─────────────────────────── */}
      {saved.length > 0 && (
        <div className="card">
          <button
            className="flex items-center justify-between w-full"
            onClick={() => setShowArchive((prev) => !prev)}
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-accent fill-accent"
                viewBox="0 0 24 24"
              >
                <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <h2 className="text-accent font-semibold text-sm uppercase tracking-wider">
                Saved Workouts
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
                {saved.length} saved
              </span>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${showArchive ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {showArchive && (
            <div className="mt-4 space-y-3">
              {saved.map((v) => (
                <div
                  key={v.videoId}
                  className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0"
                >
                  <button
                    className="mt-0.5 flex-shrink-0"
                    onClick={() => removeSaved(v.videoId)}
                    title="Remove from saved"
                  >
                    <svg
                      className="w-5 h-5 text-accent fill-accent"
                      viewBox="0 0 24 24"
                    >
                      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                  <a
                    href={v.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 w-20 h-12 rounded-lg overflow-hidden bg-dark-surface"
                  >
                    <img
                      src={v.thumbnailUrl}
                      alt={v.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </a>
                  <div className="flex-1 min-w-0">
                    <a
                      href={v.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-300 hover:text-accent transition-colors font-medium line-clamp-2"
                    >
                      {v.title}
                    </a>
                    <p className="text-xs text-gray-500">
                      {v.channelName}
                    </p>
                  </div>
                  <span className="text-lg flex-shrink-0">
                    {CATEGORY_ICONS[v.category] || "\uD83C\uDFAC"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
