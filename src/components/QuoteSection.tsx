"use client";

import { useEffect, useState } from "react";
import quotesData from "../../data/quotes.json";

interface Quote {
  text: string;
  author: string;
  category: string;
}

function getQuoteOfTheDay(): Quote {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  const index = dayOfYear % quotesData.quotes.length;
  return quotesData.quotes[index];
}

export default function QuoteSection() {
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    setQuote(getQuoteOfTheDay());
  }, []);

  if (!quote) return null;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-accent text-xl">&ldquo;</span>
        <h2 className="text-accent font-semibold text-sm uppercase tracking-wider">
          Quote of the Day
        </h2>
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
