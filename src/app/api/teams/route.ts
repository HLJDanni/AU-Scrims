import { db } from "@/lib/db";
import { withStaff } from "@/lib/api";
import { eloAverage } from "@/lib/lol";

/**
 * Equipos rivales disponibles para agendar, con su ELO promedio.
 * Solo se envía el promedio (liga y división): los jugadores siguen siendo privados.
 */
export const GET = withStaff(async ({ req, user }) => {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const teams = await db.team.findMany({
    where: {
      id: { not: user.teamId },
      ...(q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { tag: { contains: q.toUpperCase() } }] }
        : {}),
    },
    select: {
      id: true,
      name: true,
      tag: true,
      color: true,
      rating: true,
      region: true,
      players: { select: { position: true, tier: true, division: true, lp: true } },
    },
    orderBy: { rating: "desc" },
    take: 100,
  });
  return {
    teams: teams.map(({ players, ...t }) => {
      const avg = eloAverage(players);
      return { ...t, elo: avg ? { tier: avg.tier, label: avg.label, color: avg.color } : null };
    }),
  };
});
