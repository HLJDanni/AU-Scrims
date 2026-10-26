import { db } from "@/lib/db";
import { fail, parseBody, withUser } from "@/lib/api";
import { joinTeamSchema } from "@/lib/validators";
import { preparePlayer } from "@/lib/players";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Unirse a un equipo con su código. La Leyenda además entra al roster con su op.gg. */
export const POST = withUser(async ({ req, user }) => {
  if (user.teamId) fail(400, "Ya perteneces a un equipo");
  if (!rateLimit(`join:${clientIp(req)}`, 10, 10 * 60_000)) fail(429, "Demasiados intentos");
  const { inviteCode, player } = await parseBody(req, joinTeamSchema);
  const team = await db.team.findUnique({ where: { inviteCode }, select: { id: true, name: true, region: true } });
  if (!team) fail(404, "Código de invitación inválido");

  const legend = user.role === "LEGEND";
  if (legend && !player) fail(422, "Agrega tu link de op.gg para unirte al roster del equipo");
  const data = legend ? await preparePlayer(team!, player!) : null;

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { teamId: team!.id } });
    // Si ya tenía un registro de jugador de antes, se reemplaza por el nuevo
    if (data) {
      await tx.player.deleteMany({ where: { userId: user.id } });
      await tx.player.create({ data: { ...data, userId: user.id } });
    }
  });
  return { team: { id: team!.id, name: team!.name }, joinedRoster: Boolean(data) };
});
