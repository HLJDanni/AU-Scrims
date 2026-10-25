import { db } from "@/lib/db";
import { fail, parseBody, withTeam } from "@/lib/api";
import { playerSchema } from "@/lib/validators";
import { riotEnabled, type RankedProfile } from "@/lib/riot";
import { assertPlayerAllowed, assertSameRegion, canManagePlayers, loadRankedProfile, playerDTO, rankedFields, recordPlayerStats } from "@/lib/players";

async function ownPlayer(id: string, teamId: string) {
  const player = await db.player.findUnique({ where: { id } });
  if (!player || player.teamId !== teamId) fail(404, "Jugador no encontrado");
  return player!;
}

/** Editar posición o cuenta. Si cambia la cuenta (o el rango nunca se sincronizó) se vuelve a consultar a Riot. */
export const PATCH = withTeam<{ id: string }>(async ({ req, user, params }) => {
  if (!canManagePlayers(user.role)) fail(403, "Solo el coach o el capitán pueden editar el roster");
  const current = await ownPlayer(params.id, user.teamId);
  const { opggRegion, ...data } = await parseBody(req, playerSchema);
  assertSameRegion(opggRegion, user.team.region);
  await assertPlayerAllowed(user.teamId, data, params.id);

  const accountChanged =
    data.gameName.toLowerCase() !== current.gameName.toLowerCase() || data.tagLine.toLowerCase() !== current.tagLine.toLowerCase();
  const reset = accountChanged
    ? { puuid: null, tier: null, division: null, lp: 0, summonerLevel: null, wins: null, losses: null, rankUpdatedAt: null }
    : {};
  let riot: RankedProfile | null = null;
  const ranked =
    riotEnabled() && (accountChanged || !current.rankUpdatedAt)
      ? rankedFields((riot = await loadRankedProfile(opggRegion, data.gameName, data.tagLine)))
      : {};
  if (accountChanged) await db.playerMatch.deleteMany({ where: { playerId: params.id } }); // eran de otra cuenta
  const player = await db.player.update({ where: { id: params.id }, data: { ...data, ...reset, ...ranked } });
  if (riot) await recordPlayerStats(player.id, opggRegion, riot).catch(() => null);
  return { player: playerDTO(player) };
});

export const DELETE = withTeam<{ id: string }>(async ({ user, params }) => {
  if (!canManagePlayers(user.role)) fail(403, "Solo el coach o el capitán pueden editar el roster");
  await ownPlayer(params.id, user.teamId);
  await db.player.delete({ where: { id: params.id } });
  return { ok: true };
});
