"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  useLibraryAudio,
  LIBRARY_VOICES,
  SPEED_OPTIONS,
} from "@/components/library/LibraryAudioContext";

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SLEEP_OPTS = [0, 15, 30, 45, 60] as const;

function coverGradient(id: string): string {
  const g = [
    "from-orange-600 to-amber-800",
    "from-blue-600 to-indigo-800",
    "from-emerald-600 to-teal-800",
    "from-rose-600 to-pink-800",
    "from-violet-600 to-purple-800",
    "from-cyan-600 to-sky-800",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return g[Math.abs(h) % g.length];
}

/* ── Draggable Scrubber ───────────────────────────────────── */
function Scrubber({
  progress,
  duration,
  currentTime,
  onSeek,
}: {
  progress: number;
  duration: number;
  currentTime: number;
  onSeek: (t: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragPct, setDragPct] = useState(0);
  const pct = dragging ? dragPct : progress;

  const toPct = useCallback((cx: number) => {
    if (!ref.current) return 0;
    const { left, width } = ref.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (cx - left) / width));
  }, []);

  return (
    <div className="w-full">
      <div
        ref={ref}
        className="relative py-3 cursor-pointer touch-none"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setDragging(true);
          setDragPct(toPct(e.clientX));
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0) setDragPct(toPct(e.clientX));
        }}
        onPointerUp={(e) => {
          const final = toPct(e.clientX);
          if (duration > 0) onSeek(final * duration);
          setDragging(false);
        }}
      >
        <div className="w-full h-1 bg-gray-700 rounded-full">
          <div
            className="h-full bg-accent rounded-full"
            style={{ width: `${pct * 100}%`, transition: dragging ? "none" : "width 0.15s" }}
          />
        </div>
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-accent rounded-full shadow transition-opacity ${
            dragging ? "opacity-100" : "opacity-0"
          }`}
          style={{ left: `${pct * 100}%`, marginLeft: -6 }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-xs text-gray-500 tabular-nums">
          {formatTime(dragging ? dragPct * duration : currentTime)}
        </span>
        <span className="text-xs text-gray-500 tabular-nums">{formatTime(duration)}</span>
      </div>
    </div>
  );
}

/* ── Main Player ──────────────────────────────────────────── */
export default function LibraryAudioPlayer() {
  const {
    isActive,
    isPlaying,
    isLoading,
    bookTitle,
    bookAuthor,
    chapterTitle,
    totalChapters,
    duration,
    currentTime,
    currentChapter,
    currentBookId,
    voice,
    speed,
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
  } = useLibraryAudio();

  const [expanded, setExpanded] = useState(false);
  const [panel, setPanel] = useState<"none" | "voices" | "bookmarks">("none");
  const [isVisible, setIsVisible] = useState(false);
  const [sleepMin, setSleepMin] = useState(0);
  const [sleepLeft, setSleepLeft] = useState(0);
  const sleepRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isActive) requestAnimationFrame(() => setIsVisible(true));
    else {
      setIsVisible(false);
      setExpanded(false);
    }
  }, [isActive]);

  // Sleep timer countdown
  useEffect(() => {
    if (sleepRef.current) clearInterval(sleepRef.current);
    if (sleepLeft <= 0) return;
    sleepRef.current = setInterval(() => {
      setSleepLeft((p) => {
        if (p <= 1) {
          pause();
          setSleepMin(0);
          return 0;
        }
        return p - 1;
      });
    }, 60_000);
    return () => {
      if (sleepRef.current) clearInterval(sleepRef.current);
    };
  }, [sleepLeft, pause]);

  // Lock body scroll when expanded
  useEffect(() => {
    document.body.style.overflow = expanded ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [expanded]);

  const cycleSleep = useCallback(() => {
    const idx = (SLEEP_OPTS as readonly number[]).indexOf(sleepMin);
    const n = SLEEP_OPTS[(idx + 1) % SLEEP_OPTS.length];
    setSleepMin(n);
    setSleepLeft(n);
  }, [sleepMin]);

  const togglePanel = useCallback(
    (p: "voices" | "bookmarks") => setPanel((c) => (c === p ? "none" : p)),
    []
  );

  if (!isActive) return null;

  const progress = duration > 0 ? currentTime / duration : 0;
  const canNext = currentChapter !== null && currentChapter < totalChapters - 1;
  const canPrev = currentChapter !== null && currentChapter > 0;
  const grad = currentBookId ? coverGradient(currentBookId) : "from-orange-600 to-amber-800";

  /* ── Shared button components (44px+ touch targets) ──── */

  const PlayBtn = ({ size }: { size: number }) => (
    <button
      onClick={isPlaying ? pause : resume}
      disabled={isLoading}
      className="rounded-full bg-accent hover:bg-accent-light disabled:opacity-50 transition-all duration-200 flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
      aria-label={isPlaying ? "Pause" : "Play"}
    >
      {isLoading ? (
        <svg className="w-6 h-6 animate-spin" style={{ color: "#1a1a2e" }} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : isPlaying ? (
        <svg className={size >= 56 ? "w-7 h-7" : "w-6 h-6"} fill="currentColor" viewBox="0 0 24 24" style={{ color: "#1a1a2e" }}>
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
        </svg>
      ) : (
        <svg className={`${size >= 56 ? "w-7 h-7" : "w-6 h-6"} ml-0.5`} fill="currentColor" viewBox="0 0 24 24" style={{ color: "#1a1a2e" }}>
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  );

  const SkipBtn = ({ dir }: { dir: "back" | "fwd" }) => (
    <button
      onClick={dir === "back" ? skipBack : skipForward}
      className="w-11 h-11 flex items-center justify-center text-gray-300 hover:text-white active:scale-95 transition-all duration-200"
      aria-label={dir === "back" ? "Back 15 seconds" : "Forward 15 seconds"}
    >
      <div className="relative w-7 h-7">
        <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d={
              dir === "back"
                ? "M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
                : "M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3"
            }
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold mt-0.5">
          15
        </span>
      </div>
    </button>
  );

  const SpeedBtn = () => (
    <button
      onClick={() => {
        const i = SPEED_OPTIONS.indexOf(speed);
        setSpeed(SPEED_OPTIONS[(i + 1) % SPEED_OPTIONS.length]);
      }}
      className="min-w-[44px] h-11 flex items-center justify-center"
      aria-label={`Speed ${speed}x`}
    >
      <span className="text-sm font-semibold text-gray-400 hover:text-accent transition-colors">
        {speed}x
      </span>
    </button>
  );

  const SleepBtn = () => (
    <button
      onClick={cycleSleep}
      className="w-11 h-11 flex items-center justify-center relative"
      aria-label={sleepMin > 0 ? `Sleep in ${sleepLeft}m` : "Sleep timer"}
    >
      <svg
        className={`w-5 h-5 transition-colors ${sleepMin > 0 ? "text-accent" : "text-gray-400 hover:text-gray-200"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
      {sleepMin > 0 && (
        <span className="absolute -top-0.5 -right-0.5 text-[9px] font-bold text-accent">
          {sleepLeft}
        </span>
      )}
    </button>
  );

  /* ═══════════════ EXPANDED FULL-SCREEN VIEW ═══════════════ */
  if (expanded) {
    return (
      <div className="fixed inset-0 z-[60] bg-[#1a1a2e]">
        <div className="h-full overflow-y-auto">
          <div className="min-h-full flex flex-col items-center px-5 pb-10">
            {/* Top bar */}
            <div className="w-full flex items-center justify-between pt-12 pb-2">
              <button
                onClick={() => {
                  setExpanded(false);
                  setPanel("none");
                }}
                className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-gray-200 transition-colors"
                aria-label="Minimize"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                Now Playing
              </p>
              <button
                onClick={() => {
                  close();
                  setExpanded(false);
                }}
                className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-gray-200 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Cover art */}
            <div
              className={`relative w-48 h-48 rounded-2xl bg-gradient-to-br ${grad} shadow-2xl flex items-center justify-center mt-6`}
            >
              <div className="absolute left-0 top-0 bottom-0 w-2 bg-black/20 rounded-l-2xl" />
              <svg
                className="w-16 h-16 text-white/50"
                fill="none"
                stroke="currentColor"
                strokeWidth={1}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>

            {/* Title / Author */}
            <h2 className="text-xl font-bold text-gray-100 text-center leading-tight mt-8 px-4">
              {bookTitle}
            </h2>
            {bookAuthor && (
              <p className="text-[15px] text-gray-500 mt-1 text-center">{bookAuthor}</p>
            )}

            {/* Chapter nav */}
            <div className="flex items-center gap-4 mt-3">
              <button
                onClick={prevChapter}
                disabled={!canPrev}
                className={`w-8 h-8 flex items-center justify-center transition-colors ${
                  canPrev ? "text-gray-400 hover:text-gray-200" : "text-gray-700"
                }`}
                aria-label="Previous chapter"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <p className="text-[13px] text-gray-500">
                {chapterTitle} of {totalChapters}
              </p>
              <button
                onClick={nextChapter}
                disabled={!canNext}
                className={`w-8 h-8 flex items-center justify-center transition-colors ${
                  canNext ? "text-gray-400 hover:text-gray-200" : "text-gray-700"
                }`}
                aria-label="Next chapter"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Scrubber */}
            <div className="w-full mt-8">
              <Scrubber progress={progress} duration={duration} currentTime={currentTime} onSeek={seekTo} />
            </div>

            {/* Primary controls: skip-back, play (56px), skip-forward */}
            <div className="flex items-center justify-center gap-8 mt-6">
              <SkipBtn dir="back" />
              <PlayBtn size={56} />
              <SkipBtn dir="fwd" />
            </div>

            {/* Secondary controls */}
            <div className="flex items-center justify-center gap-6 mt-6">
              <SpeedBtn />
              <button
                onClick={() => togglePanel("bookmarks")}
                className={`w-11 h-11 flex items-center justify-center relative transition-colors ${
                  panel === "bookmarks" ? "text-accent" : "text-gray-400 hover:text-gray-200"
                }`}
                aria-label="Bookmarks"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                {bookmarks.length > 0 && (
                  <span className="absolute top-0.5 -right-0.5 text-[9px] font-bold text-accent">
                    {bookmarks.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => togglePanel("voices")}
                className={`w-11 h-11 flex items-center justify-center transition-colors ${
                  panel === "voices" ? "text-accent" : "text-gray-400 hover:text-gray-200"
                }`}
                aria-label="Voice"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              </button>
            </div>

            {/* Voice panel */}
            {panel === "voices" && (
              <div className="w-full mt-6">
                <div className="flex flex-wrap gap-2 justify-center">
                  {LIBRARY_VOICES.map((v) => (
                    <button
                      key={v.id}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        voice.id === v.id
                          ? "bg-accent/20 text-accent ring-1 ring-accent/40"
                          : "text-gray-300 bg-white/5 hover:bg-white/10"
                      }`}
                      onClick={() => setVoice(v)}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-2 text-center">
                  {voice.desc} — applies on next chapter
                </p>
              </div>
            )}

            {/* Bookmarks panel */}
            {panel === "bookmarks" && (
              <div className="w-full mt-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Bookmarks</p>
                  <button
                    onClick={addBookmark}
                    className="text-xs font-medium text-accent hover:text-accent-light transition-colors"
                  >
                    + Add
                  </button>
                </div>
                {bookmarks.length === 0 ? (
                  <p className="text-sm text-gray-600 text-center py-4">No bookmarks yet</p>
                ) : (
                  <div className="space-y-1">
                    {bookmarks.map((bm) => (
                      <div key={bm.id} className="flex items-center gap-2 py-2 group">
                        <button
                          onClick={() => seekToBookmark(bm)}
                          className="flex-1 text-left text-sm text-gray-300 hover:text-accent transition-colors truncate"
                        >
                          {bm.label}
                        </button>
                        <button
                          onClick={() => removeBookmark(bm.id)}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          aria-label="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════ MINI-PLAYER BAR ═════════════════════════ */
  return (
    <div
      className={`fixed bottom-14 left-0 right-0 z-50 transition-transform duration-300 ease-out ${
        isVisible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div
        className="bg-[#1a1a2e]/95 backdrop-blur-sm border-t border-white/10 shadow-2xl"
        style={{ minHeight: 160 }}
      >
        {/* Info row — tappable to expand */}
        <div className="flex items-start justify-between px-5 pt-4 pb-1">
          <button className="flex-1 min-w-0 mr-3 text-left" onClick={() => setExpanded(true)}>
            <p className="text-sm font-semibold text-gray-100 truncate">{bookTitle}</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {chapterTitle} of {totalChapters}
              {isLoading && " · Loading..."}
            </p>
          </button>
          <button
            onClick={close}
            className="w-11 h-11 -mt-1 -mr-2 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrubber */}
        <div className="px-5">
          <Scrubber progress={progress} duration={duration} currentTime={currentTime} onSeek={seekTo} />
        </div>

        {/* Controls: [speed, voice] [skip, play, skip] [bookmark] */}
        <div className="flex items-center justify-between px-5 pb-3 pt-1">
          <div className="flex items-center">
            <SpeedBtn />
            <button
              onClick={() => setPanel((c) => (c === "voices" ? "none" : "voices"))}
              className={`w-11 h-11 flex items-center justify-center transition-colors ${
                panel === "voices" ? "text-accent" : "text-gray-400 hover:text-gray-200"
              }`}
              aria-label="Voice"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <SkipBtn dir="back" />
            <PlayBtn size={48} />
            <SkipBtn dir="fwd" />
          </div>
          <div className="flex items-center">
            <button
              onClick={addBookmark}
              className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-accent transition-colors"
              aria-label="Bookmark"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Voice picker panel */}
        {panel === "voices" && (
          <div className="px-5 pb-4">
            <div className="flex flex-wrap gap-2">
              {LIBRARY_VOICES.map((v) => (
                <button
                  key={v.id}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    voice.id === v.id
                      ? "bg-accent/20 text-accent ring-1 ring-accent/40"
                      : "text-gray-300 bg-white/5 hover:bg-white/10"
                  }`}
                  onClick={() => setVoice(v)}
                >
                  {v.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {voice.desc} — applies on next chapter
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
