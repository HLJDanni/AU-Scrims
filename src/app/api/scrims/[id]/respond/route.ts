import { db } from "@/lib/db";
import { fail, parseBody, withStaff } from "@/lib/api";
import { respondSchema } from "@/lib/validators";
import { assertNoOverlap, loadOwnScrim, logEvent, scrimInclude, toDTO } from "@/lib/scrims";

/** El equipo invitado acepta o rechaza la solicitud. */
export const POST = withStaff<{ id: string }>(async ({ req, user, params }) => {
  const { action } = await parseBody(req, respondSchema);
  const scrim = await loadOwnScrim(params.id, user.teamId);
  if (scrim.status !== "PENDING") fail(400, "La solicitud ya fue respondida");
  if (scrim.opponentTeamId !== user.teamId) fail(403, "Solo el equipo invitado puede responder");
  if (scrim.endAt < new Date()) fail(400, "La solicitud ya expiró");

  const updated = await db.$transaction(async (tx) => {
    if (action === "accept") {
      await assertNoOverlap(tx, [scrim.requesterTeamId, scrim.opponentTeamId], scrim.startAt, scrim.endAt, scrim.id);
    }
    const s = await tx.scrim.update({
      where: { id: scrim.id },
      data:
        action === "accept"
          ? { status: "CONFIRMED", proposedStartAt: null, proposedEndAt: null, proposedGames: null, proposedByTeamId: null }
          : { status: "DECLINED" },
      include: scrimInclude,
    });
    await logEvent(tx, s.id, user.id, action === "accept" ? "ACCEPTED" : "DECLINED",
      `${user.username} ${action === "accept" ? "aceptó" : "rechazó"} el scrim`);
    return s;
  });
  return { scrim: toDTO(updated, user.teamId) };
});
