import {
  getAllBooks,
  getAllProgress,
  getAllBookmarks,
  addBook,
  saveProgress,
  saveBookmark,
  type Book,
  type BookProgress,
  type Bookmark,
} from "@/lib/library-db";

// --- localStorage keys to sync ---

const SYNCED_LS_KEYS = [
  "mornin-recipes-saved",
  "mornin-fitness-saved",
  "mornin-converted-audiobooks",
  "mornin-library-archived",
  "mornin-readings-completed",
  "mornin-readings-hidden",
  "mornin-library-voice",
  "mornin-library-speed",
] as const;

const SENTINEL_KEY = "mornin-sync-initialized";

// --- Types ---

interface SyncSnapshot {
  version: 1;
  timestamp: number;
  localStorage: Record<string, string>;
  indexedDB: {
    books: Book[];
    progress: BookProgress[];
    bookmarks: Bookmark[];
  };
}

// --- Collect all data ---

async function collectAllData(): Promise<SyncSnapshot> {
  const lsData: Record<string, string> = {};
  for (const key of SYNCED_LS_KEYS) {
    const val = localStorage.getItem(key);
    if (val !== null) lsData[key] = val;
  }

  const [books, progress, bookmarks] = await Promise.all([
    getAllBooks(),
    getAllProgress(),
    getAllBookmarks(),
  ]);

  return {
    version: 1,
    timestamp: Date.now(),
    localStorage: lsData,
    indexedDB: { books, progress, bookmarks },
  };
}

// --- Compress / Decompress via CompressionStream ---

async function compress(data: string): Promise<Blob> {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
}

async function decompress(blob: Blob): Promise<string> {
  const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

// --- Upload / Download ---

async function uploadSnapshot(snapshot: SyncSnapshot): Promise<boolean> {
  try {
    const json = JSON.stringify(snapshot);
    const compressed = await compress(json);
    const res = await fetch("/api/sync?userId=default", {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: compressed,
    });
    return res.ok;
  } catch (err) {
    console.warn("[cloud-sync] Upload failed:", err);
    return false;
  }
}

async function downloadSnapshot(): Promise<SyncSnapshot | null> {
  try {
    const res = await fetch("/api/sync?userId=default");
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const blob = await res.blob();
    const json = await decompress(blob);
    return JSON.parse(json) as SyncSnapshot;
  } catch (err) {
    console.warn("[cloud-sync] Download failed:", err);
    return null;
  }
}

// --- Restore from cloud ---

async function restoreFromCloud(snapshot: SyncSnapshot): Promise<void> {
  // Restore localStorage
  for (const [key, value] of Object.entries(snapshot.localStorage)) {
    localStorage.setItem(key, value);
  }

  // Restore IndexedDB
  const { books, progress, bookmarks } = snapshot.indexedDB;
  for (const book of books) {
    await addBook(book);
  }
  for (const prog of progress) {
    await saveProgress(prog);
  }
  for (const bm of bookmarks) {
    await saveBookmark(bm);
  }
}

// --- Public API ---

/** Check if this is a fresh install (no sentinel) and restore from cloud if backup exists */
export async function restoreIfNeeded(): Promise<boolean> {
  if (localStorage.getItem(SENTINEL_KEY)) return false;

  const snapshot = await downloadSnapshot();
  if (snapshot) {
    await restoreFromCloud(snapshot);
  }
  localStorage.setItem(SENTINEL_KEY, String(Date.now()));
  return !!snapshot;
}

/** Trigger a sync now (collects data and uploads) */
export async function syncNow(): Promise<boolean> {
  const snapshot = await collectAllData();
  return uploadSnapshot(snapshot);
}

// --- Debounced scheduler ---

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSync = false;

const DEBOUNCE_MS = 5000;
const MAX_WAIT_MS = 30000;

function doSync() {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (maxWaitTimer) clearTimeout(maxWaitTimer);
  debounceTimer = null;
  maxWaitTimer = null;
  pendingSync = false;
  syncNow().then((ok) => {
    if (!ok) console.warn("[cloud-sync] Sync failed");
  });
}

export function scheduleSyncOnChange() {
  // Reset debounce timer
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(doSync, DEBOUNCE_MS);

  // Start max-wait timer on first pending change
  if (!pendingSync) {
    pendingSync = true;
    maxWaitTimer = setTimeout(doSync, MAX_WAIT_MS);
  }
}

/** Start listening for mornin-data-changed events */
export function startSyncListener(): () => void {
  const handler = () => scheduleSyncOnChange();
  window.addEventListener("mornin-data-changed", handler);

  // Also sync on page hide (user leaving / app backgrounding)
  const visHandler = () => {
    if (document.visibilityState === "hidden" && pendingSync) {
      doSync();
    }
  };
  document.addEventListener("visibilitychange", visHandler);

  return () => {
    window.removeEventListener("mornin-data-changed", handler);
    document.removeEventListener("visibilitychange", visHandler);
    if (debounceTimer) clearTimeout(debounceTimer);
    if (maxWaitTimer) clearTimeout(maxWaitTimer);
  };
}

/** Dispatch the data-changed event (convenience for components) */
export function notifyDataChanged() {
  window.dispatchEvent(new Event("mornin-data-changed"));
}
