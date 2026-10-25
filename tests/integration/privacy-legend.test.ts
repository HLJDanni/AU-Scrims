// Integración: privacidad mutua del roster y permisos del rol Leyenda (API + PostgreSQL).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ApiClient, BASE_URL, farSlot } from "../helpers/http";

const db = new PrismaClient();
const sfx = Date.now().toString(36).slice(-3).toUpperCase();
const PASSWORD = "Privada12345";
const A = `PA${sfx}`;
const B = `PB${sfx}`;
const ids: Record<string, string> = {};
const login = (u: string) => new ApiClient().login(u, PASSWORD);

async function team(tag: string) {
  const t = await db.team.create({ data: { name: `Privacidad ${tag}`, tag, inviteCode: `INV${tag}` } });
  ids[tag] = t.id;
  const hash = await bcrypt.hash(PASSWORD, 8);
  for (const [role, prefix] of [["COACH", "coach"], ["ANALYST", "analyst"], ["CAPTAIN", "cap"], ["LEGEND", "ley"]] as const)
    await db.user.create({ data: { username: `${prefix}.${tag.toLowerCase()}`, email: `${prefix}.${tag.toLowerCase()}@test.dev`, passwordHash: hash, role, teamId: t.id } });
  for (const [i, position] of (["TOP", "MID", "ADC"] as const).entries())
    await db.player.create({ data: { teamId: t.id, gameName: `Priv${tag}${i}`, tagLine: `X${i}${sfx}`, opggUrl: "https://op.gg/lol/summoners/lan/x-y", position, tier: "DIAMOND", division: 2, lp: 50 } });
}

beforeAll(async () => {
  await team(A);
  await team(B);
  await db.user.create({ data: { username: `ley.libre${sfx.toLowerCase()}`, email: `ley.libre${sfx.toLowerCase()}@test.dev`, passwordHash: await bcrypt.hash(PASSWORD, 8), role: "LEGEND" } });
});

afterAll(async () => {
  await db.team.deleteMany({ where: { tag: { in: [A, B] } } });
  await db.user.deleteMany({ where: { username: { endsWith: sfx.toLowerCase() } } });
  await db.$disconnect();
});

describe("Integración · privacidad del roster y rol Leyenda", () => {
  it("I5 · roster visible solo para el propio equipo o coach/analista con scrim mutuo; la Leyenda solo consulta", async () => {
    const [coachA, analystA, capA, leyA, coachB, free] = await Promise.all([
      login(`coach.${A.toLowerCase()}`),
      login(`analyst.${A.toLowerCase()}`),
      login(`cap.${A.toLowerCase()}`),
      login(`ley.${A.toLowerCase()}`),
      login(`coach.${B.toLowerCase()}`),
      login(`ley.libre${sfx.toLowerCase()}`),
    ]);
    const profile = (c: ApiClient, tag: string) => c.get(`/api/teams/${ids[tag]}/profile`).then((r) => r.body);

    // Sin scrim entre ellos: nadie de A ve los jugadores de B, pero sí su ELO promedio
    for (const c of [coachA, analystA, capA, leyA]) {
      const p = await profile(c, B);
      expect(p.players).toEqual([]);
      expect(p.rosterHidden).toEqual(expect.any(String));
      expect(p.eloAverage.label).toMatch(/Diamante/);
    }
    // Su propio equipo sí, incluida la Leyenda
    expect((await profile(leyA, A)).players).toHaveLength(3);

    // La lista de rivales para agendar trae el ELO promedio, nunca los jugadores
    const rivals = (await coachA.get("/api/teams")).body.teams;
    const rivalB = rivals.find((t: { tag: string }) => t.tag === B);
    expect(rivalB.elo).toMatchObject({ tier: "DIAMOND", label: "Diamante II" });
    expect(rivalB).not.toHaveProperty("players");

    // Coach de A agenda contra B → scrim mutuo
    const scrim = await coachA.post("/api/scrims", { opponentTeamId: ids[B], ...farSlot() });
    expect(scrim.status).toBe(200);
    expect((await profile(coachA, B)).players).toHaveLength(3);
    expect((await profile(analystA, B)).players).toHaveLength(3);
    expect((await profile(coachB, A)).players).toHaveLength(3); // también al revés
    expect((await profile(capA, B)).rosterHidden).toMatch(/coach y el analista/); // capitán: no
    expect((await profile(leyA, B)).players).toEqual([]); // Leyenda: no

    // Si se cancela, vuelve a ser privado
    expect((await coachA.post(`/api/scrims/${scrim.body.scrim.id}/cancel`)).status).toBe(200);
    expect((await profile(coachA, B)).players).toEqual([]);

    // Leyenda con equipo: lee los scrims de su equipo, no puede modificar nada
    expect((await leyA.get("/api/scrims?scope=history")).status).toBe(200);
    const denied = await leyA.post("/api/scrims", { opponentTeamId: ids[B], ...farSlot() });
    expect(denied.status).toBe(403);
    expect(denied.body.error).toMatch(/Leyendas/);
    expect((await leyA.get("/api/teams")).status).toBe(403);
    expect((await leyA.get("/api/team")).body.team.inviteCode).toBeNull();
    expect((await leyA.post("/api/team", { name: "Nuevo", tag: "NVO" })).status).toBe(400); // ya tiene equipo

    // Leyenda sin equipo: ranking y torneos sí; scrims no
    expect((await free.get("/api/leaderboard")).status).toBe(200);
    const t = await free.get("/api/tournaments");
    expect(t.status).toBe(200);
    expect(t.body.eligibility).toBeNull();
    expect((await free.get("/api/scrims?scope=upcoming")).status).toBe(403);
    expect((await free.post("/api/team", { name: "Nuevo", tag: "NVO" })).status).toBe(403);
    const page = await fetch(`${BASE_URL}/scrims`, { headers: { Cookie: free.cookie }, redirect: "manual" });
    expect(page.headers.get("location")).toContain("/leaderboard");
  });
});
