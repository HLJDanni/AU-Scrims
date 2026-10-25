import { db } from "@/lib/db";
import { fail, parseBody, withStaff } from "@/lib/api";
import { resultSchema } from "@/lib/validators";
import { loadOwnScrim, logEvent, scrimInclude, toDTO } from "@/lib/scrims";
import { eloDelta } from "@/lib/elo";

/** Registrar el resultado (juegos ganados por cada lado) y actualizar el ranking. */
export const POST = withStaff<{ id: string }>(async ({ req, user, params }) => {
  const body = await parseBody(req, resultSchema);
  const scrim = await loadOwnScrim(params.id, user.teamId);
  if (scrim.status !== "CONFIRMED") fail(400, "Solo se puede registrar el resultado de un scrim confirmado");
  if (scrim.startAt > new Date()) fail(400, "El scrim aún no ha comenzado");
  if (body.myScore + body.opponentScore === 0) fail(422, "Registra al menos un juego");
  if (body.myScore + body.opponentScore > scrim.games)
    fail(422, `La suma de juegos no puede superar los ${scrim.games} acordados`);

  const isHost = scrim.requesterTeamId === user.teamId;
  const requesterScore = isHost ? body.myScore : body.opponentScore;
  const opponentScore = isHost ? body.opponentScore : body.myScore;

  const updated = await db.$transaction(async (tx) => {
    // Bloqueo optimista: solo un equipo puede cerrar el scrim
    const lock = await tx.scrim.updateMany({ where: { id: scrim.id, status: "CONFIRMED" }, data: { status: "COMPLETED" } });
    if (lock.count === 0) fail(409, "El resultado ya fue registrado por el otro equipo");

    const [home, away] = await Promise.all([
      tx.team.findUniqueOrThrow({ where: { id: scrim.requesterTeamId } }),
      tx.team.findUniqueOrThrow({ where: { id: scrim.opponentTeamId } }),
    ]);
    const delta = eloDelta(home.rating, away.rating, requesterScore, opponentScore);
    await tx.team.update({ where: { id: home.id }, data: { rating: { increment: delta } } });
    await tx.team.update({ where: { id: away.id }, data: { rating: { decrement: delta } } });

    const s = await tx.scrim.update({
      where: { id: scrim.id },
      data: { requesterScore, opponentScore, ratingDelta: delta },
      include: scrimInclude,
    });
    await logEvent(tx, s.id, user.id, "RESULT",
      `${user.username} registró el resultado ${home.tag} ${requesterScore} - ${opponentScore} ${away.tag}`);
    return s;
  });

  return { scrim: toDTO(updated, user.teamId) };
});
