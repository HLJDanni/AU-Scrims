import { db } from "@/lib/db";
import { fail, parseBody, withTeam } from "@/lib/api";
import { playerSchema } from "@/lib/validators";
import { riotEnabled, type RankedProfile } from "@/lib/riot";
import {
  assertPlayerAllowed,
  assertSameRegion,
  canManagePlayers,
  getTeamProfile,
  loadRankedProfile,
  playerDTO,
  rankedFields,
  recordPlayerStats,
} from "@/lib/players";

export const GET = withTeam(async ({ user }) => getTeamProfile(user.teamId));

/**
 * Agregar un jugador al roster (Coach o Capitán) a partir de su link de op.gg.
 * Si hay RIOT_API_KEY, se valida la cuenta y se trae su rango de SoloQ automáticamente.
 */
export const POST = withTeam(async ({ req, user }) => {
  if (!canManagePlayers(user.role)) fail(403, "Solo el coach o el capitán pueden editar el roster");
  const { opggRegion, ...data } = await parseBody(req, playerSchema);
  assertSameRegion(opggRegion, user.team.region);
  await assertPlayerAllowed(user.teamId, data);

  let riot: RankedProfile | null = null;
  const ranked = riotEnabled() ? rankedFields((riot = await loadRankedProfile(opggRegion, data.gameName, data.tagLine))) : {};
  const player = await db.player.create({ data: { ...data, ...ranked, teamId: user.teamId } });
  if (riot) await recordPlayerStats(player.id, opggRegion, riot).catch(() => null); // las estadísticas no bloquean el alta
  return { player: playerDTO(player), rankSync: riotEnabled() };
});
