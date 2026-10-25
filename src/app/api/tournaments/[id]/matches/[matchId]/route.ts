import { db } from "@/lib/db";
import { fail, parseBody, withStaff } from "@/lib/api";
import { matchResultSchema } from "@/lib/validators";
import { advanceTournament, applyResult } from "@/lib/tournaments";

/**
 * Registrar el resultado de un partido (staff de cualquiera de los dos equipos, o el coach organizador).
 * Al completarse la ronda se empareja automáticamente la siguiente.
 */
export const POST = withStaff<{ id: string; matchId: string }>(async ({ req, user, params }) => {
  const { scoreA, scoreB } = await parseBody(req, matchResultSchema);
  const m = await db.tournamentMatch.findUnique({ where: { id: params.matchId }, include: { tournament: true } });
  if (!m || m.tournamentId !== params.id) fail(404, "Partido no encontrado");
  const match = m!;
  if (match.tournament.status !== "ACTIVE") fail(400, "El torneo no está en curso");
  if (!match.teamBId) fail(400, "Un descanso no tiene resultado");

  const participant = user.teamId === match.teamAId || user.teamId === match.teamBId;
  const organizer = user.teamId === match.tournament.organizerTeamId && user.role === "COACH";
  if (!participant && !organizer) fail(403, "Solo los equipos del partido o el coach organizador pueden registrar el resultado");

  const needed = Math.ceil(match.bestOf / 2);
  const valid = Math.max(scoreA, scoreB) === needed && Math.min(scoreA, scoreB) < needed;
  if (!valid) fail(422, match.bestOf === 1 ? "En un Bo1 el marcador debe ser 1-0" : `En un Bo${match.bestOf} el ganador debe llegar a ${needed} juegos`);

  const winnerId = scoreA > scoreB ? match.teamAId : match.teamBId!;
  const loserId = winnerId === match.teamAId ? match.teamBId! : match.teamAId;

  await db.$transaction(async (tx) => {
    // Bloqueo optimista: solo el primer reporte cuenta
    const lock = await tx.tournamentMatch.updateMany({
      where: { id: match.id, winnerId: null },
      data: { scoreA, scoreB, winnerId, reportedAt: new Date() },
    });
    if (lock.count === 0) fail(409, "El resultado ya fue registrado");
    await applyResult(tx, match.tournamentId, winnerId, loserId);
    await advanceTournament(tx, match.tournamentId);
  }, { timeout: 20_000 });
  return { ok: true };
});
