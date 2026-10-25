import { db } from "@/lib/db";
import { fail, withTeam } from "@/lib/api";

/** Retirar a mi equipo antes de que empiece el torneo. El organizador no puede retirarse (debe cancelarlo). */
export const POST = withTeam<{ id: string }>(async ({ user, params }) => {
  if (user.role !== "COACH" && user.role !== "CAPTAIN") fail(403, "Solo el coach o el capitán pueden retirar al equipo");
  const t = await db.tournament.findUnique({ where: { id: params.id } });
  if (!t) fail(404, "Torneo no encontrado");
  if (t!.status !== "REGISTRATION") fail(400, "El torneo ya comenzó");
  if (t!.organizerTeamId === user.teamId) fail(400, "El equipo organizador no puede retirarse; cancela el torneo");
  const removed = await db.tournamentEntry.deleteMany({ where: { tournamentId: t!.id, teamId: user.teamId } });
  if (removed.count === 0) fail(404, "Tu equipo no está inscrito");
  return { ok: true };
});
