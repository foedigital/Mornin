"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export default function WhiteNoisePlayer() {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio("/api/brown-noise");
    audio.loop = true;
    audio.volume = 0.55;
    audio.preload = "auto";
    audioRef.current = audio;

    audio.addEventListener("play", () => setPlaying(true));
    audio.addEventListener("pause", () => setPlaying(false));

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Brown Noise",
        artist: "Mornin",
      });
      navigator.mediaSession.setActionHandler("play", () => audio.play().catch(() => {}));
      navigator.mediaSession.setActionHandler("pause", () => audio.pause());
      navigator.mediaSession.setActionHandler("stop", () => {
        audio.pause();
        audio.currentTime = 0;
      });
    }

    const onLibraryPlay = () => audio.pause();
    window.addEventListener("library-audio-play", onLibraryPlay);

    return () => {
      window.removeEventListener("library-audio-play", onLibraryPlay);
      audio.pause();
      audio.src = "";
    };
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
  }, []);

  const start = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    window.dispatchEvent(new Event("speechsynthesis-play"));
    audio.play().catch(() => {});
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
  }, []);

  const toggle = useCallback(() => {
    if (playing) stop();
    else start();
  }, [playing, start, stop]);

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`transition-opacity ${playing ? "opacity-100" : "opacity-40"}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
              <path d="M3 18c0-3.3 2.7-6 6-6h.5A6.5 6.5 0 0 1 16 6a6.5 6.5 0 0 1 6.5 6.5" strokeLinecap="round"/>
              <path d="M7 18v2M10 17v3M13 18v2M16 17v3" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h2 className="text-accent font-semibold text-sm uppercase tracking-wider">
              Brown Noise
            </h2>
            <p className="text-gray-500 text-xs mt-0.5">
              {playing ? "Playing — use lock screen to control" : "Tap to start"}
            </p>
          </div>
        </div>

        <button
          onClick={toggle}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${
            playing
              ? "bg-accent text-white shadow-lg shadow-accent/30"
              : "bg-white/10 text-gray-400"
          }`}
          aria-label={playing ? "Stop brown noise" : "Start brown noise"}
        >
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="3" width="4" height="10" rx="1" />
              <rect x="9" y="3" width="4" height="10" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2.5l10 5.5-10 5.5V2.5z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
