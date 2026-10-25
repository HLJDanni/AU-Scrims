import { db } from "@/lib/db";
import { fail, withStaff } from "@/lib/api";
import { loadOwnScrim, logEvent, scrimInclude, toDTO } from "@/lib/scrims";

export const POST = withStaff<{ id: string }>(async ({ user, params }) => {
  const scrim = await loadOwnScrim(params.id, user.teamId);
  if (scrim.status !== "PENDING" && scrim.status !== "CONFIRMED") fail(400, "Este scrim ya no está activo");

  const updated = await db.$transaction(async (tx) => {
    const s = await tx.scrim.update({
      where: { id: scrim.id },
      data: { status: "CANCELLED", proposedStartAt: null, proposedEndAt: null, proposedGames: null, proposedByTeamId: null },
      include: scrimInclude,
    });
    await logEvent(tx, s.id, user.id, "CANCELLED", `${user.username} canceló el scrim`);
    return s;
  });
  return { scrim: toDTO(updated, user.teamId) };
});
