import { db } from "@/lib/db";
import { fail, withTeam } from "@/lib/api";
import { MIN_TEAMS } from "@/lib/tournament-rules";
import { advanceTournament } from "@/lib/tournaments";

/** Iniciar el torneo (coach organizador): siembra por rating y genera la ronda 1. */
export const POST = withTeam<{ id: string }>(async ({ user, params }) => {
  const t = await db.tournament.findUnique({ where: { id: params.id }, include: { entries: true } });
  if (!t) fail(404, "Torneo no encontrado");
  if (t!.organizerTeamId !== user.teamId || user.role !== "COACH") fail(403, "Solo el coach organizador puede iniciar el torneo");
  if (t!.status !== "REGISTRATION") fail(400, "El torneo ya comenzó");
  if (t!.entries.length < MIN_TEAMS) fail(400, `Se necesitan al menos ${MIN_TEAMS} equipos (hay ${t!.entries.length})`);

  await db.$transaction(async (tx) => {
    // Siembra: mayor rating al inscribirse primero
    const seeded = [...t!.entries].sort((a, b) => b.ratingAtJoin - a.ratingAtJoin || a.createdAt.getTime() - b.createdAt.getTime());
    for (const [i, e] of seeded.entries()) await tx.tournamentEntry.update({ where: { id: e.id }, data: { seed: i + 1 } });
    await tx.tournament.update({ where: { id: t!.id }, data: { status: "ACTIVE", startedAt: new Date() } });
    await advanceTournament(tx, t!.id);
  }, { timeout: 20_000 });
  return { ok: true };
});
