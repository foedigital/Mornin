"use client";

import { useEffect, useState, useCallback } from "react";
import { getAllBooks, deleteBook, getProgress, type Book, type BookProgress } from "@/lib/library-db";
import AddBookForm from "@/components/library/AddBookForm";
import BookCard from "@/components/library/BookCard";
import { useLibraryAudio } from "@/components/library/LibraryAudioContext";

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, BookProgress>>({});
  const [loaded, setLoaded] = useState(false);

  const { currentBookId, currentChapter, playChapter } = useLibraryAudio();

  const loadBooks = useCallback(async () => {
    const allBooks = await getAllBooks();
    setBooks(allBooks);

    const progMap: Record<string, BookProgress> = {};
    for (const book of allBooks) {
      const prog = await getProgress(book.id);
      if (prog) progMap[book.id] = prog;
    }
    setProgressMap(progMap);
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
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await deleteBook(id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
    setProgressMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handlePlayChapter = useCallback(
    (bookId: string, chapterIndex: number) => {
      const book = books.find((b) => b.id === bookId);
      if (!book) return;
      playChapter(book, chapterIndex);
    },
    [books, playChapter]
  );

  if (!loaded) return null;

  return (
    <main className="min-h-screen px-4 py-8 pb-36 max-w-lg mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-100">Library</h1>
        <p className="text-gray-500 text-sm mt-1">Paste any URL to listen as an audiobook</p>
      </header>

      <AddBookForm onBookAdded={handleBookAdded} />

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
            />
          ))}
        </div>
      )}
    </main>
  );
}
