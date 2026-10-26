import "server-only";
import type { Prisma, Scrim, Team } from "@prisma/client";
import { db } from "./db";
import { fail } from "./api";
import type { ScrimDTO, TeamLite } from "./constants";

export const scrimInclude = {
  requesterTeam: { select: { id: true, name: true, tag: true, color: true, logoUpdatedAt: true, rating: true, region: true } },
  opponentTeam: { select: { id: true, name: true, tag: true, color: true, logoUpdatedAt: true, rating: true, region: true } },
  createdBy: { select: { username: true } },
} satisfies Prisma.ScrimInclude;

type ScrimWithTeams = Scrim & {
  requesterTeam: TeamLite;
  opponentTeam: TeamLite;
  createdBy: { username: string } | null;
};

/** Serializa un scrim desde la perspectiva del equipo `teamId`. */
export function toDTO(s: ScrimWithTeams, teamId: string): ScrimDTO {
  const isHost = s.requesterTeamId === teamId;
  return {
    id: s.id,
    isHost,
    myTeam: isHost ? s.requesterTeam : s.opponentTeam,
    opponent: isHost ? s.opponentTeam : s.requesterTeam,
    startAt: s.startAt.toISOString(),
    endAt: s.endAt.toISOString(),
    games: s.games,
    status: s.status,
    roomLink: s.roomLink,
    notes: s.notes,
    createdBy: s.createdBy?.username ?? null,
    proposal:
      s.proposedStartAt && s.proposedEndAt
        ? {
            startAt: s.proposedStartAt.toISOString(),
            endAt: s.proposedEndAt.toISOString(),
            games: s.proposedGames ?? s.games,
            byMe: s.proposedByTeamId === teamId,
          }
        : null,
    myScore: isHost ? s.requesterScore : s.opponentScore,
    opponentScore: isHost ? s.opponentScore : s.requesterScore,
    ratingDelta: s.ratingDelta == null ? null : isHost ? s.ratingDelta : (s.opponentRatingDelta ?? -s.ratingDelta),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

/** Carga un scrim y verifica que el equipo del usuario participe en él. */
export async function loadOwnScrim(id: string, teamId: string) {
  const scrim = await db.scrim.findUnique({ where: { id }, include: scrimInclude });
  if (!scrim || (scrim.requesterTeamId !== teamId && scrim.opponentTeamId !== teamId)) fail(404, "Scrim no encontrado");
  return scrim!;
}

/** Lanza 409 si alguno de los equipos ya tiene un scrim activo que se cruce con el horario. */
export async function assertNoOverlap(
  tx: Prisma.TransactionClient,
  teamIds: string[],
  startAt: Date,
  endAt: Date,
  excludeId?: string,
) {
  const clash = await tx.scrim.findFirst({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      status: { in: ["PENDING", "CONFIRMED"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      OR: [{ requesterTeamId: { in: teamIds } }, { opponentTeamId: { in: teamIds } }],
    },
    include: { requesterTeam: { select: { tag: true } }, opponentTeam: { select: { tag: true } } },
  });
  if (clash) {
    fail(409, `Choque de horario con el scrim ${clash.requesterTeam.tag} vs ${clash.opponentTeam.tag}`);
  }
}

// Eventos que también se avisan en el chat del scrim (el chat se abre al aceptarse)
const CHAT_EVENTS: Record<string, (message: string) => string> = {
  ACCEPTED: (m) => `${m}. Se abrió este chat para que ambos equipos se pongan de acuerdo; el botón Draft abre la selección de campeones.`,
  PROPOSAL_ACCEPTED: (m) => m,
  ROOM: (m) => m,
  RESULT: (m) => m,
  CANCELLED: (m) => `${m}. El chat queda como historial.`,
};

export async function logEvent(tx: Prisma.TransactionClient, scrimId: string, actorId: string, type: string, message: string) {
  const event = await tx.scrimEvent.create({ data: { scrimId, actorId, type, message } });
  const toChat = CHAT_EVENTS[type];
  if (toChat) await tx.scrimMessage.create({ data: { scrimId, system: true, body: toChat(message) } });
  return event;
}

export const teamLabel = (t: Pick<Team, "tag">) => `[${t.tag}]`;
