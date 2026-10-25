import "server-only";
import type { Player } from "@prisma/client";
import { db } from "./db";
import { fail } from "./api";
import { POSITIONS, eloAverage, opggUrl } from "./lol";

export const MAX_PLAYERS = 10;

/** Coach y capitán administran a los jugadores; el analista solo los consulta. */
export const canManagePlayers = (role: string) => role === "COACH" || role === "CAPTAIN";

const order = (p: Pick<Player, "position">) => POSITIONS.findIndex((x) => x.id === p.position);

export function playerDTO(p: Player, region: string) {
  return {
    id: p.id,
    gameName: p.gameName,
    tagLine: p.tagLine,
    riotId: `${p.gameName}#${p.tagLine}`,
    position: p.position,
    tier: p.tier,
    division: p.division,
    lp: p.lp,
    opgg: opggUrl(region, p.gameName, p.tagLine),
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
    players: players.map((p) => playerDTO(p, team!.region)),
    eloAverage: eloAverage(players),
  };
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
