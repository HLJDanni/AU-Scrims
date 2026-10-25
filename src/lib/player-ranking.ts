// Ranking de jugadores de la plataforma: win rate de SoloQ, KDA de partidas recientes y su evolución.
// Funciones puras (sin BD) para poder probarlas.
import type { Position } from "./lol";

export const MIN_GAMES = 20; // partidas de SoloQ mínimas para entrar al ranking
export const KDA_MATCHES = 20; // partidas recientes usadas para el KDA
export const TOP_N = 20;

export type RankingInput = {
  id: string;
  gameName: string;
  tagLine: string;
  position: Position;
  team: { id: string; name: string; tag: string; color: string };
  wins: number | null;
  losses: number | null;
  matches: { kills: number; deaths: number; assists: number; playedAt: Date }[];
  snapshots: { takenAt: Date; wins: number; losses: number }[];
};

export type RankedPlayer = {
  id: string;
  rank: number;
  riotId: string;
  gameName: string;
  tagLine: string;
  position: Position;
  team: RankingInput["team"];
  games: number;
  winRate: number; // 0-100, un decimal
  kda: number | null; // (K + A) / max(1, D)
  avg: { kills: number; deaths: number; assists: number } | null;
  trend: number[]; // win rate en cada foto, de la más antigua a la más reciente
  delta: number | null; // puntos de win rate ganados desde la foto más antigua
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const wr = (w: number, l: number) => (w + l ? (w / (w + l)) * 100 : 0);

/** KDA de las partidas más recientes. */
export function kdaOf(matches: RankingInput["matches"], limit = KDA_MATCHES) {
  const recent = [...matches].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime()).slice(0, limit);
  if (!recent.length) return { kda: null, avg: null };
  const k = recent.reduce((s, m) => s + m.kills, 0);
  const d = recent.reduce((s, m) => s + m.deaths, 0);
  const a = recent.reduce((s, m) => s + m.assists, 0);
  return {
    kda: round1((k + a) / Math.max(1, d)),
    avg: { kills: round1(k / recent.length), deaths: round1(d / recent.length), assists: round1(a / recent.length) },
  };
}

/**
 * Ordena por win rate (desempate: más partidas y luego mejor KDA). Solo entran jugadores con
 * MIN_GAMES partidas de SoloQ, para que 3 victorias seguidas no valgan un 100 %.
 */
export function rankPlayers(rows: RankingInput[], { position, limit = TOP_N }: { position?: Position | "ALL"; limit?: number } = {}): RankedPlayer[] {
  return rows
    .filter((p) => !position || position === "ALL" || p.position === position)
    .map((p) => {
      const games = (p.wins ?? 0) + (p.losses ?? 0);
      const winRate = round1(wr(p.wins ?? 0, p.losses ?? 0));
      const { kda, avg } = kdaOf(p.matches);
      const shots = [...p.snapshots].sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime()).filter((s) => s.wins + s.losses > 0);
      const trend = shots.map((s) => round1(wr(s.wins, s.losses)));
      if (trend.length === 0 || trend[trend.length - 1] !== winRate) trend.push(winRate);
      return {
        id: p.id,
        rank: 0,
        riotId: `${p.gameName}#${p.tagLine}`,
        gameName: p.gameName,
        tagLine: p.tagLine,
        position: p.position,
        team: p.team,
        games,
        winRate,
        kda,
        avg,
        trend,
        delta: trend.length > 1 ? round1(winRate - trend[0]) : null,
      };
    })
    .filter((p) => p.games >= MIN_GAMES)
    .sort((a, b) => b.winRate - a.winRate || b.games - a.games || (b.kda ?? 0) - (a.kda ?? 0))
    .slice(0, limit)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}
