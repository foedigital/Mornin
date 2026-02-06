"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useTTSContext } from "@/components/TTSContext";
import { formatTime } from "@/lib/tts-utils";

export default function AudioPlayerBar() {
  const { isActive, title, author, state, playPause, skipForward, skipBackward, seekTo, setVoice, close, stop } =
    useTTSContext();

  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Animate slide-up
  useEffect(() => {
    if (isActive) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isActive]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressBarRef.current) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seekTo(progress);
    },
    [seekTo]
  );

  const handleClose = useCallback(() => {
    stop();
    close();
  }, [stop, close]);

  if (!isActive) return null;

  const disableSkip = state.totalChunks < 10;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out ${
        isVisible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="bg-gray-900/95 backdrop-blur-sm border-t border-white/10 shadow-2xl">
        {/* Progress bar */}
        <div
          ref={progressBarRef}
          className="w-full h-1.5 bg-gray-700 cursor-pointer group"
          onClick={handleProgressClick}
          role="progressbar"
          aria-valuenow={Math.round(state.progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Playback progress"
        >
          <div
            className="h-full bg-accent transition-all duration-150 group-hover:bg-accent-light"
            style={{ width: `${state.progress * 100}%` }}
          />
        </div>

        <div className="px-4 py-3">
          {/* Title + close */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1 min-w-0 mr-3">
              <p className="text-sm font-medium text-gray-100 truncate">{title}</p>
              <p className="text-xs text-gray-400 truncate">{author}</p>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0"
              aria-label="Close audio player"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 w-10 text-left tabular-nums">
              {formatTime(state.elapsedTime)}
            </span>

            <div className="flex items-center gap-4">
              {/* Skip back */}
              <button
                onClick={skipBackward}
                disabled={disableSkip}
                className={`p-1.5 transition-colors ${
                  disableSkip ? "text-gray-700 cursor-not-allowed" : "text-gray-400 hover:text-gray-200"
                }`}
                aria-label="Skip backward 15 seconds"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                </svg>
              </button>

              {/* Play/Pause */}
              <button
                onClick={playPause}
                className="w-10 h-10 rounded-full bg-accent hover:bg-accent-light transition-colors flex items-center justify-center"
                aria-label={state.isPlaying && !state.isPaused ? "Pause" : "Play"}
              >
                {state.isPlaying && !state.isPaused ? (
                  <svg className="w-5 h-5 text-dark-bg" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-dark-bg ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Skip forward */}
              <button
                onClick={skipForward}
                disabled={disableSkip}
                className={`p-1.5 transition-colors ${
                  disableSkip ? "text-gray-700 cursor-not-allowed" : "text-gray-400 hover:text-gray-200"
                }`}
                aria-label="Skip forward 15 seconds"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-10 text-right tabular-nums">
                {formatTime(state.totalTime)}
              </span>
              {state.availableVoices.length > 1 && (
                <button
                  onClick={() => setShowVoiceSelector((v) => !v)}
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
              )}
            </div>
          </div>
        </div>

        {/* Voice selector */}
        {showVoiceSelector && (
          <div className="px-4 pb-3 max-h-48 overflow-y-auto border-t border-white/5">
            <p className="text-xs text-gray-500 uppercase tracking-wider py-2">Voice</p>
            {state.availableVoices.map((voice) => (
              <button
                key={voice.name}
                className={`block w-full text-left text-sm py-2 px-3 rounded-lg transition-colors ${
                  state.selectedVoice?.name === voice.name
                    ? "bg-accent/20 text-accent"
                    : "text-gray-300 hover:bg-white/5"
                }`}
                onClick={() => {
                  setVoice(voice);
                  setShowVoiceSelector(false);
                }}
              >
                {voice.name}
                {voice.lang && <span className="text-xs text-gray-500 ml-2">{voice.lang}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
