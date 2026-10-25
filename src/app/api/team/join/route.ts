import { db } from "@/lib/db";
import { fail, parseBody, withUser } from "@/lib/api";
import { joinTeamSchema } from "@/lib/validators";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const POST = withUser(async ({ req, user }) => {
  if (user.teamId) fail(400, "Ya perteneces a un equipo");
  if (!rateLimit(`join:${clientIp(req)}`, 10, 10 * 60_000)) fail(429, "Demasiados intentos");
  const { inviteCode } = await parseBody(req, joinTeamSchema);
  const team = await db.team.findUnique({ where: { inviteCode } });
  if (!team) fail(404, "Código de invitación inválido");
  await db.user.update({ where: { id: user.id }, data: { teamId: team!.id } });
  return { team: { id: team!.id, name: team!.name } };
});
