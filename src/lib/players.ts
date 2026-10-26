import "server-only";
import type { Player } from "@prisma/client";
import { db } from "./db";
import { fail } from "./api";
import { MAX_PLAYERS, MAX_SUBS, POSITIONS, eloAverage } from "./lol";
import { RiotError, fetchRankedProfile, riotEnabled, riotHttpStatus, type RankedProfile } from "./riot";


/** Coach y capitán administran a los jugadores; el analista solo los consulta. */
export const canManagePlayers = (role: string) => role === "COACH" || role === "CAPTAIN";

const order = (p: Pick<Player, "position">) => POSITIONS.findIndex((x) => x.id === p.position);

export function playerDTO(p: Player & { user?: { username: string } | null }) {
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
    // Usuario de AU Scrims del jugador (Leyenda que se unió con el código del equipo)
    account: p.user?.username ?? null,
  };
}

export async function getTeamProfile(teamId: string) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, tag: true, color: true, logoUpdatedAt: true, region: true, rating: true, description: true, players: { include: { user: { select: { username: true } } } } },
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

/**
 * Valida un alta de jugador (servidor, cupo, posición, cuenta repetida) y, si hay RIOT_API_KEY,
 * verifica la cuenta y trae su rango. Devuelve los datos listos para crear el Player.
 */
export async function preparePlayer(
  team: { id: string; region: string },
  input: { opggRegion: string; gameName: string; tagLine: string; opggUrl: string; position: Player["position"] },
) {
  const { opggRegion, ...data } = input;
  assertSameRegion(opggRegion, team.region);
  await assertPlayerAllowed(team.id, data);
  const ranked = riotEnabled() ? rankedFields(await loadRankedProfile(opggRegion, data.gameName, data.tagLine)) : {};
  return { ...data, ...ranked, teamId: team.id };
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
  if (!excludeId && others.length >= MAX_PLAYERS) fail(400, `El roster admite máximo ${MAX_PLAYERS} jugadores (5 titulares y ${MAX_SUBS} suplentes)`);
  if (data.position === "SUB" && others.filter((p) => p.position === "SUB").length >= MAX_SUBS)
    fail(409, `El equipo ya tiene ${MAX_SUBS} suplentes, el máximo. Elige una posición titular libre o quita a un suplente.`);
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
