"use client";

import { useCallback, useState } from "react";
import { useLibraryAudio } from "@/components/library/LibraryAudioContext";
import { addBook, getAllBooks, type Book } from "@/lib/library-db";

interface LiteraturePlayButtonProps {
  text: string;
  contentId: string;
  title: string;
  author: string;
  url: string;
  isPoetry?: boolean;
}

export default function LiteraturePlayButton({
  contentId,
  title,
  url,
}: LiteraturePlayButtonProps) {
  const { playChapter, isPlaying, isLoading: audioLoading, currentBookId, pause } = useLibraryAudio();
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");

  // Check if this reading is the one currently playing
  const isThisPlaying = isPlaying && currentBookId?.startsWith("reading-");

  // We use a deterministic ID based on the contentId so we can find it again
  const bookIdPrefix = `reading-${contentId.replace(/[^a-zA-Z0-9]/g, "-")}`;

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setError("");

      // If this reading is currently playing, pause it
      if (isThisPlaying) {
        pause();
        return;
      }

      setExtracting(true);

      try {
        // Check if we already have this book in the library
        const allBooks = await getAllBooks();
        let book = allBooks.find((b) => b.url === url);

        if (!book) {
          // Extract content from URL
          const res = await fetch("/api/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          });

          let data;
          try {
            data = await res.json();
          } catch {
            throw new Error("Failed to reach server");
          }

          if (!res.ok) {
            throw new Error(data.error || "Failed to extract");
          }

          // Create the book
          book = {
            id: `${bookIdPrefix}-${Date.now()}`,
            url,
            title: data.title || title,
            author: data.author || "Unknown",
            chapters: data.chapters,
            dateAdded: Date.now(),
            lastPlayed: 0,
          };

          await addBook(book);
        }

        // Start playing chapter 0
        playChapter(book, 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
        setTimeout(() => setError(""), 3000);
      } finally {
        setExtracting(false);
      }
    },
    [url, title, bookIdPrefix, playChapter, pause, isThisPlaying]
  );

  const loading = extracting || audioLoading;

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`relative flex items-center justify-center w-9 h-9 rounded-full transition-colors flex-shrink-0 ${
        isThisPlaying
          ? "bg-accent text-dark-bg"
          : error
          ? "bg-red-500/20 text-red-400"
          : "bg-white/10 text-gray-300 hover:bg-accent/20 hover:text-accent"
      } ${loading ? "opacity-70" : ""}`}
      aria-label={isThisPlaying ? `Now playing ${title}` : `Listen to ${title}`}
      title={error || undefined}
    >
      {loading ? (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : isThisPlaying ? (
        <div className="flex items-center gap-0.5">
          <span className="w-0.5 h-3 bg-dark-bg rounded-full animate-pulse" />
          <span className="w-0.5 h-4 bg-dark-bg rounded-full animate-pulse [animation-delay:150ms]" />
          <span className="w-0.5 h-2 bg-dark-bg rounded-full animate-pulse [animation-delay:300ms]" />
        </div>
      ) : error ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  );
}
