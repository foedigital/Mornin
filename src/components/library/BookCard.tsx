"use client";

import { useState } from "react";
import type { Book, BookProgress } from "@/lib/library-db";
import ChapterList from "@/components/library/ChapterList";

interface BookCardProps {
  book: Book;
  progress: BookProgress | null;
  onDelete: (id: string) => void;
  onPlayChapter: (bookId: string, chapterIndex: number) => void;
  currentlyPlayingBookId: string | null;
  currentlyPlayingChapter: number | null;
}

export default function BookCard({
  book,
  progress,
  onDelete,
  onPlayChapter,
  currentlyPlayingBookId,
  currentlyPlayingChapter,
}: BookCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const totalChapters = book.chapters.length;
  const completedChapters = progress ? progress.currentChapter : 0;
  const progressPercent = totalChapters > 0 ? (completedChapters / totalChapters) * 100 : 0;
  const isThisBookPlaying = currentlyPlayingBookId === book.id;

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(book.id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div className="card">
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Play button */}
        <button
          onClick={() => onPlayChapter(book.id, progress?.currentChapter ?? 0)}
          className="flex-shrink-0 w-12 h-12 rounded-xl bg-accent/20 hover:bg-accent/30 transition-colors flex items-center justify-center mt-0.5"
        >
          {isThisBookPlaying ? (
            <svg className="w-6 h-6 text-accent" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-accent ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Title + author */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-100 leading-tight line-clamp-2">
            {book.title}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{book.author}</p>
          <p className="text-xs text-gray-600 mt-1">
            {totalChapters} chapter{totalChapters !== 1 ? "s" : ""}
            {progress && !progress.completed && ` · Ch. ${completedChapters + 1}`}
            {progress?.completed && " · Complete"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label={expanded ? "Collapse chapters" : "Expand chapters"}
          >
            <svg
              className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className={`p-2 transition-colors ${
              confirmDelete ? "text-red-400 hover:text-red-300" : "text-gray-600 hover:text-gray-400"
            }`}
            aria-label="Delete book"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1 bg-gray-700/50 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent/60 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Expandable chapter list */}
      {expanded && (
        <ChapterList
          bookId={book.id}
          chapters={book.chapters}
          progress={progress}
          onPlayChapter={onPlayChapter}
          currentlyPlayingChapter={isThisBookPlaying ? currentlyPlayingChapter : null}
        />
      )}
    </div>
  );
}
