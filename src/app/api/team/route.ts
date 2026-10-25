import { db } from "@/lib/db";
import { fail, parseBody, withTeam, withUser } from "@/lib/api";
import { createTeamSchema, updateTeamSchema } from "@/lib/validators";
import { generateInviteCode } from "@/lib/team";

/** Mi equipo: datos, miembros y estadísticas. */
export const GET = withTeam(async ({ user }) => {
  const teamId = user.teamId;
  const [team, completed, rank] = await Promise.all([
    db.team.findUniqueOrThrow({
      where: { id: teamId },
      include: {
        members: { select: { id: true, username: true, role: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    db.scrim.findMany({
      where: { status: "COMPLETED", OR: [{ requesterTeamId: teamId }, { opponentTeamId: teamId }] },
      include: {
        requesterTeam: { select: { id: true, name: true, tag: true, color: true } },
        opponentTeam: { select: { id: true, name: true, tag: true, color: true } },
      },
    }),
    db.team.count({ where: { rating: { gt: user.team.rating } } }),
  ]);

  let gamesWon = 0;
  let gamesLost = 0;
  let scrimWins = 0;
  const byOpponent = new Map<string, { team: { id: string; name: string; tag: string; color: string }; won: number; lost: number; scrims: number }>();
  for (const s of completed) {
    const home = s.requesterTeamId === teamId;
    const mine = (home ? s.requesterScore : s.opponentScore) ?? 0;
    const theirs = (home ? s.opponentScore : s.requesterScore) ?? 0;
    const opp = home ? s.opponentTeam : s.requesterTeam;
    gamesWon += mine;
    gamesLost += theirs;
    if (mine > theirs) scrimWins += 1;
    const row = byOpponent.get(opp.id) ?? { team: opp, won: 0, lost: 0, scrims: 0 };
    row.won += mine;
    row.lost += theirs;
    row.scrims += 1;
    byOpponent.set(opp.id, row);
  }

  const isCoach = user.role === "COACH";
  return {
    team: {
      id: team.id,
      name: team.name,
      tag: team.tag,
      color: team.color,
      region: team.region,
      rating: team.rating,
      createdAt: team.createdAt,
      inviteCode: team.inviteCode,
    },
    members: team.members,
    canManage: isCoach,
    stats: {
      rank: rank + 1,
      scrimsPlayed: completed.length,
      scrimWins,
      gamesWon,
      gamesLost,
      winRate: gamesWon + gamesLost ? Math.round((gamesWon / (gamesWon + gamesLost)) * 100) : 0,
      byOpponent: [...byOpponent.values()].sort((a, b) => b.scrims - a.scrims),
    },
  };
});

/** Crear equipo (usuario sin equipo). */
export const POST = withUser(async ({ req, user }) => {
  if (user.teamId) fail(400, "Ya perteneces a un equipo");
  const data = await parseBody(req, createTeamSchema);
  const dup = await db.team.findFirst({
    where: { OR: [{ name: { equals: data.name, mode: "insensitive" } }, { tag: data.tag }] },
  });
  if (dup) fail(409, "Ya existe un equipo con ese nombre o tag");
  const team = await db.team.create({
    data: { ...data, inviteCode: generateInviteCode(), members: { connect: { id: user.id } } },
  });
  return { team };
});

/** Editar equipo (solo Coach). */
export const PATCH = withTeam(async ({ req, user }) => {
  if (user.role !== "COACH") fail(403, "Solo el coach puede editar el equipo");
  const data = await parseBody(req, updateTeamSchema);
  if (data.name || data.tag) {
    const dup = await db.team.findFirst({
      where: {
        id: { not: user.teamId },
        OR: [
          ...(data.name ? [{ name: { equals: data.name, mode: "insensitive" as const } }] : []),
          ...(data.tag ? [{ tag: data.tag }] : []),
        ],
      },
    });
    if (dup) fail(409, "Ya existe un equipo con ese nombre o tag");
  }
  const team = await db.team.update({ where: { id: user.teamId }, data });
  return { team };
});
