"use client";

import { useEffect, useState, useCallback, useRef } from "react";

/* ── Types ──────────────────────────────────────────────────── */

interface Ingredient {
  name: string;
  measure: string;
}

interface Recipe {
  id: string;
  name: string;
  category: string;
  area: string;
  instructions: string;
  thumbnail: string;
  youtubeUrl?: string;
  sourceUrl?: string;
  ingredients: Ingredient[];
}

interface SavedRecipe {
  id: string;
  name: string;
  category: string;
  area: string;
  thumbnail: string;
  savedAt: string;
}

/* ── Constants ──────────────────────────────────────────────── */

const STORAGE_KEY = "mornin-recipes-saved";
const CATEGORY_ICONS: Record<string, string> = {
  Chicken: "\uD83D\uDC14",
  Seafood: "\uD83D\uDC1F",
  Vegetarian: "\uD83E\uDD66",
  Vegan: "\uD83C\uDF31",
  Starter: "\uD83E\uDD57",
  Side: "\uD83E\uDD5D",
  Breakfast: "\uD83C\uDF73",
};

/* ── Helpers ────────────────────────────────────────────────── */

function loadSaved(): SavedRecipe[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SavedRecipe[];
  } catch {}
  return [];
}

function persistSaved(recipes: SavedRecipe[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
  } catch {}
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const shuffled = [...arr];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/* ── Component ──────────────────────────────────────────────── */

export default function RecipeSection() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<SavedRecipe[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const touchStartX = useRef<number | null>(null);

  /* Load recipes + saved state */
  useEffect(() => {
    import("@/../data/recipes.json")
      .then((mod) => {
        const raw = mod.recipes || mod.default?.recipes || [];
        const all: Recipe[] = raw.map((r: Record<string, unknown>) => ({
          ...r,
          youtubeUrl: r.youtubeUrl || undefined,
          sourceUrl: r.sourceUrl || undefined,
        })) as Recipe[];
        const now = new Date();
        const seed = now.getFullYear();
        const shuffled = seededShuffle(all, seed);
        setRecipes(shuffled);

        const dayOfYear = Math.floor(
          (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
        );
        setIndex(dayOfYear % shuffled.length);
      })
      .finally(() => setLoading(false));
    setSaved(loadSaved());
  }, []);

  /* Handlers */
  const toggleSaved = useCallback((recipe: Recipe) => {
    setSaved((prev) => {
      const exists = prev.some((r) => r.id === recipe.id);
      let next: SavedRecipe[];
      if (exists) {
        next = prev.filter((r) => r.id !== recipe.id);
      } else {
        next = [
          {
            id: recipe.id,
            name: recipe.name,
            category: recipe.category,
            area: recipe.area,
            thumbnail: recipe.thumbnail,
            savedAt: new Date().toISOString(),
          },
          ...prev,
        ];
      }
      persistSaved(next);
      return next;
    });
  }, []);

  const removeSaved = useCallback((id: string) => {
    setSaved((prev) => {
      const next = prev.filter((r) => r.id !== id);
      persistSaved(next);
      return next;
    });
  }, []);

  const next = useCallback(() => {
    setIndex((p) => (p + 1) % recipes.length);
    setExpanded(false);
  }, [recipes.length]);

  const prev = useCallback(() => {
    setIndex((p) => (p - 1 + recipes.length) % recipes.length);
    setExpanded(false);
  }, [recipes.length]);

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

  const current = recipes[index];
  const isSaved = current ? saved.some((r) => r.id === current.id) : false;

  return (
    <div className="space-y-6">
      {/* ── Section Header ──────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-accent text-xl">{"\uD83E\uDD57"}</span>
        <h2 className="text-accent font-semibold text-sm uppercase tracking-wider">
          Daily Recipe
        </h2>
      </div>

      {/* ── Recipe Card ─────────────────────────────────── */}
      {loading ? (
        <div className="card animate-pulse">
          <div className="h-4 bg-white/10 rounded w-1/3 mb-4" />
          <div className="h-48 bg-white/10 rounded-xl mb-3" />
          <div className="h-4 bg-white/10 rounded w-2/3" />
        </div>
      ) : recipes.length > 0 && current ? (
        <div
          className="card cursor-pointer select-none active:scale-[0.98] transition-transform"
          onClick={next}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-accent text-lg">
                {CATEGORY_ICONS[current.category] || "\uD83C\uDF7D\uFE0F"}
              </span>
              <h3 className="text-accent font-semibold text-sm uppercase tracking-wider">
                {current.category}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600 text-xs">tap / swipe</span>
              <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
                {index + 1}/{recipes.length}
              </span>
            </div>
          </div>

          {/* Thumbnail */}
          <div className="mb-4 rounded-xl overflow-hidden bg-dark-surface">
            <img
              src={current.thumbnail}
              alt={current.name}
              className="w-full h-48 object-cover"
              loading="lazy"
            />
          </div>

          {/* Title & area */}
          <h4 className="text-lg font-semibold text-gray-100 mb-1 leading-snug">
            {current.name}
          </h4>
          <p className="text-accent-light text-sm font-medium mb-4">
            {current.area} cuisine
          </p>

          {/* Ingredients preview (always visible) */}
          <div className="mb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">
              Ingredients ({current.ingredients.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {current.ingredients.slice(0, expanded ? undefined : 8).map((ing, i) => (
                <span
                  key={i}
                  className="text-xs bg-white/5 text-gray-300 px-2 py-1 rounded-full"
                >
                  {ing.measure} {ing.name}
                </span>
              ))}
              {!expanded && current.ingredients.length > 8 && (
                <span className="text-xs text-gray-500 px-2 py-1">
                  +{current.ingredients.length - 8} more
                </span>
              )}
            </div>
          </div>

          {/* Expand/collapse instructions */}
          <button
            className="w-full text-left bg-white/5 rounded-xl px-4 py-3 mb-3 transition-colors hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((prev) => !prev);
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300 font-medium">
                {expanded ? "Hide instructions" : "Show instructions"}
              </span>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {expanded && (
              <div className="mt-3 text-sm text-gray-400 leading-relaxed whitespace-pre-line">
                {current.instructions}
              </div>
            )}
          </button>

          {/* Save button */}
          <button
            className={`flex items-center gap-3 w-full rounded-xl py-3 px-4 text-sm transition-colors ${
              isSaved
                ? "bg-accent/10 text-accent"
                : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              toggleSaved(current);
            }}
          >
            <svg
              className={`w-5 h-5 ${isSaved ? "fill-accent" : "fill-none stroke-current"}`}
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
            {isSaved ? "Saved" : "Save Recipe"}
            {saved.length > 0 && (
              <span className="ml-auto text-xs text-gray-500">
                {saved.length} saved
              </span>
            )}
          </button>

          {/* YouTube link if available */}
          {current.youtubeUrl && (
            <a
              href={current.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 transition-colors rounded-xl py-3 text-sm text-gray-300"
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
                <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="white" />
              </svg>
              Watch on YouTube
            </a>
          )}
        </div>
      ) : null}

      {/* ── Saved Recipes Archive ───────────────────────── */}
      {saved.length > 0 && (
        <div className="card">
          <button
            className="flex items-center justify-between w-full"
            onClick={() => setShowArchive((prev) => !prev)}
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-accent fill-accent"
                viewBox="0 0 24 24"
              >
                <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <h2 className="text-accent font-semibold text-sm uppercase tracking-wider">
                Saved Recipes
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
                {saved.length} saved
              </span>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${showArchive ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {showArchive && (
            <div className="mt-4 space-y-3">
              {saved.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0"
                >
                  <button
                    className="mt-0.5 flex-shrink-0"
                    onClick={() => removeSaved(r.id)}
                    title="Remove from saved"
                  >
                    <svg
                      className="w-5 h-5 text-accent fill-accent"
                      viewBox="0 0 24 24"
                    >
                      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                  <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-dark-surface">
                    <img
                      src={r.thumbnail}
                      alt={r.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 font-medium line-clamp-2">
                      {r.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {r.area} &middot; {r.category}
                    </p>
                  </div>
                  <span className="text-lg flex-shrink-0">
                    {CATEGORY_ICONS[r.category] || "\uD83C\uDF7D\uFE0F"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
