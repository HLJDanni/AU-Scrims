import { db } from "@/lib/db";
import { fail, parseBody, withTeam } from "@/lib/api";
import { createTournamentSchema } from "@/lib/validators";
import { DIVISIONS } from "@/lib/tournament-rules";
import { eligibilityOf, tournamentList } from "@/lib/tournaments";

/** Torneos (todas las divisiones) y la elegibilidad de mi equipo. */
export const GET = withTeam(async ({ user }) => {
  const [tournaments, eligibility] = await Promise.all([tournamentList(), eligibilityOf(user.teamId)]);
  return { tournaments, eligibility };
});

/** Crear un torneo (solo Coach de un equipo elegible). La división es la de su equipo y queda inscrito. */
export const POST = withTeam(async ({ req, user }) => {
  if (user.role !== "COACH") fail(403, "Solo un coach puede organizar torneos");
  const { name } = await parseBody(req, createTournamentSchema);
  const e = await eligibilityOf(user.teamId);
  if (!e.division) fail(403, "Tu equipo no cumple los requisitos para organizar un torneo");
  const division = e.division!;

  const open = await db.tournament.findFirst({ where: { division, status: { in: ["REGISTRATION", "ACTIVE"] } } });
  if (open) fail(409, `Ya hay un torneo abierto en la ${DIVISIONS[division].name}: "${open!.name}"`);

  const tournament = await db.tournament.create({
    data: {
      name,
      division,
      organizerTeamId: user.teamId,
      entries: { create: { teamId: user.teamId, ratingAtJoin: e.team.rating, eloAtJoin: e.eloLabel ?? "—" } },
    },
  });
  return { tournament: { id: tournament.id } };
});
