import { db } from "@/lib/db";
import { withTeam } from "@/lib/api";

/** Equipos rivales disponibles para agendar. */
export const GET = withTeam(async ({ req, user }) => {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const teams = await db.team.findMany({
    where: {
      id: { not: user.teamId },
      ...(q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { tag: { contains: q.toUpperCase() } }] }
        : {}),
    },
    select: { id: true, name: true, tag: true, color: true, rating: true, region: true },
    orderBy: { rating: "desc" },
    take: 50,
  });
  return { teams };
});
