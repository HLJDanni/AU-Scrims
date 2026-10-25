import { db } from "@/lib/db";
import { withUser } from "@/lib/api";
import { riotEnabled } from "@/lib/riot";
import { KDA_MATCHES, MIN_GAMES, TOP_N, rankPlayers } from "@/lib/player-ranking";

const POSITIONS = new Set(["ALL", "TOP", "JUNGLE", "MID", "ADC", "SUPPORT"]);

/**
 * Top de jugadores de la plataforma por win rate de SoloQ.
 * Es la única vista con jugadores de otros equipos: solo Riot ID, equipo, rol, KDA y win rate
 * (sin op.gg ni roster completo). Disponible para todos los roles, incluida la Leyenda.
 */
export const GET = withUser(async ({ req }) => {
  const p = new URL(req.url).searchParams.get("position")?.toUpperCase() ?? "ALL";
  const position = POSITIONS.has(p) ? (p as "ALL") : "ALL";
  const since = new Date(Date.now() - 90 * 86400_000);

  const rows = await db.player.findMany({
    where: { wins: { not: null }, ...(position !== "ALL" ? { position } : {}) },
    select: {
      id: true,
      gameName: true,
      tagLine: true,
      position: true,
      wins: true,
      losses: true,
      team: { select: { id: true, name: true, tag: true, color: true } },
      matches: { orderBy: { playedAt: "desc" }, take: KDA_MATCHES, select: { kills: true, deaths: true, assists: true, playedAt: true } },
      snapshots: { where: { takenAt: { gte: since } }, orderBy: { takenAt: "asc" }, select: { takenAt: true, wins: true, losses: true } },
    },
  });

  return {
    players: rankPlayers(rows, { position, limit: TOP_N }),
    minGames: MIN_GAMES,
    kdaMatches: KDA_MATCHES,
    source: riotEnabled() ? "riot" : "demo",
  };
});
