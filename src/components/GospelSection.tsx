"use client";

import { useEffect, useState } from "react";
import { fetchDailyGospel, type GospelReading } from "@/lib/api";

export default function GospelSection() {
  const [gospel, setGospel] = useState<GospelReading | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchDailyGospel()
      .then(setGospel)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/3 mb-4" />
        <div className="h-4 bg-white/10 rounded w-full mb-2" />
        <div className="h-4 bg-white/10 rounded w-full mb-2" />
        <div className="h-4 bg-white/10 rounded w-2/3" />
      </div>
    );
  }

  if (!gospel) return null;

  const paragraphs = gospel.text.split("\n").filter((p) => p.trim());
  const preview = paragraphs.slice(0, 3);
  const hasMore = paragraphs.length > 3;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-accent text-lg">&#10013;</span>
        <h2 className="text-accent font-semibold text-sm uppercase tracking-wider">
          Daily Gospel
        </h2>
      </div>

      <p className="text-accent-light text-sm mb-4">{gospel.reference}</p>

      <div className="space-y-3 text-gray-300 leading-relaxed">
        {(expanded ? paragraphs : preview).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 text-sm text-accent hover:text-accent-light transition-colors"
        >
          {expanded ? "Show less" : "Read full passage \u2193"}
        </button>
      )}
    </div>
  );
}
