// Integración: torneo suizo completo vía API + PostgreSQL, con equipos temporales creados por la prueba.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ApiClient } from "../helpers/http";

const db = new PrismaClient();
const sfx = Date.now().toString(36).slice(-3).toUpperCase();
const PASSWORD = "Torneo12345";
const tags = [1, 2, 3, 4].map((i) => `Z${i}${sfx}`);
const lowTag = `Y${sfx}`; // cumple todo menos las 10 victorias
const ids: Record<string, string> = {};

async function createTeam(tag: string, rating: number) {
  const team = await db.team.create({ data: { name: `Prueba ${tag}`, tag, inviteCode: `INV${tag}`, rating } });
  ids[tag] = team.id;
  const hash = await bcrypt.hash(PASSWORD, 8);
  for (const [role, prefix] of [["COACH", "coach"], ["ANALYST", "analyst"]] as const)
    await db.user.create({ data: { username: `${prefix}.${tag.toLowerCase()}`, email: `${prefix}.${tag.toLowerCase()}@test.dev`, passwordHash: hash, role, teamId: team.id } });
  for (const [i, position] of (["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"] as const).entries())
    await db.player.create({
      data: { teamId: team.id, gameName: `Qa${tag}${i}`, tagLine: `T${i}${sfx}`, opggUrl: "https://op.gg/lol/summoners/lan/x-y", position, tier: "MASTER", lp: 200 },
    });
}

/** Registra `count` scrims ganados por `winner` contra `loser`. */
async function wins(winner: string, loser: string, count: number) {
  for (let i = 0; i < count; i++) {
    const startAt = new Date(Date.now() - (i + 2) * 86400_000);
    await db.scrim.create({
      data: { requesterTeamId: ids[winner], opponentTeamId: ids[loser], startAt, endAt: new Date(startAt.getTime() + 7200_000), games: 3, status: "COMPLETED", requesterScore: 2, opponentScore: 1 },
    });
  }
}

const login = (u: string) => new ApiClient().login(u, PASSWORD);

beforeAll(async () => {
  for (const [i, tag] of tags.entries()) await createTeam(tag, 7600 - i * 100);
  await createTeam(lowTag, 7800);
  // Cada equipo de prueba gana 10 scrims; el de bajo historial solo 9
  for (const [i, tag] of tags.entries()) await wins(tag, tags[(i + 1) % tags.length], 10);
  await wins(lowTag, tags[0], 9);
});

afterAll(async () => {
  // Borrar los equipos elimina en cascada torneos organizados, inscripciones, partidos y scrims
  await db.team.deleteMany({ where: { tag: { in: [...tags, lowTag] } } });
  await db.user.deleteMany({ where: { username: { endsWith: sfx.toLowerCase() } } });
  await db.$disconnect();
});

