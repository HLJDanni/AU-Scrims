import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withAdmin } from "@/lib/api";

const team = { select: { id: true, name: true, tag: true, color: true, logoUpdatedAt: true } } as const;

/** Todos los scrims de la plataforma (más recientes primero), con búsqueda por equipo. Solo administrador. */
export const GET = withAdmin(async ({ req }) => {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const byTeam: Prisma.TeamWhereInput | undefined = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { tag: { contains: q.toUpperCase() } }] }
    : undefined;
  const scrims = await db.scrim.findMany({
    where: byTeam ? { OR: [{ requesterTeam: byTeam }, { opponentTeam: byTeam }] } : undefined,
    include: { requesterTeam: team, opponentTeam: team, _count: { select: { messages: true, draftGames: true } } },
    orderBy: { startAt: "desc" },
    take: 100,
  });
  return {
    scrims: scrims.map((s) => ({
      id: s.id,
      startAt: s.startAt.toISOString(),
      games: s.games,
      status: s.status,
      home: s.requesterTeam,
      away: s.opponentTeam,
      score: s.requesterScore == null ? null : [s.requesterScore, s.opponentScore],
      ratingDelta: s.ratingDelta,
      opponentRatingDelta: s.opponentRatingDelta,
      notes: s.notes,
      messages: s._count.messages,
      draftGames: s._count.draftGames,
    })),
  };
});
