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
    <div className="mt-3 space-y-1">
      {chapters.map((chapter) => {
        const isComplete = chapter.index < completedUpTo;
        const isCurrent = chapter.index === completedUpTo;
        const isPlaying = currentlyPlayingChapter === chapter.index;
        const duration = estimateChapterDuration(chapter.wordCount);

        return (
          <button
            key={chapter.index}
            onClick={() => onPlayChapter(bookId, chapter.index)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
              isPlaying
                ? "bg-accent/20 text-accent"
                : "hover:bg-white/5 text-gray-300"
            }`}
          >
            {/* Play / check icon */}
            <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center">
              {isPlaying ? (
                <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : isComplete ? (
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
              <p className="text-xs text-gray-600">{chapter.wordCount}w</p>
            </div>

            {/* Current indicator */}
            {isCurrent && !isPlaying && (
              <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );
}
