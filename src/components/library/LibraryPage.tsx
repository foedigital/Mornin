"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getAllBooks,
  addBook,
  deleteBook,
  getProgress,
  getCachedAudio,
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
import readingsData from "../../../data/readings.json";
import AddBookForm from "@/components/library/AddBookForm";
import BookCard, { type DownloadStatus } from "@/components/library/BookCard";
import { useLibraryAudio } from "@/components/library/LibraryAudioContext";
import { preprocessForTTS, aggressiveCleanup } from "@/lib/tts-preprocessor";

const LIBRARY_ARCHIVE_KEY = "mornin-library-archived";

interface ArchivedBook {
  title: string;
  author: string;
  url: string;
  dateArchived: number;
}

function loadArchivedBooks(): ArchivedBook[] {
  try {
    const raw = localStorage.getItem(LIBRARY_ARCHIVE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveArchivedBooks(books: ArchivedBook[]) {
  try {
    localStorage.setItem(LIBRARY_ARCHIVE_KEY, JSON.stringify(books));
  } catch {}
}

interface ImportState {
  active: boolean;
  phase: "extracting" | "audio" | "done";
  total: number;
  done: number;
  failed: number;
  currentTitle: string;
}

const TYPE_PRIORITY: Record<string, number> = {
  poem: 0,
  speech: 1,
  essay: 1,
  "short story": 2,
  philosophy: 3,
  novella: 4,
  "short story collection": 5,
};

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
  const [importState, setImportState] = useState<ImportState | null>(null);
  const importAbortRef = useRef(false);
  const [archivedUrls, setArchivedUrls] = useState<Set<string>>(new Set());

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
    const archived = loadArchivedBooks();
    setArchivedUrls(new Set(archived.map((b) => b.url)));
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
      const toGenerate: number[] = [];
      let alreadyCached = 0;
      for (let i = 0; i < book.chapters.length; i++) {
        const key = audioCacheKey(book.id, i, DOWNLOAD_VOICE_ID);
        const existing = await getCachedAudio(key);
        if (existing) {
          alreadyCached++;
        } else {
          toGenerate.push(i);
        }
      }

      // If all cached already, mark as downloaded
      if (toGenerate.length === 0) {
        setDownloadStatusMap((prev) => ({ ...prev, [bookId]: "downloaded" }));
        setDownloadProgressMap((prev) => { const n = { ...prev }; delete n[bookId]; return n; });
        return;
      }

      let doneCount = alreadyCached;
      setDownloadProgressMap((prev) => ({
        ...prev,
        [bookId]: { done: doneCount, total: book.chapters.length },
      }));

      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 2000;
      const CHAPTER_DELAY_MS = 500;

      try {
        for (const chIdx of toGenerate) {
          if (downloadAbortRef.current[bookId]) break;

          const rawText = book.chapters[chIdx].text;
          const preprocessed = preprocessForTTS(rawText);
          let generated = false;

          // Attempt 1: preprocessed text, up to MAX_RETRIES
          for (let attempt = 1; attempt <= MAX_RETRIES && !generated; attempt++) {
            try {
              const res = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: preprocessed, voice: DOWNLOAD_VOICE_ID }),
              });
              if (!res.ok) throw new Error("TTS failed");
              const blob = await res.blob();
              const key = audioCacheKey(book.id, chIdx, DOWNLOAD_VOICE_ID);
              await setCachedAudio(key, blob);
              generated = true;
            } catch (err) {
              console.warn(`Ch ${chIdx} attempt ${attempt}/${MAX_RETRIES} failed:`, err);
              if (attempt < MAX_RETRIES) {
                await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
              }
            }
          }

          // Attempt 2: aggressive cleanup
          if (!generated) {
            const stripped = aggressiveCleanup(rawText);
            try {
              const res = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: stripped, voice: DOWNLOAD_VOICE_ID }),
              });
              if (res.ok) {
                const blob = await res.blob();
                const key = audioCacheKey(book.id, chIdx, DOWNLOAD_VOICE_ID);
                await setCachedAudio(key, blob);
                generated = true;
              }
            } catch { /* fall through to placeholder */ }
          }

          // Attempt 3: placeholder audio
          if (!generated) {
            const placeholderText = `Chapter ${chIdx + 1} could not be generated. The text may contain content that is not supported by the audio reader. Please read this section in text mode.`;
            try {
              const res = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: placeholderText, voice: DOWNLOAD_VOICE_ID }),
              });
              if (res.ok) {
                const blob = await res.blob();
                const key = audioCacheKey(book.id, chIdx, DOWNLOAD_VOICE_ID);
                await setCachedAudio(key, blob);
              }
            } catch { /* skip entirely */ }
          }

          doneCount++;
          setDownloadProgressMap((prev) => ({
            ...prev,
            [bookId]: { done: doneCount, total: book.chapters.length },
          }));

          // Brief delay between chapters
          if (chIdx !== toGenerate[toGenerate.length - 1]) {
            await new Promise((r) => setTimeout(r, CHAPTER_DELAY_MS));
          }
        }
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
      const storageUsed = await getTotalAudioCacheSize();
      setTotalStorageUsed(storageUsed);
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

  const handleArchive = useCallback((bookId: string) => {
    const book = books.find((b) => b.id === bookId);
    if (!book) return;

    const archived = loadArchivedBooks();
    // Toggle: if already archived, remove it
    if (archived.some((a) => a.url === book.url)) {
      const updated = archived.filter((a) => a.url !== book.url);
      saveArchivedBooks(updated);
      setArchivedUrls(new Set(updated.map((b) => b.url)));
      return;
    }

    archived.push({
      title: book.title,
      author: book.author,
      url: book.url,
      dateArchived: Date.now(),
    });
    saveArchivedBooks(archived);
    setArchivedUrls(new Set(archived.map((b) => b.url)));
  }, [books]);

  const handleImportArchive = useCallback(async () => {
    if (importState?.active) return;
    importAbortRef.current = false;

    // Get existing book URLs to skip duplicates
    const existingBooks = await getAllBooks();
    const existingUrls = new Set(existingBooks.map((b) => b.url));

    // Filter and sort readings by priority (short content first)
    const toImport = (readingsData.readings as { title: string; author: string; type: string; url: string }[])
      .filter((r) => !existingUrls.has(r.url))
      .sort((a, b) => (TYPE_PRIORITY[a.type] ?? 99) - (TYPE_PRIORITY[b.type] ?? 99));

    if (toImport.length === 0) return;

    setImportState({
      active: true,
      phase: "extracting",
      total: toImport.length,
      done: 0,
      failed: 0,
      currentTitle: toImport[0].title,
    });

    // Phase 1: Extract all readings, 3 concurrent
    const EXTRACT_CONCURRENCY = 3;
    const importedBooks: Book[] = [];
    let doneCount = 0;
    let failCount = 0;

    for (let i = 0; i < toImport.length; i += EXTRACT_CONCURRENCY) {
      if (importAbortRef.current) break;

      const batch = toImport.slice(i, i + EXTRACT_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (reading) => {
          const res = await fetch("/api/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: reading.url }),
          });
          if (!res.ok) throw new Error("Extract failed");
          const data = await res.json();
          const book: Book = {
            id: crypto.randomUUID(),
            url: reading.url,
            title: data.title || reading.title,
            author: data.author || reading.author,
            chapters: data.chapters,
            dateAdded: Date.now() - (toImport.indexOf(reading)), // preserve sort order
            lastPlayed: 0,
          };
          await addBook(book);
          return book;
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          importedBooks.push(r.value);
          doneCount++;
          // Add to UI immediately
          setBooks((prev) => {
            if (prev.some((b) => b.url === r.value.url)) return prev;
            return [r.value, ...prev];
          });
          setDownloadStatusMap((prev) => ({ ...prev, [r.value.id]: "none" }));
        } else {
          failCount++;
          doneCount++;
        }
      }

      const nextTitle = i + EXTRACT_CONCURRENCY < toImport.length
        ? toImport[i + EXTRACT_CONCURRENCY].title
        : "";
      setImportState({
        active: true,
        phase: "extracting",
        total: toImport.length,
        done: doneCount,
        failed: failCount,
        currentTitle: nextTitle,
      });
    }

    if (importAbortRef.current || importedBooks.length === 0) {
      setImportState(null);
      return;
    }

    // Phase 2: Pre-generate Ch.1 audio one at a time
    setImportState({
      active: true,
      phase: "audio",
      total: importedBooks.length,
      done: 0,
      failed: failCount,
      currentTitle: importedBooks[0].title,
    });

    let audioDone = 0;
    for (const book of importedBooks) {
      if (importAbortRef.current) break;
      if (!book.chapters[0]) continue;

      setImportState((prev) => prev ? { ...prev, currentTitle: book.title, done: audioDone } : prev);

      try {
        const preprocessed = preprocessForTTS(book.chapters[0].text);
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: preprocessed,
            voice: DOWNLOAD_VOICE_ID,
          }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const key = audioCacheKey(book.id, 0, DOWNLOAD_VOICE_ID);
          await setCachedAudio(key, blob);
        }
      } catch {
        // Non-critical, skip
      }
      audioDone++;
      setImportState((prev) => prev ? { ...prev, done: audioDone } : prev);
    }

    setImportState({ active: false, phase: "done", total: toImport.length, done: doneCount, failed: failCount, currentTitle: "" });
    // Auto-dismiss after 5 seconds
    setTimeout(() => setImportState(null), 5000);

    // Refresh storage stats
    const storageUsed = await getTotalAudioCacheSize();
    setTotalStorageUsed(storageUsed);
  }, [importState]);

  const handleCancelImport = useCallback(() => {
    importAbortRef.current = true;
    setImportState(null);
  }, []);

  // Count importable readings
  const importableCount = loaded
    ? readingsData.readings.filter(
        (r) => !books.some((b) => b.url === r.url)
      ).length
    : 0;

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

      {/* Import from archive */}
      {importState?.active ? (
        <div className="card mb-6 border border-accent/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-accent animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm font-medium text-gray-200">
                {importState.phase === "extracting"
                  ? "Importing books..."
                  : "Pre-generating audio..."}
              </span>
            </div>
            <button
              onClick={handleCancelImport}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${Math.max((importState.done / importState.total) * 100, 2)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="truncate mr-2">{importState.currentTitle}</span>
            <span className="flex-shrink-0">
              {importState.done}/{importState.total}
              {importState.failed > 0 && (
                <span className="text-red-400 ml-1">({importState.failed} failed)</span>
              )}
            </span>
          </div>
        </div>
      ) : importState?.phase === "done" ? (
        <div className="card mb-6 border border-green-500/20">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-green-300">
              Library ready! {importState.done - importState.failed} books imported.
              {importState.failed > 0 && ` (${importState.failed} failed)`}
            </span>
          </div>
        </div>
      ) : importableCount > 0 ? (
        <button
          onClick={handleImportArchive}
          className="w-full card mb-6 flex items-center justify-center gap-2 py-3 text-sm text-accent hover:bg-white/5 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import {importableCount} books from Reading Archive
        </button>
      ) : null}

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
              onArchive={handleArchive}
              isArchived={archivedUrls.has(book.url)}
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
