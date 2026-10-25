import { db } from "@/lib/db";
import { fail, withTeam } from "@/lib/api";
import { DIVISIONS, MAX_TEAMS } from "@/lib/tournament-rules";
import { eligibilityOf } from "@/lib/tournaments";

/** Inscribir a mi equipo (coach o capitán). Solo equipos elegibles de la misma división. */
export const POST = withTeam<{ id: string }>(async ({ user, params }) => {
  if (user.role !== "COACH" && user.role !== "CAPTAIN") fail(403, "Solo el coach o el capitán pueden inscribir al equipo");
  const t = await db.tournament.findUnique({ where: { id: params.id }, include: { _count: { select: { entries: true } } } });
  if (!t) fail(404, "Torneo no encontrado");
  if (t!.status !== "REGISTRATION") fail(400, "Las inscripciones están cerradas");
  if (t!._count.entries >= MAX_TEAMS) fail(400, `El torneo está lleno (${MAX_TEAMS} equipos)`);

  const e = await eligibilityOf(user.teamId);
  if (!e.division) {
    const missing = e.checks.filter((c) => !c.ok).map((c) => c.detail);
    fail(403, `Tu equipo no cumple los requisitos: ${missing.join(" · ")}`);
  }
  if (e.division !== t!.division)
    fail(403, `Este torneo es de la ${DIVISIONS[t!.division].name}; tu equipo pertenece a la ${DIVISIONS[e.division!].name}`);

  const exists = await db.tournamentEntry.findUnique({ where: { tournamentId_teamId: { tournamentId: t!.id, teamId: user.teamId } } });
  if (exists) fail(409, "Tu equipo ya está inscrito");
  await db.tournamentEntry.create({
    data: { tournamentId: t!.id, teamId: user.teamId, ratingAtJoin: e.team.rating, eloAtJoin: e.eloLabel ?? "—" },
  });
  return { ok: true };
});
