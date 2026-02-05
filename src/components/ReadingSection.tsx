"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import readingsData from "../../data/readings.json";

interface Reading {
  title: string;
  author: string;
  type: string;
  year: number;
  excerpt: string;
  url: string;
  readTime: string;
}

const TYPE_ICONS: Record<string, string> = {
  poem: "\u{1F4DC}",
  "short story": "\u{1F4D6}",
  novella: "\u{1F4D5}",
  "short story collection": "\u{1F4DA}",
  essay: "\u{270D}\u{FE0F}",
  speech: "\u{1F3A4}",
  philosophy: "\u{1F9D8}",
};

function seededShuffle(arr: Reading[], seed: number): Reading[] {
  const shuffled = [...arr];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function ReadingSection() {
  const [index, setIndex] = useState<number | null>(null);
  const [shuffled, setShuffled] = useState<Reading[]>([]);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor(
      (now.getTime() - start.getTime()) / 86400000
    );
    const readings = seededShuffle(readingsData.readings as Reading[], now.getFullYear());
    setShuffled(readings);
    setIndex(dayOfYear % readings.length);
  }, []);

  const next = useCallback(() => {
    setIndex((prev) => (prev !== null ? (prev + 1) % shuffled.length : 0));
  }, [shuffled.length]);

  const prev = useCallback(() => {
    setIndex((prev) =>
      prev !== null ? (prev - 1 + shuffled.length) % shuffled.length : 0
    );
  }, [shuffled.length]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const delta = e.changedTouches[0].clientX - touchStartX.current;
      if (delta > 50) prev();
      touchStartX.current = null;
    },
    [prev]
  );

  const handleClick = useCallback(() => {
    next();
  }, [next]);

  if (index === null || shuffled.length === 0) return null;

  const reading = shuffled[index];
  const icon = TYPE_ICONS[reading.type] || "\u{1F4D6}";

  return (
    <div
      className="card cursor-pointer select-none active:scale-[0.98] transition-transform"
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-accent text-lg">{icon}</span>
          <h2 className="text-accent font-semibold text-sm uppercase tracking-wider">
            Today&apos;s Reading
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-600 text-xs">tap / swipe</span>
          <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
            {index + 1}/{shuffled.length}
          </span>
        </div>
      </div>

      <h3 className="text-xl font-semibold text-gray-100 mb-2 leading-snug">
        {reading.title}
      </h3>

      <p className="text-gray-400 text-sm leading-relaxed mb-4 italic">
        &ldquo;{reading.excerpt}&rdquo;
      </p>

      <div className="flex items-center justify-between mb-4">
        <p className="text-accent-light text-sm font-medium">
          &mdash; {reading.author}, {reading.year > 0 ? reading.year : `${Math.abs(reading.year)} BC`}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider bg-white/5 px-2 py-1 rounded-full">
            {reading.type}
          </span>
          <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
            {reading.readTime}
          </span>
        </div>
      </div>

      <a
        href={reading.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 transition-colors rounded-xl py-3 text-sm text-gray-300"
        onClick={(e) => e.stopPropagation()}
      >
        <svg
          className="w-5 h-5 text-accent"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
        Read Full Text
      </a>
    </div>
  );
}
