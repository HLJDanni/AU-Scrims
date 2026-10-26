import { db } from "@/lib/db";
import { fail, parseBody, withTeam, withUser } from "@/lib/api";
import { createTeamSchema, deleteTeamSchema, updateTeamSchema } from "@/lib/validators";
import { generateInviteCode } from "@/lib/team";
import { logoData } from "@/lib/logo";

const teamOut = { id: true, name: true, tag: true, color: true, region: true, rating: true, description: true, logoUpdatedAt: true } as const;

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
        requesterTeam: { select: { id: true, name: true, tag: true, color: true, logoUpdatedAt: true } },
        opponentTeam: { select: { id: true, name: true, tag: true, color: true, logoUpdatedAt: true } },
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
      description: team.description,
      logoUpdatedAt: team.logoUpdatedAt,
      createdAt: team.createdAt,
      inviteCode: user.role === "LEGEND" ? null : team.inviteCode,
    },
    members: team.members,
    canManage: isCoach,
    canEditEmblem: isCoach || user.role === "CAPTAIN",
    canManagePlayers: isCoach || user.role === "CAPTAIN",
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
  if (user.role === "LEGEND") fail(403, "Una Leyenda no puede crear equipos; únete con un código");
  const { logo, ...data } = await parseBody(req, createTeamSchema);
  const dup = await db.team.findFirst({
    where: { OR: [{ name: { equals: data.name, mode: "insensitive" } }, { tag: data.tag }] },
  });
  if (dup) fail(409, "Ya existe un equipo con ese nombre o tag");
  const team = await db.team.create({
    data: { ...data, ...logoData(logo), inviteCode: generateInviteCode(), members: { connect: { id: user.id } } },
    select: teamOut,
  });
  return { team };
});

/** Editar equipo. El coach edita todo; el capitán, solo el emblema (imagen y color). */
export const PATCH = withTeam(async ({ req, user }) => {
  if (user.role !== "COACH" && user.role !== "CAPTAIN") fail(403, "Solo el coach o el capitán pueden editar el equipo");
  const { logo, ...data } = await parseBody(req, updateTeamSchema);
  if (user.role === "CAPTAIN" && Object.keys(data).some((k) => k !== "color" && data[k as keyof typeof data] !== undefined))
    fail(403, "El capitán solo puede cambiar la imagen y el color del emblema");
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
  const team = await db.team.update({ where: { id: user.teamId }, data: { ...data, ...logoData(logo) }, select: teamOut });
  return { team };
});

/**
 * Eliminar el equipo (solo Coach). Requiere escribir el nombre exacto para confirmar.
 * El staff queda sin equipo y se borran sus scrims (también del historial de los rivales).
 */
export const DELETE = withTeam(async ({ req, user }) => {
  if (user.role !== "COACH") fail(403, "Solo el coach puede eliminar el equipo");
  const { confirmName } = await parseBody(req, deleteTeamSchema);
  if (confirmName !== user.team.name) fail(422, "El nombre no coincide con el del equipo");

  const removed = await db.$transaction(async (tx) => {
    const members = await tx.user.updateMany({ where: { teamId: user.teamId }, data: { teamId: null } });
    const scrims = await tx.scrim.deleteMany({
      where: { OR: [{ requesterTeamId: user.teamId }, { opponentTeamId: user.teamId }] },
    });
    await tx.team.delete({ where: { id: user.teamId } });
    return { members: members.count, scrims: scrims.count };
  });
  return { ok: true, ...removed };
});
