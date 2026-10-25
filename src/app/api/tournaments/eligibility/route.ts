import { withTeam } from "@/lib/api";
import { eligibilityFor } from "@/lib/tournaments";

/** Elegibilidad de todos los equipos: en qué división pueden jugar o qué requisito les falta. */
export const GET = withTeam(async () => ({ teams: await eligibilityFor() }));
