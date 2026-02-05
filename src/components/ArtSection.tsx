"use client";

import { useEffect, useState } from "react";
import { fetchFeaturedArt, type Artwork } from "@/lib/api";

export default function ArtSection() {
  const [art, setArt] = useState<Artwork | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedArt()
      .then(setArt)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/3 mb-4" />
        <div className="h-64 bg-white/10 rounded-xl mb-3" />
        <div className="h-4 bg-white/10 rounded w-2/3" />
      </div>
    );
  }

  if (!art) return null;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-accent text-lg">&#127912;</span>
        <h2 className="text-accent font-semibold text-sm uppercase tracking-wider">
          Featured Art
        </h2>
      </div>

      <div className="mb-4 rounded-xl overflow-hidden bg-dark-surface">
        <img
          src={art.imageUrl}
          alt={art.altText}
          className="w-full object-contain max-h-96"
          loading="lazy"
        />
      </div>

      <h3 className="text-lg font-semibold text-gray-100 mb-1">
        {art.title}
      </h3>
      <p className="text-accent-light text-sm">{art.artist}</p>
      <p className="text-gray-500 text-xs mt-1">{art.date}</p>
    </div>
  );
}
