"use client";

import { useState, useEffect, useCallback } from "react";
import type { Chapter } from "@/lib/chunker";
import { estimateChapterDuration, assignParts, type Part } from "@/lib/chunker";
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

/* ── Single chapter row ─────────────────────────────────────────────── */

function ChapterItem({
  bookId,
  chapter,
  isPlaying,
  isComplete,
  isCurrent,
  indented,
  onPlayChapter,
}: {
  bookId: string;
  chapter: Chapter;
  isPlaying: boolean;
  isComplete: boolean;
  isCurrent: boolean;
  indented: boolean;
  onPlayChapter: (bookId: string, chapterIndex: number) => void;
}) {
  const duration = estimateChapterDuration(chapter.wordCount);

  return (
    <button
      onClick={() => onPlayChapter(bookId, chapter.index)}
      className={`w-full flex items-center gap-3 min-h-[48px] py-2.5 text-left transition-all duration-200 border-l-[3px] ${
        indented ? "pl-8 pr-4" : "px-4"
      } ${
        isPlaying
          ? "border-amber-500 bg-amber-500/10 text-amber-400"
          : isCurrent
            ? "border-accent/50 text-gray-200"
            : "border-transparent hover:bg-white/5 text-gray-300"
      }`}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 ${indented ? "w-8 h-8" : "w-11 h-11"} flex items-center justify-center`}>
        {isPlaying ? (
          <svg className={`${indented ? "w-4 h-4" : "w-5 h-5"} text-amber-400`} fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : isComplete ? (
          <svg className={`${indented ? "w-4 h-4" : "w-5 h-5"} text-green-500/60`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className={`${indented ? "w-4 h-4" : "w-5 h-5"}`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${isComplete ? "text-gray-500" : ""}`}>
          {chapter.title}
        </p>
      </div>

      {/* Duration + word count */}
      <div className="flex-shrink-0 text-right">
        <p className="text-xs text-gray-500">{formatDuration(duration)}</p>
        {!indented && (
          <p className="text-[11px] text-gray-600 mt-0.5">{chapter.wordCount}w</p>
        )}
      </div>
    </button>
  );
}

/* ── Part accordion ─────────────────────────────────────────────────── */

function PartAccordion({
  part,
  chapters,
  bookId,
  isOpen,
  onToggle,
  completedUpTo,
  currentlyPlayingChapter,
  onPlayChapter,
}: {
  part: Part;
  chapters: Chapter[];
  bookId: string;
  isOpen: boolean;
  onToggle: () => void;
  completedUpTo: number;
  currentlyPlayingChapter: number | null;
  onPlayChapter: (bookId: string, chapterIndex: number) => void;
}) {
  const partChapters = chapters.filter(
    (ch) => ch.index >= part.startChapter && ch.index <= part.endChapter
  );

  const completedInPart = partChapters.filter(
    (ch) => ch.index < completedUpTo
  ).length;

  return (
    <div>
      {/* Part header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? "rotate-90" : ""
          }`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-200">{part.label}</p>
        </div>
        {completedInPart > 0 && (
          <span className="text-xs text-gray-500 flex-shrink-0">
            {completedInPart}/{partChapters.length}
          </span>
        )}
      </button>

      {/* Collapsible chapter list */}
      <div
        className="overflow-hidden transition-all duration-[250ms] ease-in-out"
        style={{
          maxHeight: isOpen ? `${partChapters.length * 56}px` : "0px",
          opacity: isOpen ? 1 : 0,
        }}
      >
        {partChapters.map((chapter) => (
          <ChapterItem
            key={chapter.index}
            bookId={bookId}
            chapter={chapter}
            isPlaying={currentlyPlayingChapter === chapter.index}
            isComplete={chapter.index < completedUpTo}
            isCurrent={chapter.index === completedUpTo}
            indented
            onPlayChapter={onPlayChapter}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────── */

export default function ChapterList({
  bookId,
  chapters,
  progress,
  onPlayChapter,
  currentlyPlayingChapter,
}: ChapterListProps) {
  const completedUpTo = progress?.currentChapter ?? -1;
  const parts = assignParts(chapters);
  const hasParts = parts.length > 0;

  const getInitialPart = useCallback(() => {
    if (!hasParts) return -1;
    if (currentlyPlayingChapter !== null) {
      return parts.findIndex(
        (p) => currentlyPlayingChapter >= p.startChapter && currentlyPlayingChapter <= p.endChapter
      );
    }
    if (completedUpTo >= 0) {
      return parts.findIndex(
        (p) => completedUpTo >= p.startChapter && completedUpTo <= p.endChapter
      );
    }
    return 0;
  }, [hasParts, parts, currentlyPlayingChapter, completedUpTo]);

  const [openPartIndex, setOpenPartIndex] = useState(getInitialPart);

  // Auto-open the part containing the currently playing chapter
  useEffect(() => {
    if (currentlyPlayingChapter !== null && hasParts) {
      const partIdx = parts.findIndex(
        (p) =>
          currentlyPlayingChapter >= p.startChapter &&
          currentlyPlayingChapter <= p.endChapter
      );
      if (partIdx >= 0) setOpenPartIndex(partIdx);
    }
  }, [currentlyPlayingChapter, hasParts, parts]);

  const togglePart = useCallback((idx: number) => {
    setOpenPartIndex((prev) => (prev === idx ? -1 : idx));
  }, []);

  // ── Short books: flat chapter list (no parts) ──
  if (!hasParts) {
    return (
      <div className="divide-y divide-white/[0.08]">
        {chapters.map((chapter) => (
          <ChapterItem
            key={chapter.index}
            bookId={bookId}
            chapter={chapter}
            isPlaying={currentlyPlayingChapter === chapter.index}
            isComplete={chapter.index < completedUpTo}
            isCurrent={chapter.index === completedUpTo}
            indented={false}
            onPlayChapter={onPlayChapter}
          />
        ))}
      </div>
    );
  }

  // ── Long books: parts accordion ──
  return (
    <div className="divide-y divide-white/[0.06]">
      {parts.map((part) => (
        <PartAccordion
          key={part.index}
          part={part}
          chapters={chapters}
          bookId={bookId}
          isOpen={openPartIndex === part.index}
          onToggle={() => togglePart(part.index)}
          completedUpTo={completedUpTo}
          currentlyPlayingChapter={currentlyPlayingChapter}
          onPlayChapter={onPlayChapter}
        />
      ))}
    </div>
  );
}
