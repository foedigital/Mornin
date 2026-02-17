"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import recipesData from "../../data/recipes.json";

/* ── Types ────────────────────────────────────────────────────── */

interface Ingredient {
  name: string;
  measure: string;
}

interface Recipe {
  id: string;
  name: string;
  chef: string;
  meal: "breakfast" | "lunch" | "dinner";
  prepTime: string;
  cookTime: string;
  servings: number;
  ingredients: Ingredient[];
  instructions: string;
  youtubeUrl?: string;
}

/* ── Constants ────────────────────────────────────────────────── */

const STORAGE_KEY = "mornin-recipes-saved";

const MEAL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  breakfast: { label: "Breakfast", color: "text-amber-400", bg: "bg-amber-400/15" },
  lunch:     { label: "Lunch",     color: "text-emerald-400", bg: "bg-emerald-400/15" },
  dinner:    { label: "Dinner",    color: "text-violet-400", bg: "bg-violet-400/15" },
};

/* ── Seeded shuffle ───────────────────────────────────────────── */

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* ── Helpers ──────────────────────────────────────────────────── */

interface SavedRecipe {
  id: string;
  name: string;
  chef: string;
  meal: string;
  savedAt: string;
}

function loadSaved(): SavedRecipe[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) {
        return parsed as SavedRecipe[];
      }
    }
  } catch {}
  return [];
}

function persistSaved(items: SavedRecipe[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("mornin-data-changed"));
  } catch {}
}

/* ── Component ────────────────────────────────────────────────── */

export default function RecipeSection() {
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState<SavedRecipe[]>([]);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showAllIngredients, setShowAllIngredients] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const touchStartX = useRef<number | null>(null);

  /* Daily-seeded order */
  const recipes: Recipe[] = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    return seededShuffle(recipesData.recipes as Recipe[], year);
  }, []);

  /* Pick today's starting index */
  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor(
      (now.getTime() - start.getTime()) / 86400000
    );
    setIndex(dayOfYear % recipes.length);
    setSaved(loadSaved());
  }, [recipes.length]);

  /* Reset expand state on recipe change */
  useEffect(() => {
    setShowInstructions(false);
    setShowAllIngredients(false);
  }, [index]);

  /* Navigation */
  const next = useCallback(() => {
    setIndex((p) => (p + 1) % recipes.length);
  }, [recipes.length]);

  const prev = useCallback(() => {
    setIndex((p) => (p - 1 + recipes.length) % recipes.length);
  }, [recipes.length]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const delta = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(delta) > 50) {
        if (delta > 0) prev();
        else next();
      }
      touchStartX.current = null;
    },
    [prev, next]
  );

  /* Save / unsave */
  const toggleSave = useCallback(
    (recipe: Recipe) => {
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
              chef: recipe.chef,
              meal: recipe.meal,
              savedAt: new Date().toISOString(),
            },
            ...prev,
          ];
        }
        persistSaved(next);
        return next;
      });
    },
    []
  );

  const removeSaved = useCallback((id: string) => {
    setSaved((prev) => {
      const next = prev.filter((r) => r.id !== id);
      persistSaved(next);
      return next;
    });
  }, []);

  const recipe = recipes[index];
  if (!recipe) return null;

  const isSaved = saved.some((r) => r.id === recipe.id);
  const meal = MEAL_CONFIG[recipe.meal];
  const ingredientLimit = 8;
  const hasMoreIngredients = recipe.ingredients.length > ingredientLimit;
  const visibleIngredients = showAllIngredients
    ? recipe.ingredients
    : recipe.ingredients.slice(0, ingredientLimit);

  return (
    <div className="space-y-6">
      {/* ── Section Header ──────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-accent text-xl">{"\uD83C\uDF73"}</span>
        <h2 className="text-accent font-semibold text-sm uppercase tracking-wider">
          Daily Recipe
        </h2>
      </div>

      {/* ── Recipe Card ─────────────────────────── */}
      <div
        className="card select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Top row: meal badge + nav */}
        <div className="flex items-center justify-between mb-4">
          <span className={`text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full ${meal.color} ${meal.bg}`}>
            {meal.label}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-gray-600 text-xs">tap / swipe</span>
            <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
              {index + 1}/{recipes.length}
            </span>
          </div>
        </div>

        {/* Name & chef */}
        <h3
          className="text-xl font-bold text-gray-100 mb-1 cursor-pointer active:scale-[0.98] transition-transform"
          onClick={next}
        >
          {recipe.name}
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          by <span className="text-gray-300 font-medium">{recipe.chef}</span>
        </p>

        {/* Prep / Cook / Servings */}
        <div className="flex items-center gap-4 mb-5 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span>Prep {recipe.prepTime}</span>
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" />
            </svg>
            <span>Cook {recipe.cookTime}</span>
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Serves {recipe.servings}</span>
          </div>
        </div>

        {/* Ingredients */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Ingredients
          </h4>
          <div className="grid grid-cols-1 gap-1.5">
            {visibleIngredients.map((ing, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent/60 flex-shrink-0" />
                <span className="text-gray-300">{ing.name}</span>
                <span className="text-gray-600 text-xs ml-auto flex-shrink-0">
                  {ing.measure}
                </span>
              </div>
            ))}
          </div>
          {hasMoreIngredients && !showAllIngredients && (
            <button
              className="mt-2 text-xs text-accent/80 hover:text-accent transition-colors"
              onClick={() => setShowAllIngredients(true)}
            >
              + {recipe.ingredients.length - ingredientLimit} more ingredients
            </button>
          )}
        </div>

        {/* Instructions (expandable) */}
        <button
          className="flex items-center justify-between w-full py-3 border-t border-white/5"
          onClick={() => setShowInstructions((p) => !p)}
        >
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Instructions
          </h4>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${showInstructions ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showInstructions && (
          <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-line pb-2">
            {recipe.instructions}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 mt-3">
          {/* Save button */}
          <button
            className={`flex items-center gap-2 flex-1 rounded-xl py-3 px-4 text-sm transition-colors ${
              isSaved
                ? "bg-accent/10 text-accent"
                : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
            onClick={() => toggleSave(recipe)}
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
            {isSaved ? "Saved" : "Save"}
          </button>

          {/* YouTube link */}
          {recipe.youtubeUrl && (
            <a
              href={recipe.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 flex-1 bg-white/5 hover:bg-white/10 transition-colors rounded-xl py-3 px-4 text-sm text-gray-300"
            >
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
                <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="white" />
              </svg>
              Watch
            </a>
          )}
        </div>
      </div>

      {/* ── Saved Recipes Archive ────────────────── */}
      {saved.length > 0 && (
        <div className="card">
          <button
            className="flex items-center justify-between w-full"
            onClick={() => setShowArchive((p) => !p)}
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
              {saved.map((r) => {
                const m = MEAL_CONFIG[r.meal];
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
                  >
                    <button
                      className="flex-shrink-0"
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
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-300 font-medium truncate">
                        {r.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        by {r.chef}
                      </p>
                    </div>
                    {m && (
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 ${m.color} ${m.bg}`}>
                        {m.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
