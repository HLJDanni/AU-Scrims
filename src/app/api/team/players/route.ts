import { db } from "@/lib/db";
import { fail, parseBody, withTeam } from "@/lib/api";
import { playerSchema } from "@/lib/validators";
import { assertPlayerAllowed, canManagePlayers, getTeamProfile, playerDTO } from "@/lib/players";

export const GET = withTeam(async ({ user }) => getTeamProfile(user.teamId));

/** Agregar un jugador al roster (Coach o Capitán). */
export const POST = withTeam(async ({ req, user }) => {
  if (!canManagePlayers(user.role)) fail(403, "Solo el coach o el capitán pueden editar el roster");
  const data = await parseBody(req, playerSchema);
  await assertPlayerAllowed(user.teamId, data);
  const player = await db.player.create({ data: { ...data, teamId: user.teamId } });
  return { player: playerDTO(player, user.team.region) };
});
