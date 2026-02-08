"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import {
  getCachedAudio,
  setCachedAudio,
  audioCacheKey,
  saveProgress,
  getProgress,
  updateBookLastPlayed,
  saveBookmark,
  getBookmarks,
  deleteBookmark as deleteBookmarkDB,
  type Book,
  type Bookmark,
} from "@/lib/library-db";

const VOICE_KEY = "mornin-library-voice";
const SPEED_KEY = "mornin-library-speed";
const SPEED_OPTIONS = [1, 1.25, 1.5, 1.75, 2] as const;
export type PlaybackSpeed = (typeof SPEED_OPTIONS)[number];
export { SPEED_OPTIONS };
const SILENT_MP3 =
  "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwMHAAAAAAD/+1DEAAAH+AV1UAAAIAAADSAAAABBCQ0Z2QkAALBkDg4sGQOD4ICARB8H38QBAEwfB8HwQdwfygIAgc/lAQBAEAQOD/ygIAgCAIHB///KAgCAIA//5QEAff/+UBAEAf/KAg7///5QEAQB///KD///8oCDv///lAQBAEAQBA5///8=";

export const LIBRARY_VOICES = [
  { id: "en-US-AndrewMultilingualNeural", name: "Andrew", desc: "Male, warm & natural" },
  { id: "en-US-AvaMultilingualNeural", name: "Ava", desc: "Female, smooth & clear" },
  { id: "en-US-BrianMultilingualNeural", name: "Brian", desc: "Male, deep & steady" },
  { id: "en-US-ChristopherNeural", name: "Christopher", desc: "Male, clear" },
  { id: "en-US-JennyNeural", name: "Jenny", desc: "Female, natural" },
  { id: "en-US-AriaNeural", name: "Aria", desc: "Female, expressive" },
  { id: "en-US-GuyNeural", name: "Guy", desc: "Male, calm" },
  { id: "en-GB-SoniaNeural", name: "Sonia", desc: "British female" },
  { id: "en-GB-RyanNeural", name: "Ryan", desc: "British male" },
] as const;

export type LibraryVoice = (typeof LIBRARY_VOICES)[number];

interface LibraryAudioState {
  isActive: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  currentBookId: string | null;
  currentChapter: number | null;
  bookTitle: string;
  chapterTitle: string;
  totalChapters: number;
  duration: number;
  currentTime: number;
  voice: LibraryVoice;
  speed: PlaybackSpeed;
  bookmarks: Bookmark[];
}

interface LibraryAudioContextValue extends LibraryAudioState {
  playChapter: (book: Book, chapterIndex: number) => void;
  pause: () => void;
  resume: () => void;
  nextChapter: () => void;
  prevChapter: () => void;
  skipForward: () => void;
  skipBack: () => void;
  seekTo: (time: number) => void;
  setVoice: (voice: LibraryVoice) => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  addBookmark: () => void;
  removeBookmark: (id: string) => void;
  seekToBookmark: (bookmark: Bookmark) => void;
  close: () => void;
}

const LibraryAudioCtx = createContext<LibraryAudioContextValue | null>(null);

export function useLibraryAudio(): LibraryAudioContextValue {
  const ctx = useContext(LibraryAudioCtx);
  if (!ctx) throw new Error("useLibraryAudio must be used within LibraryAudioProvider");
  return ctx;
}

function loadSavedVoice(): LibraryVoice {
  try {
    const id = localStorage.getItem(VOICE_KEY);
    const found = LIBRARY_VOICES.find((v) => v.id === id);
    return found || LIBRARY_VOICES[0];
  } catch {
    return LIBRARY_VOICES[0];
  }
}

function loadSavedSpeed(): PlaybackSpeed {
  try {
    const s = parseFloat(localStorage.getItem(SPEED_KEY) || "1");
    return (SPEED_OPTIONS as readonly number[]).includes(s) ? (s as PlaybackSpeed) : 1;
  } catch {
    return 1;
  }
}

function formatTimeLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function LibraryAudioProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const [currentChapter, setCurrentChapter] = useState<number | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [totalChapters, setTotalChapters] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [voice, setVoiceState] = useState<LibraryVoice>(LIBRARY_VOICES[0]);
  const [speed, setSpeedState] = useState<PlaybackSpeed>(1);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bookRef = useRef<Book | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLoadingChapterRef = useRef(false);

  // Load saved voice and speed on mount
  useEffect(() => {
    setVoiceState(loadSavedVoice());
    setSpeedState(loadSavedSpeed());
  }, []);

  // Create audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener("durationchange", () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    });

    audio.addEventListener("play", () => setIsPlaying(true));
    audio.addEventListener("pause", () => setIsPlaying(false));

    return () => {
      audio.pause();
      audio.src = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save progress periodically
  useEffect(() => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);

    if (isPlaying && currentBookId && currentChapter !== null) {
      progressTimerRef.current = setInterval(() => {
        const audio = audioRef.current;
        if (!audio) return;
        saveProgress({
          bookId: currentBookId,
          currentChapter: currentChapter,
          currentTime: audio.currentTime,
          completed: false,
        });
      }, 5000);
    }

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isPlaying, currentBookId, currentChapter]);

  // Save progress on visibilitychange and beforeunload
  useEffect(() => {
    const saveNow = () => {
      const audio = audioRef.current;
      if (!audio || !currentBookId || currentChapter === null) return;
      saveProgress({
        bookId: currentBookId,
        currentChapter,
        currentTime: audio.currentTime,
        completed: false,
      });
    };
    const onVisChange = () => {
      if (document.visibilityState === "hidden") saveNow();
    };
    document.addEventListener("visibilitychange", onVisChange);
    window.addEventListener("beforeunload", saveNow);
    return () => {
      document.removeEventListener("visibilitychange", onVisChange);
      window.removeEventListener("beforeunload", saveNow);
    };
  }, [currentBookId, currentChapter]);

  // Dispatch event when library audio starts to pause speechSynthesis
  useEffect(() => {
    if (isPlaying) {
      window.dispatchEvent(new CustomEvent("library-audio-play"));
    }
  }, [isPlaying]);

  // Pre-generate next chapter audio in background
  useEffect(() => {
    if (!isPlaying || currentChapter === null) return;
    const book = bookRef.current;
    if (!book) return;
    const nextIdx = currentChapter + 1;
    if (nextIdx >= book.chapters.length) return;

    const nextChapterData = book.chapters[nextIdx];
    if (!nextChapterData) return;

    const cacheKey = audioCacheKey(book.id, nextIdx, voice.id);

    // Check cache, if missing start pre-fetching
    getCachedAudio(cacheKey).then((cached) => {
      if (cached) return; // already cached
      fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nextChapterData.text, voice: voice.id }),
      })
        .then((res) => (res.ok ? res.blob() : null))
        .then((blob) => {
          if (blob) setCachedAudio(cacheKey, blob);
        })
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentChapter, voice.id]);

  // Listen for speechSynthesis starting — pause library audio
  useEffect(() => {
    const handler = () => {
      audioRef.current?.pause();
    };
    window.addEventListener("speechsynthesis-play", handler);
    return () => window.removeEventListener("speechsynthesis-play", handler);
  }, []);

  const handleChapterEnd = useCallback(() => {
    // Ignore ended events from SILENT_MP3 or during chapter loading
    if (isLoadingChapterRef.current) return;

    const book = bookRef.current;
    if (!book || currentChapter === null) return;

    const nextIdx = currentChapter + 1;
    if (nextIdx < book.chapters.length) {
      // Auto-advance
      loadAndPlayChapter(book, nextIdx);
    } else {
      // Book complete
      saveProgress({
        bookId: book.id,
        currentChapter: book.chapters.length,
        currentTime: 0,
        completed: true,
      });
      setIsPlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChapter]);

  // Update ended handler when currentChapter changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handler = () => handleChapterEnd();
    audio.addEventListener("ended", handler);
    return () => audio.removeEventListener("ended", handler);
  }, [handleChapterEnd]);

  const fetchAudio = useCallback(
    async (text: string, voiceId: string): Promise<Blob> => {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: voiceId }),
      });
      if (!res.ok) throw new Error("TTS failed");
      return res.blob();
    },
    []
  );

  const loadAndPlayChapter = useCallback(
    async (book: Book, chapterIndex: number) => {
      const audio = audioRef.current;
      if (!audio) return;

      const chapter = book.chapters[chapterIndex];
      if (!chapter) return;

      isLoadingChapterRef.current = true;
      setIsLoading(true);
      setCurrentBookId(book.id);
      setCurrentChapter(chapterIndex);
      setBookTitle(book.title);
      setChapterTitle(chapter.title);
      setTotalChapters(book.chapters.length);
      setIsActive(true);
      bookRef.current = book;

      try {
        // iOS audio unlock: play silent audio in user gesture context
        audio.src = SILENT_MP3;
        await audio.play().catch(() => {});

        const cacheKey = audioCacheKey(book.id, chapterIndex, voice.id);
        let blob = await getCachedAudio(cacheKey);

        if (!blob) {
          blob = await fetchAudio(chapter.text, voice.id);
          await setCachedAudio(cacheKey, blob);
        }

        const url = URL.createObjectURL(blob);
        audio.src = url;

        // Try to resume from saved position
        const savedProg = await getProgress(book.id);
        if (
          savedProg &&
          savedProg.currentChapter === chapterIndex &&
          savedProg.currentTime > 0
        ) {
          audio.currentTime = savedProg.currentTime;
        }

        await audio.play();
        await updateBookLastPlayed(book.id);

        // Dispatch mutual exclusion event
        window.dispatchEvent(new CustomEvent("library-audio-play"));
      } catch (err) {
        console.error("Library audio error:", err);
      } finally {
        isLoadingChapterRef.current = false;
        setIsLoading(false);
      }
    },
    [fetchAudio, voice.id]
  );

  const playChapter = useCallback(
    (book: Book, chapterIndex: number) => {
      loadAndPlayChapter(book, chapterIndex);
    },
    [loadAndPlayChapter]
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.play();
  }, []);

  const nextChapter = useCallback(() => {
    const book = bookRef.current;
    if (!book || currentChapter === null) return;
    const nextIdx = currentChapter + 1;
    if (nextIdx < book.chapters.length) {
      loadAndPlayChapter(book, nextIdx);
    }
  }, [currentChapter, loadAndPlayChapter]);

  const prevChapter = useCallback(() => {
    const book = bookRef.current;
    if (!book || currentChapter === null) return;
    const audio = audioRef.current;
    // If past 3 seconds, restart current chapter; otherwise go previous
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
    } else {
      const prevIdx = currentChapter - 1;
      if (prevIdx >= 0) {
        loadAndPlayChapter(book, prevIdx);
      } else {
        if (audio) audio.currentTime = 0;
      }
    }
  }, [currentChapter, loadAndPlayChapter]);

  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
    }
  }, []);

  const skipForward = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = Math.min(audio.currentTime + 15, audio.duration || Infinity);
    }
  }, []);

  const skipBack = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = Math.max(audio.currentTime - 15, 0);
    }
  }, []);

  const setVoice = useCallback((v: LibraryVoice) => {
    setVoiceState(v);
    try {
      localStorage.setItem(VOICE_KEY, v.id);
    } catch {}
  }, []);

  const setSpeed = useCallback((s: PlaybackSpeed) => {
    setSpeedState(s);
    if (audioRef.current) {
      audioRef.current.playbackRate = s;
    }
    try {
      localStorage.setItem(SPEED_KEY, String(s));
    } catch {}
  }, []);

  // Apply speed whenever it changes or audio source changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed, currentChapter]);

  // Load bookmarks when book changes
  useEffect(() => {
    if (currentBookId) {
      getBookmarks(currentBookId).then(setBookmarks).catch(() => {});
    } else {
      setBookmarks([]);
    }
  }, [currentBookId]);

  const addBookmark = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentBookId || currentChapter === null) return;
    const time = audio.currentTime;
    const label = `Ch. ${currentChapter + 1} — ${formatTimeLabel(time)}`;
    const bm: Bookmark = {
      id: crypto.randomUUID(),
      bookId: currentBookId,
      chapterIndex: currentChapter,
      time,
      label,
      createdAt: Date.now(),
    };
    saveBookmark(bm).then(() => {
      setBookmarks((prev) => [...prev, bm]);
    });
  }, [currentBookId, currentChapter]);

  const removeBookmark = useCallback((id: string) => {
    deleteBookmarkDB(id).then(() => {
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
    });
  }, []);

  const seekToBookmark = useCallback(
    (bm: Bookmark) => {
      const book = bookRef.current;
      if (!book) return;
      if (bm.chapterIndex !== currentChapter) {
        // Need to load a different chapter first, then seek
        loadAndPlayChapter(book, bm.chapterIndex).then(() => {
          setTimeout(() => {
            if (audioRef.current) audioRef.current.currentTime = bm.time;
          }, 500);
        });
      } else {
        if (audioRef.current) audioRef.current.currentTime = bm.time;
      }
    },
    [currentChapter, loadAndPlayChapter]
  );

  const close = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
    }
    // Save progress before closing
    if (currentBookId && currentChapter !== null) {
      saveProgress({
        bookId: currentBookId,
        currentChapter,
        currentTime: audio?.currentTime ?? 0,
        completed: false,
      });
    }
    setIsActive(false);
    setIsPlaying(false);
    setCurrentBookId(null);
    setCurrentChapter(null);
    bookRef.current = null;
  }, [currentBookId, currentChapter]);

  // Media Session API — lock screen / notification controls
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (!isActive) {
      navigator.mediaSession.metadata = null;
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: chapterTitle,
      artist: bookTitle,
      album: "Mornin Library",
    });

    navigator.mediaSession.setActionHandler("play", () => audioRef.current?.play());
    navigator.mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
    navigator.mediaSession.setActionHandler("previoustrack", () => prevChapter());
    navigator.mediaSession.setActionHandler("nexttrack", () => nextChapter());
    navigator.mediaSession.setActionHandler("seekbackward", () => skipBack());
    navigator.mediaSession.setActionHandler("seekforward", () => skipForward());

    return () => {
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("seekbackward", null);
        navigator.mediaSession.setActionHandler("seekforward", null);
      }
    };
  }, [isActive, bookTitle, chapterTitle, prevChapter, nextChapter, skipBack, skipForward]);

  const value: LibraryAudioContextValue = {
    isActive,
    isPlaying,
    isLoading,
    currentBookId,
    currentChapter,
    bookTitle,
    chapterTitle,
    totalChapters,
    duration,
    currentTime,
    voice,
    speed,
    playChapter,
    pause,
    resume,
    nextChapter,
    prevChapter,
    skipForward,
    skipBack,
    seekTo,
    setVoice,
    setSpeed,
    bookmarks,
    addBookmark,
    removeBookmark,
    seekToBookmark,
    close,
  };

  return (
    <LibraryAudioCtx.Provider value={value}>{children}</LibraryAudioCtx.Provider>
  );
}
