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

function getSeasonId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  // NHL season starts in October
  if (month >= 10) {
    return `${year}${year + 1}`;
  }
  return `${year - 1}${year}`;
}

function getBroadcast(game: NHLGame): string | null {
  if (!game.tvBroadcasts?.length) return null;
  // Prefer US national broadcast, then US home/away, then any
  const national = game.tvBroadcasts.find(
    (b) => b.countryCode === "US" && b.market === "N"
  );
  if (national) return national.network;
  const us = game.tvBroadcasts.find((b) => b.countryCode === "US");
  if (us) return us.network;
  return game.tvBroadcasts[0].network;
}

export async function GET() {
  const seasonId = getSeasonId();

  try {
    const res = await fetch(
      `https://api-web.nhle.com/v1/club-schedule-season/TBL/${seasonId}`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "NHL API error" },
        { status: res.status }
      );
    }

    const data = await res.json();
    const games: NHLGame[] = data.games || [];

    // Only regular season + playoffs (gameType 2 and 3)
    const seasonGames = games.filter((g) => g.gameType >= 2);

    const today = new Date().toISOString().slice(0, 10);

    // Completed games: FINAL or OFF, with a date <= today
    const completedStates = new Set(["FINAL", "OFF"]);
    const completed = seasonGames.filter(
      (g) => completedStates.has(g.gameState) && g.gameDate <= today
    );
    const lastGame = completed.length > 0 ? completed[completed.length - 1] : null;

    // Future games: FUT state, or date > today
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

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch Lightning schedule" },
      { status: 500 }
    );
  }
}
