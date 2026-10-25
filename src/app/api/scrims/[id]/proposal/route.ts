import { db } from "@/lib/db";
import { fail, parseBody, withStaff } from "@/lib/api";
import { proposalSchema } from "@/lib/validators";
import { assertNoOverlap, loadOwnScrim, logEvent, scrimInclude, toDTO } from "@/lib/scrims";

const CLEAR = { proposedStartAt: null, proposedEndAt: null, proposedGames: null, proposedByTeamId: null };

/** Aceptar/rechazar una propuesta de re-agenda. El equipo que propuso puede retirarla con "reject". */
export const POST = withStaff<{ id: string }>(async ({ req, user, params }) => {
  const { action } = await parseBody(req, proposalSchema);
  const scrim = await loadOwnScrim(params.id, user.teamId);
  if (!scrim.proposedStartAt || !scrim.proposedEndAt) fail(400, "No hay una propuesta pendiente");
  if (scrim.status !== "PENDING" && scrim.status !== "CONFIRMED") fail(400, "Este scrim ya no está activo");
  const mine = scrim.proposedByTeamId === user.teamId;
  if (action === "accept" && mine) fail(403, "El otro equipo debe aprobar tu propuesta");

  const updated = await db.$transaction(async (tx) => {
    if (action === "accept") {
      await assertNoOverlap(tx, [scrim.requesterTeamId, scrim.opponentTeamId], scrim.proposedStartAt!, scrim.proposedEndAt!, scrim.id);
    }
    const s = await tx.scrim.update({
      where: { id: scrim.id },
      data:
        action === "accept"
          ? {
              startAt: scrim.proposedStartAt!,
              endAt: scrim.proposedEndAt!,
              games: scrim.proposedGames ?? scrim.games,
              status: "CONFIRMED",
              ...CLEAR,
            }
          : CLEAR,
      include: scrimInclude,
    });
    const msg =
      action === "accept"
        ? `${user.username} aprobó el nuevo horario`
        : mine
          ? `${user.username} retiró la propuesta de re-agenda`
          : `${user.username} rechazó la propuesta de re-agenda`;
    await logEvent(tx, s.id, user.id, action === "accept" ? "PROPOSAL_ACCEPTED" : "PROPOSAL_REJECTED", msg);
    return s;
  });

  return { scrim: toDTO(updated, user.teamId) };
});
