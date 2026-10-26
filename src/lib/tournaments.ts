import "server-only";
import type { Prisma, Team } from "@prisma/client";
import { db } from "./db";
import { fail } from "./api";
import { evaluateEligibility, type Division } from "./tournament-rules";
import { MAX_ROUNDS, LOSSES_TO_ELIMINATE, WINS_TO_QUALIFY, buchholz, pairRound, statusFor, type SwissEntry, type SwissMatch } from "./swiss";

type Tx = Prisma.TransactionClient;
const teamSelect = { id: true, name: true, tag: true, color: true, logoUpdatedAt: true, region: true, rating: true } as const;

/** Scrims ganados por cada equipo (resultado registrado y marcador a favor). */
async function scrimWinsByTeam(teamIds?: string[]) {
  const scrims = await db.scrim.findMany({
    where: {
      status: "COMPLETED",
      ...(teamIds ? { OR: [{ requesterTeamId: { in: teamIds } }, { opponentTeamId: { in: teamIds } }] } : {}),
    },
    select: { requesterTeamId: true, opponentTeamId: true, requesterScore: true, opponentScore: true },
  });
  const wins = new Map<string, number>();
  for (const s of scrims) {
    const h = s.requesterScore ?? 0;
    const a = s.opponentScore ?? 0;
    if (h > a) wins.set(s.requesterTeamId, (wins.get(s.requesterTeamId) ?? 0) + 1);
    if (a > h) wins.set(s.opponentTeamId, (wins.get(s.opponentTeamId) ?? 0) + 1);
  }
  return wins;
}

/** Elegibilidad de uno o todos los equipos. */
export async function eligibilityFor(teamIds?: string[]) {
  const [teams, wins] = await Promise.all([
    db.team.findMany({
      where: teamIds ? { id: { in: teamIds } } : undefined,
      select: { ...teamSelect, players: { select: { position: true, tier: true, division: true, lp: true } } },
      orderBy: { rating: "desc" },
    }),
    scrimWinsByTeam(teamIds),
  ]);
  return teams.map(({ players, ...team }) => {
    const scrimWins = wins.get(team.id) ?? 0;
    return { team, scrimWins, ...evaluateEligibility({ rating: team.rating, scrimWins, players }) };
  });
}

export async function eligibilityOf(teamId: string) {
  const [e] = await eligibilityFor([teamId]);
  if (!e) fail(404, "Equipo no encontrado");
  return e!;
}

/** Récords de cada equipo justo antes de cada partido (para agrupar el bracket por récord). */
function recordsBefore(matches: SwissMatch[]) {
  const rec = new Map<string, { wins: number; losses: number }>();
  const get = (id: string) => rec.get(id) ?? { wins: 0, losses: 0 };
  const before = new Map<SwissMatch, { a: string; b: string | null }>();
  const rounds = [...new Set(matches.map((m) => m.round))].sort((x, y) => x - y);
  for (const r of rounds) {
    const inRound = matches.filter((m) => m.round === r);
    for (const m of inRound) {
      const a = get(m.teamAId);
      const b = m.teamBId ? get(m.teamBId) : null;
      before.set(m, { a: `${a.wins}-${a.losses}`, b: b ? `${b.wins}-${b.losses}` : null });
    }
    for (const m of inRound) {
      if (!m.winnerId) continue;
      const loser = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
      const w = get(m.winnerId);
      rec.set(m.winnerId, { ...w, wins: w.wins + 1 });
      if (loser) {
        const l = get(loser);
        rec.set(loser, { ...l, losses: l.losses + 1 });
      }
    }
  }
  return before;
}

/**
 * Genera la siguiente ronda si la actual está completa. Los descansos se resuelven al instante;
 * si después de eso no queda nadie con partidos pendientes, el torneo termina.
 */
