"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getAllBooks,
  deleteBook,
  getProgress,
  getBookCachedChapterCount,
  getTotalAudioCacheSize,
  getBookAudioCacheSize,
  deleteBookAudioCache,
  setCachedAudio,
  audioCacheKey,
  DOWNLOAD_VOICE_ID,
  MAX_DOWNLOAD_BYTES,
  type Book,
  type BookProgress,
} from "@/lib/library-db";
import AddBookForm from "@/components/library/AddBookForm";
import BookCard, { type DownloadStatus } from "@/components/library/BookCard";
import { useLibraryAudio } from "@/components/library/LibraryAudioContext";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, BookProgress>>({});
  const [loaded, setLoaded] = useState(false);
  const [downloadStatusMap, setDownloadStatusMap] = useState<Record<string, DownloadStatus>>({});
  const [downloadProgressMap, setDownloadProgressMap] = useState<Record<string, { done: number; total: number }>>({});
  const [totalStorageUsed, setTotalStorageUsed] = useState(0);
  const [bookSizeMap, setBookSizeMap] = useState<Record<string, number>>({});
  const downloadAbortRef = useRef<Record<string, boolean>>({});

  const { currentBookId, currentChapter, playChapter } = useLibraryAudio();

  const loadBooks = useCallback(async () => {
    const allBooks = await getAllBooks();
    setBooks(allBooks);

    const progMap: Record<string, BookProgress> = {};
    const dlMap: Record<string, DownloadStatus> = {};
    const sizeMap: Record<string, number> = {};
    for (const book of allBooks) {
      const prog = await getProgress(book.id);
      if (prog) progMap[book.id] = prog;

      const cached = await getBookCachedChapterCount(book.id, book.chapters.length);
      dlMap[book.id] = cached >= book.chapters.length ? "downloaded" : "none";

      const size = await getBookAudioCacheSize(book.id);
      sizeMap[book.id] = size;
    }
    setProgressMap(progMap);
    setDownloadStatusMap(dlMap);
    setBookSizeMap(sizeMap);

    const storageUsed = await getTotalAudioCacheSize();
    setTotalStorageUsed(storageUsed);
    setLoaded(true);
  }, []);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  // Reload progress periodically when audio is playing
  useEffect(() => {
    if (!currentBookId) return;
    const interval = setInterval(async () => {
      const prog = await getProgress(currentBookId);
      if (prog) {
        setProgressMap((prev) => ({ ...prev, [currentBookId]: prog }));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [currentBookId]);

  const handleBookAdded = useCallback((book: Book) => {
    setBooks((prev) => [book, ...prev]);
    setDownloadStatusMap((prev) => ({ ...prev, [book.id]: "none" }));
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    downloadAbortRef.current[id] = true;
    await deleteBook(id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
    setProgressMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setDownloadStatusMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    const storageUsed = await getTotalAudioCacheSize();
    setTotalStorageUsed(storageUsed);
  }, []);

  const handlePlayChapter = useCallback(
    (bookId: string, chapterIndex: number) => {
      const book = books.find((b) => b.id === bookId);
      if (!book) return;
      playChapter(book, chapterIndex);
    },
    [books, playChapter]
  );

  const handleDownload = useCallback(
    async (bookId: string) => {
      const book = books.find((b) => b.id === bookId);
      if (!book) return;

      if (totalStorageUsed >= MAX_DOWNLOAD_BYTES) {
        alert(`Storage limit reached (${formatBytes(MAX_DOWNLOAD_BYTES)}). Remove some downloads to free space.`);
        return;
      }

      downloadAbortRef.current[bookId] = false;
      setDownloadStatusMap((prev) => ({ ...prev, [bookId]: "downloading" }));
      setDownloadProgressMap((prev) => ({ ...prev, [bookId]: { done: 0, total: book.chapters.length } }));

      // Check which chapters are already cached
      const { getCachedAudio } = await import("@/lib/library-db");
      const skipIndices: number[] = [];
      for (let i = 0; i < book.chapters.length; i++) {
        const key = audioCacheKey(book.id, i, DOWNLOAD_VOICE_ID);
        const existing = await getCachedAudio(key);
        if (existing) skipIndices.push(i);
      }

      // If all cached already, mark as downloaded
      if (skipIndices.length >= book.chapters.length) {
        setDownloadStatusMap((prev) => ({ ...prev, [bookId]: "downloaded" }));
        setDownloadProgressMap((prev) => { const n = { ...prev }; delete n[bookId]; return n; });
        return;
      }

      setDownloadProgressMap((prev) => ({
        ...prev,
        [bookId]: { done: skipIndices.length, total: book.chapters.length },
      }));

      try {
        // Single batch request — all chapters processed server-side in parallel
        const res = await fetch("/api/tts-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texts: book.chapters.map((ch) => ch.text),
            voice: DOWNLOAD_VOICE_ID,
            skip: skipIndices,
          }),
        });

        if (!res.ok) throw new Error("Batch TTS failed");
        const data = await res.json();
        const chapters: (string | null)[] = data.chapters;

        // Store each chapter's audio in IndexedDB
        let runningStorage = totalStorageUsed;
        let storedCount = skipIndices.length;

        for (let i = 0; i < chapters.length; i++) {
          if (downloadAbortRef.current[bookId]) break;
          if (!chapters[i]) {
            if (skipIndices.includes(i)) storedCount = storedCount; // already counted
            continue;
          }

          if (runningStorage >= MAX_DOWNLOAD_BYTES) break;

          const binary = atob(chapters[i]!);
          const bytes = new Uint8Array(binary.length);
          for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
          const blob = new Blob([bytes], { type: "audio/mpeg" });

          const cacheKey = audioCacheKey(book.id, i, DOWNLOAD_VOICE_ID);
          await setCachedAudio(cacheKey, blob);
          runningStorage += blob.size;
          storedCount++;

          setDownloadProgressMap((prev) => ({
            ...prev,
            [bookId]: { done: storedCount, total: book.chapters.length },
          }));
        }

        setTotalStorageUsed(runningStorage);
      } catch (err) {
        console.error("Download failed:", err);
      }

      // Check final status
      const finalCached = await getBookCachedChapterCount(bookId, book.chapters.length);
      setDownloadStatusMap((prev) => ({
        ...prev,
        [bookId]: finalCached >= book.chapters.length ? "downloaded" : "none",
      }));
      setDownloadProgressMap((prev) => {
        const next = { ...prev };
        delete next[bookId];
        return next;
      });
      const bookSize = await getBookAudioCacheSize(bookId);
      setBookSizeMap((prev) => ({ ...prev, [bookId]: bookSize }));
    },
    [books, totalStorageUsed]
  );

  const handleRemoveDownload = useCallback(async (bookId: string) => {
    downloadAbortRef.current[bookId] = true;
    const freed = await deleteBookAudioCache(bookId);
    setDownloadStatusMap((prev) => ({ ...prev, [bookId]: "none" }));
    setBookSizeMap((prev) => ({ ...prev, [bookId]: 0 }));
    setTotalStorageUsed((prev) => Math.max(0, prev - freed));
  }, []);

  if (!loaded) return null;

  const storagePercent = Math.min(100, (totalStorageUsed / MAX_DOWNLOAD_BYTES) * 100);
  const downloadedCount = Object.values(downloadStatusMap).filter((s) => s === "downloaded").length;

  return (
    <main className="min-h-screen px-4 py-8 pb-36 max-w-lg mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-100">Library</h1>
        <p className="text-gray-500 text-sm mt-1">Paste any URL to listen as an audiobook</p>
      </header>

      <AddBookForm onBookAdded={handleBookAdded} />

      {/* Storage bar */}
      {books.length > 0 && (
        <div className="mb-4 px-1">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>
              {formatBytes(totalStorageUsed)} / {formatBytes(MAX_DOWNLOAD_BYTES)}
            </span>
            <span>
              {downloadedCount} downloaded
            </span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                storagePercent > 90 ? "bg-red-500" : storagePercent > 70 ? "bg-amber-500" : "bg-green-500"
              }`}
              style={{ width: `${Math.max(storagePercent, 0.5)}%` }}
            />
          </div>
        </div>
      )}

      {books.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-16 h-16 text-gray-700 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-gray-500 text-sm">Your library is empty</p>
          <p className="text-gray-600 text-xs mt-1">Add a URL above to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              progress={progressMap[book.id] ?? null}
              onDelete={handleDelete}
              onPlayChapter={handlePlayChapter}
              currentlyPlayingBookId={currentBookId}
              currentlyPlayingChapter={currentChapter}
              downloadStatus={downloadStatusMap[book.id] ?? "none"}
              downloadProgress={downloadProgressMap[book.id] ?? null}
              onDownload={handleDownload}
              onRemoveDownload={handleRemoveDownload}
              storageSize={bookSizeMap[book.id] ?? 0}
            />
          ))}
        </div>
      )}
    </main>
  );
}
