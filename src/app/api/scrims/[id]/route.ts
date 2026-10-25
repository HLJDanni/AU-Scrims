import { db } from "@/lib/db";
import { fail, parseBody, withTeam } from "@/lib/api";
import { updateScrimSchema } from "@/lib/validators";
import { loadOwnScrim, logEvent, scrimInclude, toDTO } from "@/lib/scrims";

export const GET = withTeam<{ id: string }>(async ({ user, params }) => {
  const scrim = await loadOwnScrim(params.id, user.teamId);
  const events = await db.scrimEvent.findMany({
    where: { scrimId: scrim.id },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { username: true } } },
    take: 50,
  });
  return {
    scrim: toDTO(scrim, user.teamId),
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      actor: e.actor?.username ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
  };
});

/** Actualiza el link de sala y/o notas. */
export const PATCH = withTeam<{ id: string }>(async ({ req, user, params }) => {
  const body = await parseBody(req, updateScrimSchema);
  const scrim = await loadOwnScrim(params.id, user.teamId);
  if (scrim.status === "CANCELLED" || scrim.status === "DECLINED") fail(400, "Este scrim ya no está activo");

  const updated = await db.$transaction(async (tx) => {
    const data: { roomLink?: string | null; notes?: string | null } = {};
    if (body.roomLink !== undefined) data.roomLink = body.roomLink ?? null;
    if (body.notes !== undefined) data.notes = body.notes || null;
    const s = await tx.scrim.update({ where: { id: scrim.id }, data, include: scrimInclude });
    if (body.roomLink !== undefined && body.roomLink !== scrim.roomLink)
      await logEvent(tx, s.id, user.id, "ROOM", data.roomLink ? `${user.username} actualizó el link de la sala` : `${user.username} quitó el link de la sala`);
    if (body.notes !== undefined && (body.notes || null) !== scrim.notes)
      await logEvent(tx, s.id, user.id, "NOTES", `${user.username} actualizó las notas`);
    return s;
  });
  return { scrim: toDTO(updated, user.teamId) };
});
