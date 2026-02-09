"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import readingsData from "../../data/readings.json";
import LiteraturePlayButton from "@/components/LiteraturePlayButton";
import DownloadModal from "@/components/library/DownloadModal";
import type { Book } from "@/lib/library-db";

const CONVERTED_KEY = "mornin-converted-audiobooks";

function loadConverted(): Set<string> {
  try {
    const raw = localStorage.getItem(CONVERTED_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

function saveConverted(urls: Set<string>) {
  try {
    localStorage.setItem(CONVERTED_KEY, JSON.stringify(Array.from(urls)));
  } catch {}
}

interface Reading {
  title: string;
  author: string;
  type: string;
  year: number;
  excerpt: string;
  url: string;
  readTime: string;
}

const STORAGE_KEY = "mornin-readings-completed";

const TYPE_ICONS: Record<string, string> = {
  poem: "\u{1F4DC}",
  "short story": "\u{1F4D6}",
  novella: "\u{1F4D5}",
  "short story collection": "\u{1F4DA}",
  novel: "\u{1F4D7}",
  essay: "\u{270D}\u{FE0F}",
  speech: "\u{1F3A4}",
  philosophy: "\u{1F9D8}",
  theology: "\u{26EA}",
  memoir: "\u{1F4DD}",
};

const CATEGORY_TABS = [
  { key: "all", label: "All" },
  { key: "poem", label: "Poems" },
  { key: "short story", label: "Short Stories" },
  { key: "novella", label: "Novellas" },
  { key: "novel", label: "Novels" },
  { key: "nonfiction", label: "Non-Fiction" },
  { key: "speech", label: "Speeches" },
];

const NONFICTION_TYPES = ["philosophy", "theology", "memoir", "essay"];

function seededShuffle(arr: Reading[], seed: number): Reading[] {
  const shuffled = [...arr];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function loadCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

function saveCompleted(completed: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(completed)));
  } catch {}
}

function readingKey(r: Reading): string {
  return `${r.title}::${r.author}`;
}

export default function ReadingSection() {
  const [index, setIndex] = useState<number | null>(null);
  const [shuffled, setShuffled] = useState<Reading[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [showArchive, setShowArchive] = useState(false);
  const [converted, setConverted] = useState<Set<string>>(new Set());
  const [downloadTarget, setDownloadTarget] = useState<Reading | null>(null);
  const [category, setCategory] = useState("all");
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor(
      (now.getTime() - start.getTime()) / 86400000
    );
    const readings = seededShuffle(readingsData.readings as Reading[], now.getFullYear());
    setShuffled(readings);
    setIndex(dayOfYear % readings.length);
    setCompleted(loadCompleted());
    setConverted(loadConverted());
  }, []);

  const filtered = useMemo(() => {
    if (category === "all") return shuffled;
    if (category === "nonfiction") return shuffled.filter(r => NONFICTION_TYPES.includes(r.type));
    if (category === "short story") return shuffled.filter(r => r.type === "short story" || r.type === "short story collection");
    return shuffled.filter(r => r.type === category);
  }, [shuffled, category]);

  const handleCategoryChange = useCallback((newCategory: string) => {
    setCategory(newCategory);
    setIndex(0);
  }, []);

  const toggleCompleted = useCallback(
    (reading: Reading) => {
      setCompleted((prev) => {
        const next = new Set(prev);
        const key = readingKey(reading);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        saveCompleted(next);
        return next;
      });
    },
    []
  );

  const next = useCallback(() => {
    setIndex((prev) => (prev !== null ? (prev + 1) % filtered.length : 0));
  }, [filtered.length]);

  const prev = useCallback(() => {
    setIndex((prev) =>
      prev !== null ? (prev - 1 + filtered.length) % filtered.length : 0
    );
  }, [filtered.length]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const delta = e.changedTouches[0].clientX - touchStartX.current;
      if (delta > 50) prev();
      touchStartX.current = null;
    },
    [prev]
  );

  const handleClick = useCallback(() => {
    next();
  }, [next]);

  const handleStartDownload = useCallback((r: Reading) => {
    setDownloadTarget(r);
  }, []);

  const handleDownloadComplete = useCallback((_book: Book) => {
    if (downloadTarget) {
      setConverted((prev) => {
        const next = new Set(prev);
        next.add(downloadTarget.url);
        saveConverted(next);
        return next;
      });
    }
  }, [downloadTarget]);

  const handleDownloadClose = useCallback(() => {
    setDownloadTarget(null);
  }, []);

  if (index === null || filtered.length === 0) return null;

  const safeIndex = index % filtered.length;
  const reading = filtered[safeIndex];
  const icon = TYPE_ICONS[reading.type] || "\u{1F4D6}";
  const isRead = completed.has(readingKey(reading));

  const completedReadings = shuffled.filter((r) => completed.has(readingKey(r)));

  return (
    <>
      <div
        className="card cursor-pointer select-none active:scale-[0.98] transition-transform"
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-accent text-lg">{icon}</span>
            <h2 className="text-accent font-semibold text-sm uppercase tracking-wider">
              Literature
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600 text-xs">tap / swipe</span>
            <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
              {safeIndex + 1}/{filtered.length}
            </span>
          </div>
        </div>

        {/* Category filter tabs */}
        <div
          className="flex gap-1.5 overflow-x-auto pb-3 mb-3 -mx-1 px-1"
          style={{ scrollbarWidth: "none" }}
          onClick={(e) => e.stopPropagation()}
        >
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={(e) => {
                e.stopPropagation();
                handleCategoryChange(tab.key);
              }}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                category === tab.key
                  ? "bg-accent text-dark-bg"
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-start gap-3 mb-2">
          <h3 className={`text-xl font-semibold leading-snug flex-1 ${isRead ? "text-gray-500 line-through" : "text-gray-100"}`}>
            {reading.title}
          </h3>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <LiteraturePlayButton
              text={reading.excerpt}
              contentId={readingKey(reading)}
              title={reading.title}
              author={reading.author}
              url={reading.url}
              isPoetry={reading.type === "poem"}
            />
            {/* Convert to audiobook button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!converted.has(reading.url)) handleStartDownload(reading);
              }}
              className={`flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
                converted.has(reading.url)
                  ? "bg-green-500/20 text-green-400"
                  : "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
              }`}
              aria-label={converted.has(reading.url) ? "In library" : "Download as audiobook"}
              title={converted.has(reading.url) ? "In library" : "Download as audiobook"}
            >
              {converted.has(reading.url) ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <p className="text-gray-400 text-sm leading-relaxed mb-4 italic">
          &ldquo;{reading.excerpt}&rdquo;
        </p>

        <div className="flex items-center justify-between mb-4">
          <p className="text-accent-light text-sm font-medium">
            &mdash; {reading.author}, {reading.year > 0 ? reading.year : `${Math.abs(reading.year)} BC`}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider bg-white/5 px-2 py-1 rounded-full">
              {reading.type}
            </span>
            <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
              {reading.readTime}
            </span>
          </div>
        </div>

        {/* Mark as read checkbox */}
        <button
          className={`flex items-center gap-3 w-full rounded-xl py-3 px-4 mb-3 text-sm transition-colors ${
            isRead
              ? "bg-accent/10 text-accent"
              : "bg-white/5 text-gray-400 hover:bg-white/10"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            toggleCompleted(reading);
          }}
        >
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
              isRead
                ? "border-accent bg-accent"
                : "border-gray-500"
            }`}
          >
            {isRead && (
              <svg className="w-3 h-3 text-dark-bg" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          {isRead ? "Read" : "Mark as read"}
          {completed.size > 0 && (
            <span className="ml-auto text-xs text-gray-500">
              {completed.size}/{shuffled.length} completed
            </span>
          )}
        </button>

        <a
          href={reading.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 transition-colors rounded-xl py-3 text-sm text-gray-300"
          onClick={(e) => e.stopPropagation()}
        >
          <svg
            className="w-5 h-5 text-accent"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          Read Full Text
        </a>
      </div>

      {/* Archive of completed readings */}
      {completedReadings.length > 0 && (
        <div className="card">
          <button
            className="flex items-center justify-between w-full"
            onClick={() => setShowArchive((prev) => !prev)}
          >
            <div className="flex items-center gap-2">
              <span className="text-accent text-lg">{"\u{2705}"}</span>
              <h2 className="text-accent font-semibold text-sm uppercase tracking-wider">
                Reading Archive
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
                {completedReadings.length} read
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
              {completedReadings.map((r) => (
                <div
                  key={readingKey(r)}
                  className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0"
                >
                  <button
                    className="mt-0.5 flex-shrink-0"
                    onClick={() => toggleCompleted(r)}
                    title="Unmark as read"
                  >
                    <div className="w-5 h-5 rounded border-2 border-accent bg-accent flex items-center justify-center">
                      <svg className="w-3 h-3 text-dark-bg" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </button>
                  <div className="flex-1 min-w-0">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-300 hover:text-accent transition-colors font-medium"
                    >
                      {r.title}
                    </a>
                    <p className="text-xs text-gray-500">
                      {r.author} &middot; {r.type} &middot; {r.readTime}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!converted.has(r.url)) handleStartDownload(r);
                      }}
                      className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
                        converted.has(r.url)
                          ? "bg-green-500/20 text-green-400"
                          : "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
                      }`}
                      aria-label={converted.has(r.url) ? "In library" : "Download as audiobook"}
                      title={converted.has(r.url) ? "In library" : "Download as audiobook"}
                    >
                      {converted.has(r.url) ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      )}
                    </button>
                    <span className="text-xs text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">
                      {TYPE_ICONS[r.type] || "\u{1F4D6}"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Download Modal */}
      {downloadTarget && (
        <DownloadModal
          url={downloadTarget.url}
          title={downloadTarget.title}
          author={downloadTarget.author}
          onClose={handleDownloadClose}
          onComplete={handleDownloadComplete}
        />
      )}
    </>
  );
}