export async function advanceTournament(tx: Tx, tournamentId: string) {
  for (let guard = 0; guard < MAX_ROUNDS + 2; guard++) {
    const t = await tx.tournament.findUniqueOrThrow({ where: { id: tournamentId }, include: { entries: true, matches: true } });
    if (t.status !== "ACTIVE") return;
    if (t.matches.some((m) => !m.winnerId)) return; // ronda en curso

    const entries: SwissEntry[] = t.entries.map((e) => ({ teamId: e.teamId, seed: e.seed ?? 99, wins: e.wins, losses: e.losses, status: e.status }));
    const alive = entries.filter((e) => e.status === "ALIVE");
    if (alive.length <= 1 || t.round >= MAX_ROUNDS) {
      // Sin rivales posibles: los que sigan en juego se definen por su balance
      for (const e of alive)
        await tx.tournamentEntry.update({
          where: { tournamentId_teamId: { tournamentId, teamId: e.teamId } },
          data: { status: e.wins >= e.losses ? "QUALIFIED" : "ELIMINATED" },
        });
      await tx.tournament.update({ where: { id: tournamentId }, data: { status: "FINISHED", finishedAt: new Date() } });
      return;
    }

    const round = t.round + 1;
    const pairings = pairRound(entries, t.matches, round);
    await tx.tournament.update({ where: { id: tournamentId }, data: { round } });
    for (const p of pairings) {
      if (p.teamBId) {
        await tx.tournamentMatch.create({ data: { tournamentId, round, teamAId: p.teamAId, teamBId: p.teamBId, bestOf: p.bestOf } });
      } else {
        // Descanso: cuenta como victoria
        await tx.tournamentMatch.create({ data: { tournamentId, round, teamAId: p.teamAId, bestOf: 0, winnerId: p.teamAId, reportedAt: new Date() } });
        await applyResult(tx, tournamentId, p.teamAId, null);
      }
    }
  }
}

/** Suma la victoria y la derrota y actualiza el estado de cada equipo. */
export async function applyResult(tx: Tx, tournamentId: string, winnerId: string, loserId: string | null) {
  const w = await tx.tournamentEntry.update({
    where: { tournamentId_teamId: { tournamentId, teamId: winnerId } },
    data: { wins: { increment: 1 } },
  });
  await tx.tournamentEntry.update({ where: { id: w.id }, data: { status: statusFor(w.wins, w.losses) } });
  if (loserId) {
    const l = await tx.tournamentEntry.update({
      where: { tournamentId_teamId: { tournamentId, teamId: loserId } },
      data: { losses: { increment: 1 } },
    });
    await tx.tournamentEntry.update({ where: { id: l.id }, data: { status: statusFor(l.wins, l.losses) } });
  }
}

type TeamLite = Pick<Team, "id" | "name" | "tag" | "color" | "region" | "rating">;

