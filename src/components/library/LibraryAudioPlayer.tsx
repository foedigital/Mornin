"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useLibraryAudio, LIBRARY_VOICES } from "@/components/library/LibraryAudioContext";

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function LibraryAudioPlayer() {
  const {
    isActive,
    isPlaying,
    isLoading,
    bookTitle,
    chapterTitle,
    totalChapters,
    duration,
    currentTime,
    currentChapter,
    voice,
    pause,
    resume,
    nextChapter,
    prevChapter,
    seekTo,
    setVoice,
    close,
  } = useLibraryAudio();

  const [showVoices, setShowVoices] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isActive]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || !duration) return;
      const rect = progressRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seekTo(pct * duration);
    },
    [seekTo, duration]
  );

  if (!isActive) return null;

  const progress = duration > 0 ? currentTime / duration : 0;
  const canNext = currentChapter !== null && currentChapter < totalChapters - 1;

  return (
    <div
      className={`fixed bottom-14 left-0 right-0 z-50 transition-transform duration-300 ease-out ${
        isVisible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="bg-dark-card/95 backdrop-blur-sm border-t border-white/10 shadow-2xl">
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="w-full h-1.5 bg-gray-700 cursor-pointer group"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-accent transition-all duration-150 group-hover:bg-accent-light"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="px-4 py-3">
          {/* Title + close */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1 min-w-0 mr-3">
              <p className="text-sm font-medium text-gray-100 truncate">{bookTitle}</p>
              <p className="text-xs text-gray-400 truncate">
                {chapterTitle} of {totalChapters}
                {isLoading && " · Loading..."}
              </p>
            </div>
            <button
              onClick={close}
              className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0"
              aria-label="Close player"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 w-10 text-left tabular-nums">
              {formatTime(currentTime)}
            </span>

            <div className="flex items-center gap-4">
              {/* Prev chapter */}
              <button
                onClick={prevChapter}
                className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors"
                aria-label="Previous chapter"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                </svg>
              </button>

              {/* Play/Pause */}
              <button
                onClick={isPlaying ? pause : resume}
                disabled={isLoading}
                className="w-10 h-10 rounded-full bg-accent hover:bg-accent-light disabled:opacity-50 transition-colors flex items-center justify-center"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isLoading ? (
                  <svg className="w-5 h-5 text-dark-bg animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : isPlaying ? (
                  <svg className="w-5 h-5 text-dark-bg" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-dark-bg ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Next chapter */}
              <button
                onClick={nextChapter}
                disabled={!canNext}
                className={`p-1.5 transition-colors ${
                  canNext ? "text-gray-400 hover:text-gray-200" : "text-gray-700 cursor-not-allowed"
                }`}
                aria-label="Next chapter"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-10 text-right tabular-nums">
                {formatTime(duration)}
              </span>
              <button
                onClick={() => setShowVoices((v) => !v)}
                className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Select voice"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Voice selector */}
        {showVoices && (
          <div className="px-4 pb-3 border-t border-white/5">
            <p className="text-xs text-gray-500 uppercase tracking-wider py-2">Voice</p>
            {LIBRARY_VOICES.map((v) => (
              <button
                key={v.id}
                className={`block w-full text-left text-sm py-2 px-3 rounded-lg transition-colors ${
                  voice.id === v.id
                    ? "bg-accent/20 text-accent"
                    : "text-gray-300 hover:bg-white/5"
                }`}
                onClick={() => {
                  setVoice(v);
                  setShowVoices(false);
                }}
              >
                {v.name}
                <span className="text-xs text-gray-500 ml-2">{v.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
