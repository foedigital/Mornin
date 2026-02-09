"use client";

import type { Chapter } from "@/lib/chunker";
import { estimateChapterDuration } from "@/lib/chunker";
import type { BookProgress } from "@/lib/library-db";

interface ChapterListProps {
  bookId: string;
  chapters: Chapter[];
  progress: BookProgress | null;
  onPlayChapter: (bookId: string, chapterIndex: number) => void;
  currentlyPlayingChapter: number | null;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ChapterList({
  bookId,
  chapters,
  progress,
  onPlayChapter,
  currentlyPlayingChapter,
}: ChapterListProps) {
  const completedUpTo = progress?.currentChapter ?? -1;

  return (
    <div className="divide-y divide-white/[0.08]">
      {chapters.map((chapter) => {
        const isComplete = chapter.index < completedUpTo;
        const isCurrent = chapter.index === completedUpTo;
        const isPlaying = currentlyPlayingChapter === chapter.index;
        const duration = estimateChapterDuration(chapter.wordCount);

        return (
          <button
            key={chapter.index}
            onClick={() => onPlayChapter(bookId, chapter.index)}
            className={`w-full flex items-center gap-3 px-4 min-h-[56px] py-3 text-left transition-all duration-200 ${
              isPlaying
                ? "border-l-[3px] border-accent bg-accent/5 text-accent"
                : isCurrent
                  ? "border-l-[3px] border-accent/50 text-gray-200"
                  : "border-l-[3px] border-transparent hover:bg-white/5 text-gray-300"
            }`}
          >
            {/* Play / check icon — 44px touch target */}
            <div className="flex-shrink-0 w-11 h-11 flex items-center justify-center">
              {isPlaying ? (
                <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : isComplete ? (
                <svg className="w-5 h-5 text-green-500/70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </div>

            {/* Chapter info */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${isComplete ? "text-gray-500" : ""}`}>
                {chapter.title}
              </p>
            </div>

            {/* Duration + word count */}
            <div className="flex-shrink-0 text-right">
              <p className="text-xs text-gray-500">{formatDuration(duration)}</p>
              <p className="text-[11px] text-gray-600 mt-0.5">{chapter.wordCount}w</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
