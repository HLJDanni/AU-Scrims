import "server-only";
import { db } from "./db";
import { tierFor } from "./elo";
import type { LolTier } from "./lol";

export type LeaderboardRow = {
  id: string;
  rank: number;
  name: string;
  tag: string;
  color: string;
  region: string;
  rating: number;
  tier: string;
  tierColor: string;
  tierIcon: LolTier;
  scrims: number;
  scrimWins: number;
  gamesWon: number;
  gamesLost: number;
  winRate: number;
  streak: string; // p.ej. "W3" / "L1"
  form: ("W" | "L" | "D")[]; // últimos 5
};

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const [teams, completed] = await Promise.all([
    db.team.findMany({ select: { id: true, name: true, tag: true, color: true, logoUpdatedAt: true, region: true, rating: true } }),
    db.scrim.findMany({
      where: { status: "COMPLETED" },
      select: { requesterTeamId: true, opponentTeamId: true, requesterScore: true, opponentScore: true, startAt: true },
      orderBy: { startAt: "desc" },
    }),
  ]);

  const stats = new Map(teams.map((t) => [t.id, { scrims: 0, scrimWins: 0, gamesWon: 0, gamesLost: 0, results: [] as ("W" | "L" | "D")[] }]));
  for (const s of completed) {
    const h = s.requesterScore ?? 0;
    const a = s.opponentScore ?? 0;
    const home = stats.get(s.requesterTeamId);
    const away = stats.get(s.opponentTeamId);
    if (home) {
      home.scrims++;
      home.gamesWon += h;
      home.gamesLost += a;
      if (h > a) home.scrimWins++;
      home.results.push(h > a ? "W" : h < a ? "L" : "D");
    }
    if (away) {
      away.scrims++;
      away.gamesWon += a;
      away.gamesLost += h;
      if (a > h) away.scrimWins++;
      away.results.push(a > h ? "W" : a < h ? "L" : "D");
    }
  }

  return teams
    .map((t) => {
      const s = stats.get(t.id)!;
      const tier = tierFor(t.rating);
      let streakCount = 0;
      const first = s.results[0];
      for (const r of s.results) {
        if (r !== first) break;
        streakCount++;
      }
      const played = s.gamesWon + s.gamesLost;
      return {
        id: t.id,
        rank: 0,
        name: t.name,
        tag: t.tag,
        color: t.color,
        logoUpdatedAt: t.logoUpdatedAt,
        region: t.region,
        rating: t.rating,
        tier: tier.name,
        tierColor: tier.color,
        tierIcon: tier.icon,
        scrims: s.scrims,
        scrimWins: s.scrimWins,
        gamesWon: s.gamesWon,
        gamesLost: s.gamesLost,
        winRate: played ? Math.round((s.gamesWon / played) * 100) : 0,
        streak: first ? `${first}${streakCount}` : "—",
        form: s.results.slice(0, 5),
      };
    })
    .sort((a, b) => b.rating - a.rating || b.winRate - a.winRate || b.scrims - a.scrims)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}
