import { withUser } from "@/lib/api";
import { getTeamProfile, rosterAccess } from "@/lib/players";

/**
 * Perfil de un equipo: descripción y ELO promedio para todos.
 * Los jugadores (Riot ID y op.gg) solo se envían si el usuario tiene acceso (ver rosterAccess).
 */
export const GET = withUser<{ id: string }>(async ({ user, params }) => {
  const [profile, access] = await Promise.all([getTeamProfile(params.id), rosterAccess(user, params.id)]);
  if (!access.ok) return { ...profile, players: [], rosterHidden: access.reason };
  return { ...profile, rosterHidden: null };
});
