import { openDB, type IDBPDatabase } from "idb";
import type { Chapter } from "@/lib/chunker";

const DB_NAME = "mornin-library";
const DB_VERSION = 2;

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

export interface Bookmark {
  id: string;
  bookId: string;
  chapterIndex: number;
  time: number;
  label: string;
  createdAt: number;
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
  bookmarks: {
    key: string;
    value: Bookmark;
    indexes: { "by-book": string };
  };
}

let dbPromise: Promise<IDBPDatabase<LibraryDB>> | null = null;

function getDB(): Promise<IDBPDatabase<LibraryDB>> {
  if (!dbPromise) {
    dbPromise = openDB<LibraryDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const bookStore = db.createObjectStore("books", { keyPath: "id" });
          bookStore.createIndex("by-date", "dateAdded");
          db.createObjectStore("audioCache", { keyPath: "key" });
          db.createObjectStore("progress", { keyPath: "bookId" });
        }
        if (oldVersion < 2) {
          const bmStore = db.createObjectStore("bookmarks", { keyPath: "id" });
          bmStore.createIndex("by-book", "bookId");
        }
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

export async function updateBookMeta(id: string, title: string, author: string): Promise<void> {
  const db = await getDB();
  const book = await db.get("books", id);
  if (book) {
    book.title = title;
    book.author = author;
    await db.put("books", book);
  }
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

export function audioCacheKey(bookId: string, chapterIndex: number, voiceId?: string): string {
  if (voiceId) {
    return `${bookId}-${chapterIndex}-${voiceId}`;
  }
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

// --- Downloads ---

export const DOWNLOAD_VOICE_ID = "en-US-SteffanNeural";
export const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024 * 1024; // 20 GB

/** Count how many chapters of a book are cached for the download voice */
export async function getBookCachedChapterCount(bookId: string, totalChapters: number): Promise<number> {
  const db = await getDB();
  let count = 0;
  for (let i = 0; i < totalChapters; i++) {
    const key = audioCacheKey(bookId, i, DOWNLOAD_VOICE_ID);
    const entry = await db.get("audioCache", key);
    if (entry) count++;
  }
  return count;
}

/** Get total size of all cached audio blobs in bytes */
export async function getTotalAudioCacheSize(): Promise<number> {
  const db = await getDB();
  const tx = db.transaction("audioCache", "readonly");
  const store = tx.objectStore("audioCache");
  let totalSize = 0;
  let cursor = await store.openCursor();
  while (cursor) {
    totalSize += cursor.value.blob.size;
    cursor = await cursor.continue();
  }
  return totalSize;
}

/** Get total cached audio size for a specific book in bytes */
export async function getBookAudioCacheSize(bookId: string): Promise<number> {
  const db = await getDB();
  const tx = db.transaction("audioCache", "readonly");
  const store = tx.objectStore("audioCache");
  const allKeys = await store.getAllKeys();
  let size = 0;
  for (const key of allKeys) {
    if (typeof key === "string" && key.startsWith(`${bookId}-`)) {
      const entry = await store.get(key);
      if (entry) size += entry.blob.size;
    }
  }
  return size;
}

/** Delete all cached audio for a book (all voices). Returns bytes freed. */
export async function deleteBookAudioCache(bookId: string): Promise<number> {
  const db = await getDB();
  const tx = db.transaction("audioCache", "readwrite");
  const store = tx.objectStore("audioCache");
  const allKeys = await store.getAllKeys();
  let freedBytes = 0;
  for (const key of allKeys) {
    if (typeof key === "string" && key.startsWith(`${bookId}-`)) {
      const entry = await store.get(key);
      if (entry) freedBytes += entry.blob.size;
      await store.delete(key);
    }
  }
  await tx.done;
  return freedBytes;
}

// --- Bookmarks ---

export async function saveBookmark(bookmark: Bookmark): Promise<void> {
  const db = await getDB();
  await db.put("bookmarks", bookmark);
}

export async function getBookmarks(bookId: string): Promise<Bookmark[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("bookmarks", "by-book", bookId);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteBookmark(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("bookmarks", id);
}
