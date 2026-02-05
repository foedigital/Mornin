"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { fetchFitnessVideos, type YouTubeVideo } from "@/lib/youtube";
import exercisesData from "../../data/exercises.json";
import workoutsData from "../../data/workouts.json";

/* ── Types ─────────────────────────────────────────────────────── */

interface Exercise {
  id: string;
  name: string;
  category: string;
  target: string;
  difficulty: string;
  emoji: string;
  instructions: string;
  demoUrl: string;
  unit: string;
}

interface WorkoutExercise {
  id: string;
  sets: number;
  override: string;
}

interface Workout {
  name: string;
  description: string;
  exercises: WorkoutExercise[];
}

/* ── Constants ─────────────────────────────────────────────────── */

const STORAGE_KEY = "mornin-workout-completed";
const CATEGORY_ICONS: Record<string, string> = {
  yoga: "\uD83E\uDDD8",
  workout: "\uD83C\uDFCB\uFE0F",
  cardio: "\uD83C\uDFC3",
  bodyweight: "\uD83D\uDCAA",
  mobility: "\uD83E\uDDB5",
};

const exerciseMap = new Map<string, Exercise>();
for (const ex of exercisesData.exercises) {
  exerciseMap.set(ex.id, ex as Exercise);
}

/* ── Helpers ───────────────────────────────────────────────────── */

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

function isAfternoon(): boolean {
  return new Date().getHours() >= 12;
}

