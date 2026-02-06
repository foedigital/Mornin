import { openDB, type IDBPDatabase } from "idb";
import type { Chapter } from "@/lib/chunker";

const DB_NAME = "mornin-library";
const DB_VERSION = 1;

export interface Book {
  id: string;
  url: string;
  title: string;
  author: string;
  chapters: Chapter[];
  dateAdded: number;
  lastPlayed: number;
}

export interface BookProgress {
  bookId: string;
  currentChapter: number;
  currentTime: number;
  completed: boolean;
}

interface LibraryDB {
  books: {
    key: string;
    value: Book;
    indexes: { "by-date": number };
  };
  audioCache: {
    key: string;
    value: { key: string; blob: Blob };
  };
  progress: {
    key: string;
    value: BookProgress;
  };
}

let dbPromise: Promise<IDBPDatabase<LibraryDB>> | null = null;

function getDB(): Promise<IDBPDatabase<LibraryDB>> {
  if (!dbPromise) {
    dbPromise = openDB<LibraryDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const bookStore = db.createObjectStore("books", { keyPath: "id" });
        bookStore.createIndex("by-date", "dateAdded");
        db.createObjectStore("audioCache", { keyPath: "key" });
        db.createObjectStore("progress", { keyPath: "bookId" });
      },
    });
  }
  return dbPromise;
}

// --- Books ---

export async function addBook(book: Book): Promise<void> {
  const db = await getDB();
  await db.put("books", book);
}

export async function getBook(id: string): Promise<Book | undefined> {
  const db = await getDB();
  return db.get("books", id);
}

export async function getAllBooks(): Promise<Book[]> {
  const db = await getDB();
  const books = await db.getAll("books");
  return books.sort((a, b) => b.dateAdded - a.dateAdded);
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("books", id);
  // Clean up audio cache for this book
  const tx = db.transaction("audioCache", "readwrite");
  const store = tx.objectStore("audioCache");
  const allKeys = await store.getAllKeys();
  for (const key of allKeys) {
    if (typeof key === "string" && key.startsWith(`${id}-`)) {
      await store.delete(key);
    }
  }
  await tx.done;
  // Clean up progress
  await db.delete("progress", id);
}

export async function updateBookLastPlayed(id: string): Promise<void> {
  const db = await getDB();
  const book = await db.get("books", id);
  if (book) {
    book.lastPlayed = Date.now();
    await db.put("books", book);
  }
}

// --- Audio Cache ---

export function audioCacheKey(bookId: string, chapterIndex: number): string {
  return `${bookId}-${chapterIndex}`;
}

export async function getCachedAudio(key: string): Promise<Blob | null> {
  const db = await getDB();
  const entry = await db.get("audioCache", key);
  return entry?.blob ?? null;
}

export async function setCachedAudio(key: string, blob: Blob): Promise<void> {
  const db = await getDB();
  await db.put("audioCache", { key, blob });
}

// --- Progress ---

export async function getProgress(bookId: string): Promise<BookProgress | undefined> {
  const db = await getDB();
  return db.get("progress", bookId);
}

export async function saveProgress(progress: BookProgress): Promise<void> {
  const db = await getDB();
  await db.put("progress", progress);
}
