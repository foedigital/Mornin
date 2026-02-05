"use client";

import { useEffect, useState } from "react";
import { fetchBattleOfTheDay, type BattleEvent } from "@/lib/api";

export default function BattleSection() {
  const [battle, setBattle] = useState<BattleEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBattleOfTheDay()
      .then(setBattle)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/3 mb-4" />
        <div className="h-4 bg-white/10 rounded w-full mb-2" />
        <div className="h-4 bg-white/10 rounded w-2/3" />
      </div>
    );
  }

  if (!battle) return null;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-accent text-lg">&#9876;</span>
        <h2 className="text-accent font-semibold text-sm uppercase tracking-wider">
          On This Day in History
        </h2>
      </div>

      {battle.thumbnail && (
        <div className="mb-4 rounded-xl overflow-hidden">
          <img
            src={battle.thumbnail}
            alt={battle.text}
            className="w-full h-48 object-cover"
          />
        </div>
      )}

      <p className="text-lg text-gray-100 leading-relaxed mb-3">
        {battle.text}
      </p>

      <div className="flex items-center justify-between">
        <span className="text-accent-light font-medium">{battle.year}</span>
        {battle.wikiUrl && (
          <a
            href={battle.wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-accent transition-colors"
          >
            Read more &rarr;
          </a>
        )}
      </div>
    </div>
  );
}
