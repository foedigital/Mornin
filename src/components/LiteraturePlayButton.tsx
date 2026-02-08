"use client";

import { useCallback, useState, useRef, useEffect } from "react";

interface LiteraturePlayButtonProps {
  text: string;
  contentId: string;
  title: string;
  author: string;
  url: string;
  isPoetry?: boolean;
}

const SAMPLE_VOICE = "en-US-AndrewMultilingualNeural";

function first75Words(text: string): string {
  const words = text.split(/\s+/);
  return words.slice(0, 75).join(" ");
}

// In-memory cache so repeated taps don't re-generate
const sampleCache = new Map<string, Blob>();

export default function LiteraturePlayButton({
  text,
  contentId,
  title,
}: LiteraturePlayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const loadedContentIdRef = useRef<string | null>(null);

  // Reset audio when the reading changes (user swiped to a different book)
  useEffect(() => {
    if (loadedContentIdRef.current && loadedContentIdRef.current !== contentId) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      setPlaying(false);
      loadedContentIdRef.current = null;
    }
  }, [contentId]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  // Pause when library audio starts
  useEffect(() => {
    const handler = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        setPlaying(false);
      }
    };
    window.addEventListener("library-audio-play", handler);
    return () => window.removeEventListener("library-audio-play", handler);
  }, []);

  // Pause when another sample preview starts playing
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail !== contentId && audioRef.current) {
        audioRef.current.pause();
        setPlaying(false);
      }
    };
    window.addEventListener("sample-audio-play", handler);
    return () => window.removeEventListener("sample-audio-play", handler);
  }, [contentId]);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setError("");

      // If currently playing, pause
      if (playing && audioRef.current) {
        audioRef.current.pause();
        setPlaying(false);
        return;
      }

      // If we already have audio loaded for THIS content, resume
      if (
        loadedContentIdRef.current === contentId &&
        audioRef.current && audioRef.current.src && audioRef.current.paused && audioRef.current.currentTime > 0
      ) {
        audioRef.current.play();
        setPlaying(true);
        window.dispatchEvent(new CustomEvent("sample-audio-play", { detail: contentId }));
        return;
      }

      setLoading(true);

      try {
        const cacheKey = contentId;
        let blob = sampleCache.get(cacheKey);

        if (!blob) {
          const sampleText = first75Words(text);
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: sampleText, voice: SAMPLE_VOICE }),
          });
          if (!res.ok) throw new Error("TTS failed");
          blob = await res.blob();
          sampleCache.set(cacheKey, blob);
        }

        // Revoke old URL
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const url = URL.createObjectURL(blob);
        urlRef.current = url;

        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        const audio = audioRef.current;
        audio.src = url;
        audio.currentTime = 0;

        audio.onended = () => setPlaying(false);
        audio.onpause = () => setPlaying(false);
        audio.onplay = () => setPlaying(true);

        loadedContentIdRef.current = contentId;
        await audio.play();
        // Dispatch events to pause other audio systems and other sample buttons
        window.dispatchEvent(new CustomEvent("speechsynthesis-play"));
        window.dispatchEvent(new CustomEvent("sample-audio-play", { detail: contentId }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
        setTimeout(() => setError(""), 3000);
      } finally {
        setLoading(false);
      }
    },
    [text, contentId, playing]
  );

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`relative flex items-center justify-center w-9 h-9 rounded-full transition-colors flex-shrink-0 ${
        playing
          ? "bg-accent text-dark-bg"
          : error
          ? "bg-red-500/20 text-red-400"
          : "bg-white/10 text-gray-300 hover:bg-accent/20 hover:text-accent"
      } ${loading ? "opacity-70" : ""}`}
      aria-label={playing ? `Now playing ${title}` : `Listen to ${title}`}
      title={error || undefined}
    >
      {loading ? (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : playing ? (
        <div className="flex items-center gap-0.5">
          <span className="w-0.5 h-3 bg-dark-bg rounded-full animate-pulse" />
          <span className="w-0.5 h-4 bg-dark-bg rounded-full animate-pulse [animation-delay:150ms]" />
          <span className="w-0.5 h-2 bg-dark-bg rounded-full animate-pulse [animation-delay:300ms]" />
        </div>
      ) : error ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  );
}
