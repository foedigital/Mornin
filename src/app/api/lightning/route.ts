import { NextResponse } from "next/server";

interface NHLTeam {
  abbrev: string;
  commonName: { default: string };
  placeName: { default: string };
  logo: string;
  score?: number;
}

interface NHLGame {
  id: number;
  gameDate: string;
  startTimeUTC: string;
  gameState: string;
  gameType: number;
  homeTeam: NHLTeam;
  awayTeam: NHLTeam;
  venue: { default: string };
  gameCenterLink: string;
  threeMinRecap?: string;
  periodDescriptor?: { periodType: string };
  tvBroadcasts?: { market: string; countryCode: string; network: string }[];
}

interface ESPNArticle {
  headline: string;
  description?: string;
  published?: string;
  links?: { web?: { href?: string } };
}

function getSeasonId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 10) return `${year}${year + 1}`;
  return `${year - 1}${year}`;
}

function getBroadcast(game: NHLGame): string | null {
  if (!game.tvBroadcasts?.length) return null;
  const national = game.tvBroadcasts.find(
    (b) => b.countryCode === "US" && b.market === "N"
  );
  if (national) return national.network;
  const us = game.tvBroadcasts.find((b) => b.countryCode === "US");
  if (us) return us.network;
  return game.tvBroadcasts[0].network;
}

async function fetchLightningNews() {
  // ESPN public API — Tampa Bay Lightning team ID 14
  const res = await fetch(
    "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/news?team=14&limit=6",
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const articles: ESPNArticle[] = data.articles || [];
  return articles.slice(0, 5).map((a) => ({
    headline: a.headline,
    description: a.description || "",
    link: a.links?.web?.href || "",
    published: a.published || "",
  }));
}

export const dynamic = "force-dynamic";

export async function GET() {
  const seasonId = getSeasonId();

  try {
    const res = await fetch(
      `https://api-web.nhle.com/v1/club-schedule-season/TBL/${seasonId}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "NHL API error" }, { status: res.status });
    }

    const data = await res.json();
    const games: NHLGame[] = data.games || [];
    const seasonGames = games.filter((g) => g.gameType >= 2);
    const today = new Date().toISOString().slice(0, 10);

    const completedStates = new Set(["FINAL", "OFF"]);
    const completed = seasonGames.filter(
      (g) => completedStates.has(g.gameState) && g.gameDate <= today
    );
    const lastGame = completed.length > 0 ? completed[completed.length - 1] : null;

    const upcoming = seasonGames.filter(
      (g) => g.gameState === "FUT" || g.gameDate > today
    );
    const nextGame = upcoming.length > 0 ? upcoming[0] : null;

    const result: Record<string, unknown> = {};

    if (lastGame) {
      const isTBLHome = lastGame.homeTeam.abbrev === "TBL";
      const tblScore = isTBLHome ? lastGame.homeTeam.score : lastGame.awayTeam.score;
      const oppScore = isTBLHome ? lastGame.awayTeam.score : lastGame.homeTeam.score;
      const won = (tblScore ?? 0) > (oppScore ?? 0);

      let overtimeType: string | null = null;
      if (lastGame.periodDescriptor?.periodType === "OT") overtimeType = "OT";
      if (lastGame.periodDescriptor?.periodType === "SO") overtimeType = "SO";

      const recapLink = lastGame.threeMinRecap
        ? `https://www.nhl.com${lastGame.threeMinRecap}`
        : `https://www.nhl.com${lastGame.gameCenterLink}`;

      result.lastGame = {
        id: lastGame.id,
        date: lastGame.gameDate,
        isPlayoff: lastGame.gameType === 3,
        homeTeam: {
          abbrev: lastGame.homeTeam.abbrev,
          name: lastGame.homeTeam.commonName.default,
          score: lastGame.homeTeam.score,
          logo: lastGame.homeTeam.logo,
        },
        awayTeam: {
          abbrev: lastGame.awayTeam.abbrev,
          name: lastGame.awayTeam.commonName.default,
          score: lastGame.awayTeam.score,
          logo: lastGame.awayTeam.logo,
        },
        isHome: isTBLHome,
        won,
        overtimeType,
        venue: lastGame.venue.default,
        recapLink,
      };
    }

    if (nextGame) {
      const isTBLHome = nextGame.homeTeam.abbrev === "TBL";
      const opponent = isTBLHome ? nextGame.awayTeam : nextGame.homeTeam;
      result.nextGame = {
        date: nextGame.gameDate,
        startTimeUTC: nextGame.startTimeUTC,
        homeTeam: {
          abbrev: nextGame.homeTeam.abbrev,
          name: nextGame.homeTeam.commonName.default,
          logo: nextGame.homeTeam.logo,
        },
        awayTeam: {
          abbrev: nextGame.awayTeam.abbrev,
          name: nextGame.awayTeam.commonName.default,
          logo: nextGame.awayTeam.logo,
        },
        isHome: isTBLHome,
        opponentLogo: opponent.logo,
        opponentName: `${opponent.placeName.default} ${opponent.commonName.default}`,
        venue: nextGame.venue.default,
        broadcast: getBroadcast(nextGame),
      };
    }

    // Offseason: no upcoming games — fetch news headlines instead
    if (!nextGame) {
      result.isOffseason = true;
      try {
        result.news = await fetchLightningNews();
      } catch {
        result.news = [];
      }
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch Lightning schedule" },
      { status: 500 }
    );
  }
}