function getTodayKey(): string {
  const d = new Date();
  const period = isAfternoon() ? "pm" : "am";
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${period}`;
}

function loadCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const data = JSON.parse(raw);
    if (data.key !== getTodayKey()) return new Set();
    return new Set(data.done as string[]);
  } catch {
    return new Set();
  }
}

function saveCompleted(done: Set<string>) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ key: getTodayKey(), done: Array.from(done) })
    );
  } catch {}
}

function getTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diffMs / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

/* ── Component ─────────────────────────────────────────────────── */

export default function WorkoutSection() {
  /* Workout state */
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [period, setPeriod] = useState<"morning" | "afternoon">("morning");
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /* Fitness video state */
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [vidIndex, setVidIndex] = useState(0);
  const [vidLoading, setVidLoading] = useState(true);
  const touchStartX = useRef<number | null>(null);

  /* Init workout */
  useEffect(() => {
    const afternoon = isAfternoon();
    setPeriod(afternoon ? "afternoon" : "morning");
    const pool = afternoon ? workoutsData.afternoon : workoutsData.morning;
    const dayIdx = getDayOfYear() % pool.length;
    setWorkout(pool[dayIdx] as Workout);
    setCompleted(loadCompleted());
  }, []);

  /* Fetch fitness videos */
  useEffect(() => {
    fetchFitnessVideos()
      .then((vids) => {
        vids.sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() -
            new Date(a.publishedAt).getTime()
        );
        setVideos(vids);
        setVidIndex(0);
      })
      .finally(() => setVidLoading(false));
  }, []);

  /* Handlers */
  const toggleExercise = useCallback((exId: string, setIdx: number) => {
    const key = `${exId}-${setIdx}`;
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveCompleted(next);
      return next;
    });
  }, []);

  const nextVid = useCallback(() => {
    setVidIndex((p) => (p + 1) % videos.length);
  }, [videos.length]);

  const prevVid = useCallback(() => {
    setVidIndex((p) => (p - 1 + videos.length) % videos.length);
  }, [videos.length]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const delta = e.changedTouches[0].clientX - touchStartX.current;
      if (delta > 50) prevVid();
      touchStartX.current = null;
    },
    [prevVid]
  );

  /* Derived */
  const totalSets = workout
    ? workout.exercises.reduce((sum, e) => sum + e.sets, 0)
    : 0;
  const doneSets = completed.size;
  const progressPct = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* ── Section Header ──────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-accent text-xl">{"\uD83C\uDFCB\uFE0F"}</span>
        <h2 className="text-accent font-semibold text-sm uppercase tracking-wider">
          Fitness
        </h2>
      </div>

      {/* ── Fitness Videos ──────────────────────────────── */}
      {vidLoading ? (
        <div className="card animate-pulse">
          <div className="h-4 bg-white/10 rounded w-1/3 mb-4" />
          <div className="h-48 bg-white/10 rounded-xl mb-3" />
          <div className="h-4 bg-white/10 rounded w-2/3" />
        </div>
      ) : videos.length > 0 ? (
        <div
          className="card cursor-pointer select-none active:scale-[0.98] transition-transform"
          onClick={nextVid}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-accent text-lg">
                {CATEGORY_ICONS[videos[vidIndex].category] || "\uD83C\uDFAC"}
              </span>
              <h3 className="text-accent font-semibold text-sm uppercase tracking-wider">
                Fitness Videos
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600 text-xs">tap / swipe</span>
              <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
                {vidIndex + 1}/{videos.length}
              </span>
            </div>
          </div>

          <div className="mb-4 rounded-xl overflow-hidden bg-dark-surface relative">
            <img
              src={videos[vidIndex].thumbnailUrl}
              alt={videos[vidIndex].title}
              className="w-full h-48 object-cover"
              loading="lazy"
            />
            <a
              href={videos[vidIndex].youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 bg-black/60 rounded-full flex items-center justify-center hover:bg-red-600/90 transition-colors">
                <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </a>
          </div>

          <h4 className="text-lg font-semibold text-gray-100 mb-2 leading-snug">
            {videos[vidIndex].title}
          </h4>
          <div className="flex items-center justify-between">
            <p className="text-accent-light text-sm font-medium">
              {videos[vidIndex].channelName}
            </p>
            <span className="text-gray-500 text-xs">
              {getTimeAgo(videos[vidIndex].publishedAt)}
            </span>
          </div>

          <a
            href={videos[vidIndex].youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 transition-colors rounded-xl py-3 text-sm text-gray-300"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
              <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="white" />
            </svg>
            Open in YouTube
          </a>
        </div>
      ) : null}

      {/* ── Today's Workout ─────────────────────────────── */}
      {workout && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-accent text-lg">
                {period === "morning" ? "\u2600\uFE0F" : "\uD83C\uDF24\uFE0F"}
              </span>
              <h3 className="text-accent font-semibold text-sm uppercase tracking-wider">
                {period === "morning" ? "Morning" : "Afternoon"} Workout
              </h3>
            </div>
            <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
              ~10 min
            </span>
          </div>

          <h4 className="text-xl font-semibold text-gray-100 mb-1">
            {workout.name}
          </h4>
          <p className="text-gray-400 text-sm mb-4">
            {workout.description}
          </p>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Progress</span>
              <span className="text-xs text-gray-400">
                {doneSets}/{totalSets} sets &middot; {progressPct}%
              </span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Exercise list */}
          <div className="space-y-2">
            {workout.exercises.map((we) => {
              const ex = exerciseMap.get(we.id);
              if (!ex) return null;

              const allDone = Array.from({ length: we.sets }, (_, i) =>
                completed.has(`${we.id}-${i}`)
              ).every(Boolean);

              const isExpanded = expandedId === we.id;

              return (
                <div
                  key={we.id}
                  className={`rounded-xl border transition-colors ${
                    allDone
                      ? "border-accent/20 bg-accent/5"
                      : "border-white/5 bg-white/[0.02]"
                  }`}
                >
                  {/* Exercise header */}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : we.id)
                    }
                  >
                    <span className="text-lg flex-shrink-0">{ex.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium ${
                            allDone ? "text-accent line-through" : "text-gray-200"
                          }`}
                        >
                          {ex.name}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {we.sets > 1 ? `${we.sets} sets \u00D7 ` : ""}
                        {we.override}
                      </span>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-3">
                      <p className="text-xs text-gray-400 leading-relaxed">
                        {ex.instructions}
                      </p>

                      {/* Set checkboxes */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {Array.from({ length: we.sets }, (_, i) => {
                          const key = `${we.id}-${i}`;
                          const done = completed.has(key);
                          return (
                            <button
                              key={key}
                              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
                                done
                                  ? "bg-accent/20 text-accent"
                                  : "bg-white/5 text-gray-400 hover:bg-white/10"
                              }`}
                              onClick={() => toggleExercise(we.id, i)}
                            >
                              <div
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                  done
                                    ? "border-accent bg-accent"
                                    : "border-gray-500"
                                }`}
                              >
                                {done && (
                                  <svg
                                    className="w-2.5 h-2.5 text-dark-bg"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={3}
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                )}
                              </div>
                              {we.sets > 1 ? `Set ${i + 1}` : "Done"}
                            </button>
                          );
                        })}
                      </div>

                      {/* Demo link */}
                      <a
                        href={ex.demoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-accent transition-colors"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101"
                          />
                        </svg>
                        How to do this exercise
                      </a>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-600 uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-full">
                          {ex.target}
                        </span>
                        <span className="text-[10px] text-gray-600 uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-full">
                          {ex.difficulty}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Completion message */}
          {progressPct === 100 && (
            <div className="mt-4 text-center py-3 bg-accent/10 rounded-xl">
              <span className="text-accent font-semibold text-sm">
                {"\uD83C\uDF89"} Workout Complete! Great job!
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
