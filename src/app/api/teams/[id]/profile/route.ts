import { withTeam } from "@/lib/api";
import { getTeamProfile } from "@/lib/players";

/** Perfil público de un equipo para el staff: descripción, jugadores (cuenta principal) y ELO promedio. */
export const GET = withTeam<{ id: string }>(async ({ params }) => getTeamProfile(params.id));
