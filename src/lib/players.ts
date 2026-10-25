import "server-only";
import type { Player } from "@prisma/client";
import { db } from "./db";
import { fail } from "./api";
import { POSITIONS, eloAverage } from "./lol";
import { RiotError, fetchRankedProfile, fetchRecentRankedMatches, riotEnabled, riotHttpStatus, type RankedProfile } from "./riot";

export const MAX_PLAYERS = 10;

/** Coach y capitán administran a los jugadores; el analista solo los consulta. */
export const canManagePlayers = (role: string) => role === "COACH" || role === "CAPTAIN";

const order = (p: Pick<Player, "position">) => POSITIONS.findIndex((x) => x.id === p.position);

export function playerDTO(p: Player) {
  return {
    id: p.id,
    gameName: p.gameName,
    tagLine: p.tagLine,
    riotId: `${p.gameName}#${p.tagLine}`,
    position: p.position,
    tier: p.tier,
    division: p.division,
    lp: p.lp,
    opgg: p.opggUrl,
    level: p.summonerLevel,
    wins: p.wins,
    losses: p.losses,
    rankUpdatedAt: p.rankUpdatedAt?.toISOString() ?? null,
  };
}

export async function getTeamProfile(teamId: string) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, tag: true, color: true, region: true, rating: true, description: true, players: true },
  });
  if (!team) fail(404, "Equipo no encontrado");
  const players = [...team!.players].sort((a, b) => order(a) - order(b) || a.createdAt.getTime() - b.createdAt.getTime());
  const { players: _, ...info } = team!;
  return {
    team: info,
    players: players.map((p) => playerDTO(p)),
    eloAverage: eloAverage(players),
    rankSync: riotEnabled(),
  };
}

/**
 * ¿Puede este usuario ver los jugadores (Riot ID y op.gg) de un equipo?
 *  - Su propio equipo: siempre (todos los roles, incluida la Leyenda).
 *  - Otro equipo: solo coach o analista, y solo si ambos equipos tienen un scrim agendado o jugado entre ellos.
 */
export async function rosterAccess(viewer: { role: string; teamId: string | null }, teamId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (viewer.teamId === teamId) return { ok: true };
  if (!viewer.teamId || viewer.role === "LEGEND") return { ok: false, reason: "El roster de otros equipos es privado" };
  if (viewer.role !== "COACH" && viewer.role !== "ANALYST") return { ok: false, reason: "Solo el coach y el analista ven el roster del rival" };
  const mutual = await db.scrim.findFirst({
    where: {
      status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
      OR: [
        { requesterTeamId: viewer.teamId, opponentTeamId: teamId },
        { requesterTeamId: teamId, opponentTeamId: viewer.teamId },
      ],
    },
    select: { id: true },
  });
  return mutual ? { ok: true } : { ok: false, reason: "Se muestra cuando ambos equipos tengan un scrim agendado" };
}

/** Consulta a Riot y traduce sus errores a respuestas de nuestra API. */
export async function loadRankedProfile(region: string, gameName: string, tagLine: string): Promise<RankedProfile> {
  try {
    return await fetchRankedProfile(region, gameName, tagLine);
  } catch (e) {
    if (e instanceof RiotError) fail(riotHttpStatus(e), e.message);
    throw e;
  }
}

/** Campos del jugador que se guardan a partir del perfil de Riot. */
export function rankedFields(r: RankedProfile) {
  return {
    puuid: r.puuid,
    gameName: r.gameName,
    tagLine: r.tagLine,
    summonerLevel: r.summonerLevel,
    tier: r.tier,
    division: r.division,
    lp: r.lp,
    wins: r.wins,
    losses: r.losses,
    rankUpdatedAt: new Date(),
  };
}

/**
 * Después de traer el rango: guarda una foto (para ver la evolución) y las partidas de SoloQ nuevas (para el KDA).
 * Solo descarga partidas que aún no tenemos, como máximo 5 por jugador y sincronización.
 */
export async function recordPlayerStats(playerId: string, region: string, r: RankedProfile) {
  await db.playerSnapshot.create({
    data: { playerId, tier: r.tier, division: r.division, lp: r.lp, wins: r.wins ?? 0, losses: r.losses ?? 0 },
  });
  const known = new Set((await db.playerMatch.findMany({ where: { playerId }, select: { matchId: true } })).map((m) => m.matchId));
  const fresh = await fetchRecentRankedMatches(region, r.puuid, known);
  if (fresh.length) await db.playerMatch.createMany({ data: fresh.map((m) => ({ ...m, playerId })), skipDuplicates: true });
}

/** Actualiza el rango de todos los jugadores de un equipo. Devuelve cuántos se actualizaron y los errores. */
export async function syncTeamRanks(teamId: string, region: string) {
  const players = await db.player.findMany({ where: { teamId } });
  const failed: { riotId: string; error: string }[] = [];
  let updated = 0;
  // Secuencial para respetar el límite de la API (20 peticiones/s)
  for (const p of players) {
    try {
      const r = await fetchRankedProfile(region, p.gameName, p.tagLine);
      await db.player.update({ where: { id: p.id }, data: rankedFields(r) });
      await recordPlayerStats(p.id, region, r);
      updated++;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error desconocido";
      // Clave inválida o límite alcanzado: no tiene sentido seguir con el resto
      if (e instanceof RiotError && (e.kind === "auth" || e.kind === "rate_limit")) fail(riotHttpStatus(e), message);
      failed.push({ riotId: `${p.gameName}#${p.tagLine}`, error: message });
    }
  }
  return { updated, failed };
}

/** La cuenta de op.gg debe ser del mismo servidor en el que juega el equipo. */
export function assertSameRegion(opggRegion: string, teamRegion: string) {
  if (opggRegion !== teamRegion)
    fail(422, `El perfil de op.gg es del servidor ${opggRegion}, pero el equipo juega en ${teamRegion}`);
}

/** Valida cupo del roster, posición titular libre y que la cuenta no esté en otro equipo. */
export async function assertPlayerAllowed(
  teamId: string,
  data: { gameName: string; tagLine: string; position: string },
  excludeId?: string,
) {
  const others = await db.player.findMany({ where: { teamId, id: excludeId ? { not: excludeId } : undefined } });
  if (!excludeId && others.length >= MAX_PLAYERS) fail(400, `El roster admite máximo ${MAX_PLAYERS} jugadores`);
  if (data.position !== "SUB" && others.some((p) => p.position === data.position)) {
    const label = POSITIONS.find((p) => p.id === data.position)!.label;
    fail(409, `Ya hay un titular en ${label}. Cámbialo a suplente o edita al jugador actual.`);
  }
  const dup = await db.player.findFirst({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      gameName: { equals: data.gameName, mode: "insensitive" },
      tagLine: { equals: data.tagLine, mode: "insensitive" },
    },
    include: { team: { select: { tag: true } } },
  });
  if (dup) fail(409, `${data.gameName}#${data.tagLine} ya está registrado en [${dup!.team.tag}]`);
}
