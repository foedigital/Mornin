"use client";

import { useEffect, useState } from "react";

interface TeamInfo {
  abbrev: string;
  name: string;
  score?: number;
  logo: string;
}

interface LastGame {
  id: number;
  date: string;
  isPlayoff: boolean;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  isHome: boolean;
  won: boolean;
  overtimeType: string | null;
  venue: string;
  recapLink: string;
}

interface NextGame {
  date: string;
  startTimeUTC: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  isHome: boolean;
  opponentLogo: string;
  opponentName: string;
  venue: string;
  broadcast: string | null;
}

interface NewsItem {
  headline: string;
  description: string;
  link: string;
  published: string;
}

interface LightningData {
  lastGame?: LastGame;
  nextGame?: NextGame;
  isOffseason?: boolean;
  news?: NewsItem[];
}

function formatGameDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatNextGameDateTime(utcStr: string): string {
  const date = new Date(utcStr);
  return (
    date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Chicago",
      hour12: true,
    }) + " CST"
  );
}

function timeAgo(published: string): string {
  if (!published) return "";
  const diff = Date.now() - new Date(published).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(published).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function LightningSection() {
  const [data, setData] = useState<LightningData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/lightning")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) return null;

  if (!data) {
    return (
      <div className="card animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-blue-400 text-xl">⚡</span>
          <div className="h-4 bg-white/10 rounded w-48" />
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-white/10 rounded w-full" />
          <div className="h-4 bg-white/10 rounded w-3/4" />
          <div className="h-4 bg-white/10 rounded w-full" />
          <div className="h-4 bg-white/10 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!data.lastGame && !data.nextGame && !data.isOffseason) return null;

  const { lastGame, nextGame, isOffseason, news } = data;

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-blue-400 text-xl">⚡</span>
          <h2 className="text-blue-400 font-semibold text-sm uppercase tracking-wider">
            Tampa Bay Lightning
          </h2>
        </div>
        {isOffseason && (
          <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400 border border-blue-400/20">
            Offseason
          </span>
        )}
      </div>

      {/* Offseason view */}
      {isOffseason && (
        <>
          {/* Playoff exit — last game summary */}
          {lastGame && (
            <div className="mb-4 pb-4 border-b border-white/10">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">
                Eliminated — {lastGame.isPlayoff ? "Playoffs" : "Last Game"}
              </p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <img src={lastGame.awayTeam.logo} alt={lastGame.awayTeam.abbrev} className="w-6 h-6" />
                  <span className={`font-bold text-lg ${
                    lastGame.awayTeam.abbrev === "TBL"
                      ? lastGame.won ? "text-green-400" : "text-red-400"
                      : "text-gray-300"
                  }`}>
                    {lastGame.awayTeam.abbrev} {lastGame.awayTeam.score}
                  </span>
                </div>
                <span className="text-gray-500">—</span>
                <div className="flex items-center gap-1.5">
                  <img src={lastGame.homeTeam.logo} alt={lastGame.homeTeam.abbrev} className="w-6 h-6" />
                  <span className={`font-bold text-lg ${
                    lastGame.homeTeam.abbrev === "TBL"
                      ? lastGame.won ? "text-green-400" : "text-red-400"
                      : "text-gray-300"
                  }`}>
                    {lastGame.homeTeam.abbrev} {lastGame.homeTeam.score}
                  </span>
                </div>
                {lastGame.overtimeType && (
                  <span className="text-gray-500 text-sm">({lastGame.overtimeType})</span>
                )}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-gray-500 text-sm">
                  {formatGameDate(lastGame.date)} &bull; {lastGame.venue}
                </span>
                <a
                  href={lastGame.recapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 text-sm font-medium hover:underline"
                >
                  Recap &rarr;
                </a>
              </div>
            </div>
          )}

          {/* News headlines */}
          {news && news.length > 0 ? (
            <div className="space-y-3">
              <p className="text-gray-500 text-xs uppercase tracking-wider">Latest News</p>
              {news.map((item, i) => (
                <a
                  key={i}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <p className="text-gray-100 text-sm leading-snug group-hover:text-blue-400 transition-colors">
                    {item.headline}
                  </p>
                  {item.description && (
                    <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">
                      {item.description}
                    </p>
                  )}
                  <p className="text-gray-600 text-xs mt-0.5">{timeAgo(item.published)}</p>
                  {i < news.length - 1 && (
                    <div className="border-t border-white/5 mt-3" />
                  )}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Regular season resumes October 2026.</p>
          )}
        </>
      )}

      {/* Regular season / active playoff view */}
      {!isOffseason && (
        <>
          {lastGame && (
            <div className="mb-4">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">
                {lastGame.isPlayoff ? "Last Playoff Game" : "Last Game"}
              </p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <img src={lastGame.awayTeam.logo} alt={lastGame.awayTeam.abbrev} className="w-6 h-6" />
                  <span className={`font-bold text-lg ${
                    lastGame.awayTeam.abbrev === "TBL"
                      ? lastGame.won ? "text-green-400" : "text-red-400"
                      : "text-gray-300"
                  }`}>
                    {lastGame.awayTeam.abbrev} {lastGame.awayTeam.score}
                  </span>
                </div>
                <span className="text-gray-500">—</span>
                <div className="flex items-center gap-1.5">
                  <img src={lastGame.homeTeam.logo} alt={lastGame.homeTeam.abbrev} className="w-6 h-6" />
                  <span className={`font-bold text-lg ${
                    lastGame.homeTeam.abbrev === "TBL"
                      ? lastGame.won ? "text-green-400" : "text-red-400"
                      : "text-gray-300"
                  }`}>
                    {lastGame.homeTeam.abbrev} {lastGame.homeTeam.score}
                  </span>
                </div>
                {lastGame.overtimeType && (
                  <span className="text-gray-500 text-sm">({lastGame.overtimeType})</span>
                )}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-gray-500 text-sm">
                  {formatGameDate(lastGame.date)} &bull; {lastGame.venue}
                </span>
                <a
                  href={lastGame.recapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 text-sm font-medium hover:underline"
                >
                  Recap &rarr;
                </a>
              </div>
            </div>
          )}

          {lastGame && nextGame && <div className="border-t border-white/10 my-4" />}

          {nextGame && (
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">
                Next Game
              </p>
              <div className="flex items-center gap-2">
                <img src={nextGame.opponentLogo} alt="" className="w-6 h-6" />
                <span className="text-gray-100 font-medium">
                  {nextGame.isHome ? "vs" : "@"} {nextGame.opponentName}
                </span>
              </div>
              <p className="text-gray-400 text-sm mt-1.5">
                {formatNextGameDateTime(nextGame.startTimeUTC)}
                {nextGame.broadcast && <> &bull; {nextGame.broadcast}</>}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
