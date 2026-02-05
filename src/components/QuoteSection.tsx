"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import quotesData from "../../data/quotes.json";

interface Quote {
  text: string;
  author: string;
  category: string;
}

const quotes = quotesData.quotes;

function getStartIndex(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  return dayOfYear % quotes.length;
}

export default function QuoteSection() {
  const [index, setIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setIndex(getStartIndex());
  }, []);

  const nextQuote = useCallback(() => {
    setIndex((prev) => (prev !== null ? (prev + 1) % quotes.length : 0));
  }, []);

  const prevQuote = useCallback(() => {
    setIndex((prev) =>
      prev !== null ? (prev - 1 + quotes.length) % quotes.length : 0
    );
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const delta = e.changedTouches[0].clientX - touchStartX.current;
      if (delta > 50) {
        // Swiped right → go back
        prevQuote();
      }
      touchStartX.current = null;
    },
    [prevQuote]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Only advance on tap, not at the end of a swipe
      // Touch events that triggered a swipe won't fire click
      nextQuote();
    },
    [nextQuote]
  );

  if (index === null) return null;

  const quote: Quote = quotes[index];

  return (
    <div
      className="card cursor-pointer select-none active:scale-[0.98] transition-transform"
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-accent text-xl">&ldquo;</span>
          <h2 className="text-accent font-semibold text-sm uppercase tracking-wider">
            Quote of the Day
          </h2>
        </div>
        <span className="text-gray-600 text-xs">tap / swipe</span>
      </div>
      <blockquote className="text-xl md:text-2xl font-light leading-relaxed text-gray-100 mb-4">
        &ldquo;{quote.text}&rdquo;
      </blockquote>
      <div className="flex items-center justify-between">
        <p className="text-accent-light font-medium">
          &mdash; {quote.author}
        </p>
        <span className="text-xs text-gray-500 uppercase tracking-wider bg-white/5 px-2 py-1 rounded-full">
          {quote.category}
        </span>
      </div>
    </div>
  );
}
