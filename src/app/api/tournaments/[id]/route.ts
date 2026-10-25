import { db } from "@/lib/db";
import { fail, withTeam } from "@/lib/api";
import { tournamentDetail } from "@/lib/tournaments";

export const GET = withTeam<{ id: string }>(async ({ user, params }) => tournamentDetail(params.id, { teamId: user.teamId, role: user.role }));

/** Cancelar un torneo que aún no empezó (coach del equipo organizador). */
export const DELETE = withTeam<{ id: string }>(async ({ user, params }) => {
  const t = await db.tournament.findUnique({ where: { id: params.id } });
  if (!t) fail(404, "Torneo no encontrado");
  if (t!.organizerTeamId !== user.teamId || user.role !== "COACH") fail(403, "Solo el coach organizador puede cancelar el torneo");
  if (t!.status !== "REGISTRATION") fail(400, "Solo se puede cancelar antes de iniciar");
  await db.tournament.delete({ where: { id: params.id } });
  return { ok: true };
});
