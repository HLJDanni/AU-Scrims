import { db } from "@/lib/db";
import { fail, parseBody, withStaff } from "@/lib/api";
import { rescheduleSchema } from "@/lib/validators";
import { assertNoOverlap, loadOwnScrim, logEvent, scrimInclude, toDTO } from "@/lib/scrims";

const fmt = (d: Date) =>
  d.toLocaleString("es-GT", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guatemala" });

/**
 * Re-agendar.
 *  - Si la solicitud sigue PENDIENTE y la hizo mi equipo → se mueve directamente.
 *  - En cualquier otro caso → queda una propuesta que el otro equipo debe aprobar.
 */
export const POST = withStaff<{ id: string }>(async ({ req, user, params }) => {
  const body = await parseBody(req, rescheduleSchema);
  const scrim = await loadOwnScrim(params.id, user.teamId);
  if (scrim.status !== "PENDING" && scrim.status !== "CONFIRMED") fail(400, "Este scrim no se puede re-agendar");
  if (scrim.startAt < new Date()) fail(400, "El scrim ya comenzó, no se puede re-agendar");

  const direct = scrim.status === "PENDING" && scrim.requesterTeamId === user.teamId;
  const teams = [scrim.requesterTeamId, scrim.opponentTeamId];

  const updated = await db.$transaction(async (tx) => {
    await assertNoOverlap(tx, teams, body.startAt, body.endAt, scrim.id);
    const s = await tx.scrim.update({
      where: { id: scrim.id },
      data: direct
        ? {
            startAt: body.startAt,
            endAt: body.endAt,
            games: body.games,
            proposedStartAt: null,
            proposedEndAt: null,
            proposedGames: null,
            proposedByTeamId: null,
          }
        : {
            proposedStartAt: body.startAt,
            proposedEndAt: body.endAt,
            proposedGames: body.games,
            proposedByTeamId: user.teamId,
          },
      include: scrimInclude,
    });
    await logEvent(
      tx,
      s.id,
      user.id,
      direct ? "MOVED" : "PROPOSED",
      direct
        ? `${user.username} movió el scrim a ${fmt(body.startAt)} (${body.games} juegos)`
        : `${user.username} propuso re-agendar a ${fmt(body.startAt)} (${body.games} juegos)`,
    );
    return s;
  });

  return { scrim: toDTO(updated, user.teamId), direct };
});
