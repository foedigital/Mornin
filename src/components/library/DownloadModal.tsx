"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  addBook,
  getAllBooks,
  getCachedAudio,
  setCachedAudio,
  audioCacheKey,
  DOWNLOAD_VOICE_ID,
  type Book,
} from "@/lib/library-db";

interface DownloadModalProps {
  url: string;
  title: string;
  author: string;
  onClose: () => void;
  onComplete: (book: Book) => void;
}

type Phase = "extracting" | "generating" | "done" | "error";

const TTS_CONCURRENCY = 3;

export default function DownloadModal({
  url,
  title,
  author,
  onClose,
  onComplete,
}: DownloadModalProps) {
  const [phase, setPhase] = useState<Phase>("extracting");
  const [chaptersDone, setChaptersDone] = useState(0);
  const [chaptersTotal, setChaptersTotal] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [bookTitle, setBookTitle] = useState(title);
  const [bookAuthor, setBookAuthor] = useState(author);
  const abortRef = useRef(false);
  const startedRef = useRef(false);

  const runPipeline = useCallback(async () => {
    abortRef.current = false;

    try {
      // Check if already in library
      const existing = await getAllBooks();
      let book = existing.find((b) => b.url === url);

      if (!book) {
        // Phase 1: Extract
        setPhase("extracting");
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (abortRef.current) return;

        let data;
        try {
          data = await res.json();
        } catch {
          throw new Error("Failed to reach server");
        }
        if (!res.ok) throw new Error(data.error || "Failed to extract");

        const extractedTitle = data.title || title;
        const extractedAuthor = data.author || author;
        setBookTitle(extractedTitle);
        setBookAuthor(extractedAuthor);

        book = {
          id: crypto.randomUUID(),
          url,
          title: extractedTitle,
          author: extractedAuthor,
          chapters: data.chapters,
          dateAdded: Date.now(),
          lastPlayed: 0,
        };
        await addBook(book);
      } else {
        setBookTitle(book.title);
        setBookAuthor(book.author);
      }

      if (abortRef.current) return;

      // Phase 2: Generate TTS per chapter with concurrency
      setPhase("generating");
      setChaptersTotal(book.chapters.length);

      // Check which chapters are already cached
      const toGenerate: number[] = [];
      let alreadyCached = 0;
      for (let i = 0; i < book.chapters.length; i++) {
        const key = audioCacheKey(book.id, i, DOWNLOAD_VOICE_ID);
        const cached = await getCachedAudio(key);
        if (cached) {
          alreadyCached++;
        } else {
          toGenerate.push(i);
        }
      }
      setChaptersDone(alreadyCached);

      if (toGenerate.length === 0) {
        setPhase("done");
        onComplete(book);
        return;
      }

      // Process chapters with concurrency
      let doneCount = alreadyCached;
      const bookForClosure = book;

      for (let batch = 0; batch < toGenerate.length; batch += TTS_CONCURRENCY) {
        if (abortRef.current) return;

        const batchIndices = toGenerate.slice(batch, batch + TTS_CONCURRENCY);
        const results = await Promise.allSettled(
          batchIndices.map(async (chIdx) => {
            const res = await fetch("/api/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: bookForClosure.chapters[chIdx].text,
                voice: DOWNLOAD_VOICE_ID,
              }),
            });
            if (!res.ok) throw new Error("TTS failed");
            const blob = await res.blob();
            const key = audioCacheKey(bookForClosure.id, chIdx, DOWNLOAD_VOICE_ID);
            await setCachedAudio(key, blob);
          })
        );

        for (const r of results) {
          if (r.status === "fulfilled") doneCount++;
        }
        setChaptersDone(doneCount);
      }

      if (abortRef.current) return;

      setPhase("done");
      onComplete(bookForClosure);
    } catch (err) {
      if (abortRef.current) return;
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : "Download failed");
    }
  }, [url, title, author, onComplete]);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      runPipeline();
    }
  }, [runPipeline]);

  const handleCancel = useCallback(() => {
    abortRef.current = true;
    onClose();
  }, [onClose]);

  const progress = chaptersTotal > 0 ? chaptersDone / chaptersTotal : 0;

  return (
    <div className="fixed inset-0 z-[60] bg-dark-bg/95 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Book info */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-100 mb-1">{bookTitle}</h2>
          <p className="text-sm text-gray-500">{bookAuthor}</p>
        </div>

        {/* Progress */}
        {phase === "extracting" && (
          <div className="text-center">
            <svg className="w-8 h-8 text-accent animate-spin mx-auto mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-gray-300">Extracting content...</p>
          </div>
        )}

        {phase === "generating" && (
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-400">Generating audio</span>
              <span className="text-gray-400 tabular-nums">
                Ch {chaptersDone}/{chaptersTotal}
              </span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${Math.max(progress * 100, 2)}%` }}
              />
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-green-300 mb-6">Audiobook ready!</p>
            <button
              onClick={onClose}
              className="w-full py-3 bg-accent hover:bg-accent-light text-dark-bg font-medium rounded-xl transition-colors"
            >
              Go to Library
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-sm text-red-300 mb-2">{errorMsg}</p>
            <button
              onClick={onClose}
              className="w-full py-3 bg-white/10 hover:bg-white/15 text-gray-300 font-medium rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {/* Cancel button (during active phases) */}
        {(phase === "extracting" || phase === "generating") && (
          <button
            onClick={handleCancel}
            className="w-full mt-6 py-3 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
