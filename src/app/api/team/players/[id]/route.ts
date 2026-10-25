import { db } from "@/lib/db";
import { fail, parseBody, withTeam } from "@/lib/api";
import { playerSchema } from "@/lib/validators";
import { assertPlayerAllowed, canManagePlayers, playerDTO } from "@/lib/players";

async function ownPlayer(id: string, teamId: string) {
  const player = await db.player.findUnique({ where: { id } });
  if (!player || player.teamId !== teamId) fail(404, "Jugador no encontrado");
  return player!;
}

export const PATCH = withTeam<{ id: string }>(async ({ req, user, params }) => {
  if (!canManagePlayers(user.role)) fail(403, "Solo el coach o el capitán pueden editar el roster");
  await ownPlayer(params.id, user.teamId);
  const data = await parseBody(req, playerSchema);
  await assertPlayerAllowed(user.teamId, data, params.id);
  const player = await db.player.update({ where: { id: params.id }, data });
  return { player: playerDTO(player, user.team.region) };
});

export const DELETE = withTeam<{ id: string }>(async ({ user, params }) => {
  if (!canManagePlayers(user.role)) fail(403, "Solo el coach o el capitán pueden editar el roster");
  await ownPlayer(params.id, user.teamId);
  await db.player.delete({ where: { id: params.id } });
  return { ok: true };
});
