"use client";

import { useState } from "react";
import type { Book, BookProgress } from "@/lib/library-db";
import ChapterList from "@/components/library/ChapterList";

export type DownloadStatus = "none" | "downloading" | "downloaded";

interface BookCardProps {
  book: Book;
  progress: BookProgress | null;
  onDelete: (id: string) => void;
  onPlayChapter: (bookId: string, chapterIndex: number) => void;
  currentlyPlayingBookId: string | null;
  currentlyPlayingChapter: number | null;
  downloadStatus: DownloadStatus;
  downloadProgress: { done: number; total: number } | null;
  onDownload: (bookId: string) => void;
  onRemoveDownload: (bookId: string) => void;
  storageSize: number; // actual cached bytes, 0 if not downloaded
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Estimate audio size from total word count: 96kbps @ ~150 wpm ≈ 4.8 KB/word */
function estimateSize(book: Book): number {
  const totalWords = book.chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
  return Math.round(totalWords * 4.8 * 1024);
}

// Generate a deterministic accent color from the book id
function bookColor(id: string): string {
  const colors = [
    "from-orange-600 to-amber-800",
    "from-blue-600 to-indigo-800",
    "from-emerald-600 to-teal-800",
    "from-rose-600 to-pink-800",
    "from-violet-600 to-purple-800",
    "from-cyan-600 to-sky-800",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function BookCard({
  book,
  progress,
  onDelete,
  onPlayChapter,
  currentlyPlayingBookId,
  currentlyPlayingChapter,
  downloadStatus,
  downloadProgress,
  onDownload,
  onRemoveDownload,
  storageSize,
}: BookCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemoveDl, setConfirmRemoveDl] = useState(false);

  const totalChapters = book.chapters.length;
  const completedChapters = progress ? progress.currentChapter : 0;
  const progressPercent = totalChapters > 0 ? (completedChapters / totalChapters) * 100 : 0;
  const isThisBookPlaying = currentlyPlayingBookId === book.id;
  const gradient = bookColor(book.id);

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
      <div className="flex items-start gap-4">
        {/* Book cover icon */}
        <button
          onClick={() => onPlayChapter(book.id, progress?.currentChapter ?? 0)}
          className={`flex-shrink-0 w-14 h-[72px] rounded-lg bg-gradient-to-br ${gradient} shadow-lg flex flex-col items-center justify-center relative overflow-hidden group`}
        >
          {/* Spine line */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-black/20" />

          {isThisBookPlaying ? (
            <svg className="w-6 h-6 text-white/90 drop-shadow" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <>
              {/* Book icon */}
              <svg className="w-6 h-6 text-white/80 group-hover:hidden" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {/* Play icon on hover */}
              <svg className="w-6 h-6 text-white/90 hidden group-hover:block drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </>
          )}

          {/* Progress fill from bottom */}
          {progressPercent > 0 && progressPercent < 100 && (
            <div
              className="absolute bottom-0 left-0 right-0 bg-white/15"
              style={{ height: `${progressPercent}%` }}
            />
          )}
          {progress?.completed && (
            <div className="absolute top-1 right-1">
              <svg className="w-3 h-3 text-green-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </button>

        {/* Title + author */}
        <div className="flex-1 min-w-0 py-1">
          <h3 className="text-sm font-semibold text-gray-100 leading-snug line-clamp-2">
            {book.title}
          </h3>
          <p className="text-xs text-gray-500 mt-1 truncate">{book.author}</p>
          <p className="text-xs text-gray-600 mt-1.5">
            {totalChapters} ch{totalChapters !== 1 ? "s" : ""}
            {" · "}
            {storageSize > 0 ? (
              <span className="text-green-500/70">{formatSize(storageSize)}</span>
            ) : (
              <span title="Estimated">~{formatSize(estimateSize(book))}</span>
            )}
            {progress && !progress.completed && ` · Ch. ${completedChapters + 1}`}
            {progress?.completed && " · Complete"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-2">
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

          {/* Download button */}
          {downloadStatus === "downloading" ? (
            <div className="p-2 flex items-center gap-1" title={downloadProgress ? `${downloadProgress.done}/${downloadProgress.total}` : "Downloading..."}>
              <svg className="w-4 h-4 text-accent animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {downloadProgress && (
                <span className="text-[10px] text-accent font-medium">{downloadProgress.done}/{downloadProgress.total}</span>
              )}
            </div>
          ) : downloadStatus === "downloaded" ? (
            <button
              onClick={() => {
                if (confirmRemoveDl) {
                  onRemoveDownload(book.id);
                  setConfirmRemoveDl(false);
                } else {
                  setConfirmRemoveDl(true);
                  setTimeout(() => setConfirmRemoveDl(false), 3000);
                }
              }}
              className={`p-2 transition-colors ${confirmRemoveDl ? "text-red-400" : "text-green-400 hover:text-green-300"}`}
              aria-label={confirmRemoveDl ? "Tap again to remove download" : "Downloaded (tap to remove)"}
              title={confirmRemoveDl ? "Tap again to remove" : "Downloaded"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => onDownload(book.id)}
              className="p-2 text-gray-600 hover:text-gray-400 transition-colors"
              aria-label="Download for offline"
              title="Download"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          )}

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

      {/* Expandable chapter list */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-white/5" />
      )}
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
