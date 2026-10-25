import { fail, withStaff } from "@/lib/api";
import { riotEnabled } from "@/lib/riot";
import { syncTeamRanks } from "@/lib/players";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Vuelve a traer de Riot el rango de todos los jugadores del equipo (cualquier miembro del staff). */
export const POST = withStaff(async ({ req, user }) => {
  if (!riotEnabled()) fail(503, "La sincronización de rangos requiere configurar RIOT_API_KEY en el servidor");
  // Rango + partidas de un roster completo son ~50 consultas: 1 sincronización cada 2 minutos por equipo
  if (!rateLimit(`rank-sync:${user.teamId}:${clientIp(req)}`, 1, 2 * 60_000))
    fail(429, "Espera un par de minutos antes de volver a sincronizar");
  return syncTeamRanks(user.teamId, user.team.region);
});
