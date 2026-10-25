import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fail, parseBody, withTeam } from "@/lib/api";
import { createScrimSchema } from "@/lib/validators";
import { assertNoOverlap, logEvent, scrimInclude, toDTO } from "@/lib/scrims";

/**
 * Scrims de MI equipo. scope:
 *  - calendar  (from, to)  → activos y finalizados en el rango
 *  - upcoming              → confirmados por jugar
 *  - requests              → pendientes de respuesta o con re-agenda pendiente
 *  - history               → finalizados, cancelados, rechazados o ya pasados
 */
export const GET = withTeam(async ({ req, user }) => {
  const sp = new URL(req.url).searchParams;
  const scope = sp.get("scope") ?? "upcoming";
  const teamId = user.teamId;
  const mine: Prisma.ScrimWhereInput = { OR: [{ requesterTeamId: teamId }, { opponentTeamId: teamId }] };
  const now = new Date();

  let where: Prisma.ScrimWhereInput;
  let orderBy: Prisma.ScrimOrderByWithRelationInput = { startAt: "asc" };
  let take = 200;

  switch (scope) {
    case "calendar": {
      const from = new Date(sp.get("from") ?? "");
      const to = new Date(sp.get("to") ?? "");
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) fail(400, "Rango de fechas inválido");
      where = { AND: [mine, { status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] }, startAt: { lt: to }, endAt: { gt: from } }] };
      break;
    }
    case "upcoming":
      where = { AND: [mine, { status: "CONFIRMED", endAt: { gte: now } }] };
      break;
    case "requests":
      where = {
        AND: [
          mine,
          { endAt: { gte: now } },
          { OR: [{ status: "PENDING" }, { status: "CONFIRMED", proposedStartAt: { not: null } }] },
        ],
      };
      break;
    case "history":
      where = {
        AND: [mine, { OR: [{ status: { in: ["COMPLETED", "CANCELLED", "DECLINED"] } }, { endAt: { lt: now } }] }],
      };
      orderBy = { startAt: "desc" };
      take = 300;
      break;
    default:
      fail(400, "Scope inválido");
  }

  const scrims = await db.scrim.findMany({ where: where!, orderBy, take, include: scrimInclude });
  return { scrims: scrims.map((s) => toDTO(s, teamId)) };
});

/** Agendar un scrim nuevo (solicitud al equipo rival). */
export const POST = withTeam(async ({ req, user }) => {
  const body = await parseBody(req, createScrimSchema);
  if (body.opponentTeamId === user.teamId) fail(400, "No puedes agendar contra tu propio equipo");
  const opponent = await db.team.findUnique({ where: { id: body.opponentTeamId } });
  if (!opponent) fail(404, "Equipo rival no encontrado");

  const scrim = await db.$transaction(async (tx) => {
    await assertNoOverlap(tx, [user.teamId, body.opponentTeamId], body.startAt, body.endAt);
    const created = await tx.scrim.create({
      data: {
        requesterTeamId: user.teamId,
        opponentTeamId: body.opponentTeamId,
        createdById: user.id,
        startAt: body.startAt,
        endAt: body.endAt,
        games: body.games,
        roomLink: body.roomLink ?? null,
        notes: body.notes || null,
      },
      include: scrimInclude,
    });
    await logEvent(tx, created.id, user.id, "CREATED", `${user.username} envió la solicitud de scrim (${body.games} juegos)`);
    return created;
  });

  return { scrim: toDTO(scrim, user.teamId) };
});
