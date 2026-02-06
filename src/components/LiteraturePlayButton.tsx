"use client";

import { useCallback } from "react";
import { useTTSContext } from "@/components/TTSContext";

interface LiteraturePlayButtonProps {
  text: string;
  contentId: string;
  title: string;
  author: string;
  isPoetry?: boolean;
}

export default function LiteraturePlayButton({
  text,
  contentId,
  title,
  author,
  isPoetry = false,
}: LiteraturePlayButtonProps) {
  const { isSupported, startPlaying, activeContentId, state, hasSavedPosition } =
    useTTSContext();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      startPlaying({ text, contentId, title, author, isPoetry });
    },
    [startPlaying, text, contentId, title, author, isPoetry]
  );

  if (!isSupported) return null;

  const isCurrentlyPlaying = activeContentId === contentId && state.isPlaying;
  const hasResume = hasSavedPosition(contentId);

  return (
    <button
      onClick={handleClick}
      className={`relative flex items-center justify-center w-9 h-9 rounded-full transition-colors flex-shrink-0 ${
        isCurrentlyPlaying
          ? "bg-accent text-dark-bg"
          : "bg-white/10 text-gray-300 hover:bg-accent/20 hover:text-accent"
      }`}
      aria-label={isCurrentlyPlaying ? `Now playing ${title}` : `Listen to ${title}`}
    >
      {isCurrentlyPlaying ? (
        /* Sound wave animation when playing */
        <div className="flex items-center gap-0.5">
          <span className="w-0.5 h-3 bg-dark-bg rounded-full animate-pulse" />
          <span className="w-0.5 h-4 bg-dark-bg rounded-full animate-pulse [animation-delay:150ms]" />
          <span className="w-0.5 h-2 bg-dark-bg rounded-full animate-pulse [animation-delay:300ms]" />
        </div>
      ) : (
        /* Play icon */
        <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
      {/* Resume indicator dot */}
      {hasResume && !isCurrentlyPlaying && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-accent rounded-full border-2 border-dark-card" />
      )}
    </button>
  );
}