describe("Integración · torneo suizo", () => {
  it("I4 · crear, inscribir con reglas de acceso, iniciar, reportar resultados y terminar con todos clasificados o eliminados", async () => {
    const open = await db.tournament.findFirst({ where: { division: "ELITE", status: { in: ["REGISTRATION", "ACTIVE"] } } });
    expect(open, "Hay un torneo Élite abierto; termínalo o cancélalo antes de correr esta prueba").toBeNull();

    const [c1, c2, c3, c4, low, analyst] = await Promise.all([
      ...tags.map((t) => login(`coach.${t.toLowerCase()}`)),
      login(`coach.${lowTag.toLowerCase()}`),
      login(`analyst.${tags[1].toLowerCase()}`),
    ]);

    // Elegibilidad
    const elig = (await c1.get("/api/tournaments")).body.eligibility;
    expect(elig.division).toBe("ELITE");
    expect(elig.scrimWins).toBe(10);

    // Solo un coach organiza; el analista no puede
    expect((await analyst.post("/api/tournaments", { name: "No permitido" })).status).toBe(403);
    const created = await c1.post("/api/tournaments", { name: `Copa prueba ${sfx}` });
    expect(created.status).toBe(200);
    const id = created.body.tournament.id as string;
    expect((await c2.post("/api/tournaments", { name: "Otro" })).status).toBe(409); // uno abierto por división

    // Inscripciones
    for (const c of [c2, c3]) expect((await c.post(`/api/tournaments/${id}/join`)).status).toBe(200);
    expect((await analyst.post(`/api/tournaments/${id}/join`)).status).toBe(403); // rol
    const rejected = await low.post(`/api/tournaments/${id}/join`);
    expect(rejected.status).toBe(403);
    expect(rejected.body.error).toMatch(/9 scrims ganados \(faltan 1\)/);
    expect((await c1.post(`/api/tournaments/${id}/start`)).status).toBe(400); // 3 equipos: faltan
    expect((await c4.post(`/api/tournaments/${id}/join`)).status).toBe(200);
    expect((await c2.post(`/api/tournaments/${id}/start`)).status).toBe(403); // no es el organizador

    // Iniciar: siembra por rating y ronda 1 (1 vs 3, 2 vs 4)
    expect((await c1.post(`/api/tournaments/${id}/start`)).status).toBe(200);
    let d = (await c1.get(`/api/tournaments/${id}`)).body;
    expect(d.tournament.status).toBe("ACTIVE");
    expect(d.rounds[0].matches.map((m: { teamA: { tag: string }; teamB: { tag: string } }) => `${m.teamA.tag}-${m.teamB.tag}`)).toEqual([
      `${tags[0]}-${tags[2]}`,
      `${tags[1]}-${tags[3]}`,
    ]);
    expect((await c4.post(`/api/tournaments/${id}/join`)).status).toBe(400); // inscripciones cerradas

    // Validaciones de resultado
    const m1 = d.rounds[0].matches[0];
    expect((await c1.post(`/api/tournaments/${id}/matches/${m1.id}`, { scoreA: 2, scoreB: 0 })).status).toBe(422); // Bo1
    expect((await c2.post(`/api/tournaments/${id}/matches/${m1.id}`, { scoreA: 1, scoreB: 0 })).status).toBe(403); // no juega este partido

    // Jugar hasta el final: gana siempre el equipo A
    for (let guard = 0; guard < 12 && d.tournament.status === "ACTIVE"; guard++) {
      const round = d.rounds.find((r: { round: number }) => r.round === d.tournament.round);
      for (const m of round.matches.filter((x: { winnerId: string | null; bye: boolean }) => !x.winnerId && !x.bye)) {
        const need = Math.ceil(m.bestOf / 2);
        const r = await c1.post(`/api/tournaments/${id}/matches/${m.id}`, { scoreA: need, scoreB: 0 }); // el organizador puede reportar
        expect(r.status).toBe(200);
        // Doble reporte: 409 si el torneo sigue en curso; 400 si ese resultado lo terminó
        expect([409, 400]).toContain((await c1.post(`/api/tournaments/${id}/matches/${m.id}`, { scoreA: need, scoreB: 0 })).status);
      }
      d = (await c1.get(`/api/tournaments/${id}`)).body;
    }

    expect(d.tournament.status).toBe("FINISHED");
    expect(d.table.every((e: { status: string }) => e.status !== "ALIVE")).toBe(true);
    expect(d.table[0].wins).toBe(3);
    // Los Bo3 aparecen en los partidos decisivos
    const all = d.rounds.flatMap((r: { matches: { bestOf: number }[] }) => r.matches);
    expect(all.some((m: { bestOf: number }) => m.bestOf === 3)).toBe(true);
    // Coherencia en BD: victorias = derrotas + descansos
    const entries = await db.tournamentEntry.findMany({ where: { tournamentId: id } });
    const byes = await db.tournamentMatch.count({ where: { tournamentId: id, teamBId: null } });
    expect(entries.reduce((a, e) => a + e.wins, 0)).toBe(entries.reduce((a, e) => a + e.losses, 0) + byes);
  });
});