/** Detalle completo de un torneo desde la perspectiva de un equipo. */
export async function tournamentDetail(id: string, viewer: { teamId: string | null; role: string }) {
  const t = await db.tournament.findUnique({
    where: { id },
    include: {
      organizerTeam: { select: teamSelect },
      entries: { include: { team: { select: teamSelect } }, orderBy: { createdAt: "asc" } },
      matches: { include: { teamA: { select: teamSelect }, teamB: { select: teamSelect } }, orderBy: [{ round: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!t) fail(404, "Torneo no encontrado");
  const tour = t!;

  const swissEntries: SwissEntry[] = tour.entries.map((e) => ({ teamId: e.teamId, seed: e.seed ?? 99, wins: e.wins, losses: e.losses, status: e.status }));
  const swissMatches: SwissMatch[] = tour.matches.map((m) => ({ round: m.round, teamAId: m.teamAId, teamBId: m.teamBId, winnerId: m.winnerId }));
  const before = recordsBefore(swissMatches);
  const teamsById = new Map<string, TeamLite>(tour.entries.map((e) => [e.teamId, e.team]));

  const table = tour.entries
    .map((e) => ({
      team: e.team,
      seed: e.seed,
      wins: e.wins,
      losses: e.losses,
      status: e.status,
      ratingAtJoin: e.ratingAtJoin,
      eloAtJoin: e.eloAtJoin,
      buchholz: buchholz(e.teamId, swissEntries, swissMatches),
    }))
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.buchholz - a.buchholz || (a.seed ?? 99) - (b.seed ?? 99))
    .map((row, i) => ({ ...row, position: i + 1 }));

  const myEntry = tour.entries.find((e) => e.teamId === viewer.teamId);
  const isOrganizer = tour.organizerTeamId === viewer.teamId;
  const isCoach = viewer.role === "COACH";
  const canEnroll = Boolean(viewer.teamId) && (viewer.role === "COACH" || viewer.role === "CAPTAIN");

  let joinBlocked: string | null = null;
  if (tour.status !== "REGISTRATION") joinBlocked = "Las inscripciones están cerradas";
  else if (myEntry) joinBlocked = null;
  else if (!viewer.teamId) joinBlocked = "Vista de espectador: solo los equipos pueden inscribirse";
  else if (!canEnroll) joinBlocked = viewer.role === "LEGEND" ? "Vista de espectador: las Leyendas no inscriben equipos" : "Solo el coach o el capitán pueden inscribir al equipo";
  else if (tour.entries.length >= 16) joinBlocked = "El torneo está lleno";
  else {
    const e = await eligibilityOf(viewer.teamId!);
    if (e.division !== tour.division) joinBlocked = e.division ? "Tu equipo pertenece a la otra división" : "Tu equipo no cumple los requisitos";
  }

  const rounds = [...new Set(tour.matches.map((m) => m.round))].map((round) => ({
    round,
    matches: tour.matches
      .filter((m) => m.round === round)
      .map((m) => {
        const swiss = swissMatches.find((s) => s.round === m.round && s.teamAId === m.teamAId && s.teamBId === m.teamBId)!;
        const participant = viewer.role !== "LEGEND" && Boolean(viewer.teamId) && (viewer.teamId === m.teamAId || viewer.teamId === m.teamBId);
        return {
          id: m.id,
          teamA: m.teamA,
          teamB: m.teamB,
          bestOf: m.bestOf,
          scoreA: m.scoreA,
          scoreB: m.scoreB,
          winnerId: m.winnerId,
          bye: !m.teamBId,
          recordA: before.get(swiss)?.a ?? "0-0",
          recordB: before.get(swiss)?.b ?? null,
          canReport: tour.status === "ACTIVE" && !m.winnerId && Boolean(m.teamBId) && (participant || (isOrganizer && isCoach)),
        };
      }),
  }));

  return {
    tournament: {
      id: tour.id,
      name: tour.name,
      division: tour.division as Division,
      status: tour.status,
      round: tour.round,
      organizer: tour.organizerTeam,
      createdAt: tour.createdAt.toISOString(),
      startedAt: tour.startedAt?.toISOString() ?? null,
      finishedAt: tour.finishedAt?.toISOString() ?? null,
      winsToQualify: WINS_TO_QUALIFY,
      lossesToEliminate: LOSSES_TO_ELIMINATE,
    },
    table,
    rounds,
    me: {
      teamId: viewer.teamId,
      entered: Boolean(myEntry),
      isOrganizer,
      canJoin: !myEntry && joinBlocked === null,
      joinBlocked: myEntry ? null : joinBlocked,
      canLeave: Boolean(myEntry) && !isOrganizer && tour.status === "REGISTRATION" && canEnroll,
      canStart: isOrganizer && isCoach && tour.status === "REGISTRATION",
      canCancel: isOrganizer && isCoach && tour.status === "REGISTRATION",
    },
    teamsCount: teamsById.size,
  };
}

/** Resumen para listados. */
export async function tournamentList() {
  const list = await db.tournament.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      organizerTeam: { select: teamSelect },
      _count: { select: { entries: true } },
      entries: { where: { status: "QUALIFIED" }, include: { team: { select: teamSelect } } },
    },
  });
  return list.map((t) => ({
    id: t.id,
    name: t.name,
    division: t.division as Division,
    status: t.status,
    round: t.round,
    organizer: t.organizerTeam,
    teams: t._count.entries,
    qualified: t.entries.map((e) => e.team),
    createdAt: t.createdAt.toISOString(),
    finishedAt: t.finishedAt?.toISOString() ?? null,
  }));
}
