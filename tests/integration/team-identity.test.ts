// Integración: imagen del equipo, roles que asigna el coach y Leyenda que se une al roster con su op.gg.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ApiClient, BASE_URL } from "../helpers/http";

const db = new PrismaClient();
const sfx = Date.now().toString(36).slice(-4).toUpperCase();
const TAG = `L${sfx}`;
const PASS = "Identidad123";
const u = (prefix: string) => `${prefix}.${TAG.toLowerCase()}`;
// PNG real de 1×1 y un "PNG" falso que en realidad es SVG (puede llevar scripts)
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const FAKE = `data:image/png;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString("base64")}`;
// Cuenta pública real del servidor KR (distinta de la de la prueba I3, que corre en paralelo)
const OPGG = "https://op.gg/lol/summoners/kr/Peanut-KR1";
let coach: ApiClient;
let captain: ApiClient;
let analystId = "";
let teamId = "";

beforeAll(async () => {
  // El coach crea su equipo con imagen desde el onboarding (misma validación que el registro)
  const hash = await bcrypt.hash(PASS, 8);
  await db.user.create({ data: { username: u("coach"), email: `${u("coach")}@test.dev`, passwordHash: hash, role: "COACH" } });
  coach = await new ApiClient().login(u("coach"), PASS);
  const created = await coach.post("/api/team", { name: `Identidad ${sfx}`, tag: TAG, region: "KR", color: "#C8AA6E", logo: PNG });
  if (created.status !== 200) throw new Error(`crear equipo: ${JSON.stringify(created.body)}`);
  expect(created.body.team.logo).toBeUndefined(); // la respuesta nunca incluye los bytes de la imagen
  teamId = (await db.team.findUniqueOrThrow({ where: { tag: TAG } })).id;
  await db.user.create({ data: { username: u("cap"), email: `${u("cap")}@test.dev`, passwordHash: hash, role: "CAPTAIN", teamId } });
  analystId = (await db.user.create({ data: { username: u("ana"), email: `${u("ana")}@test.dev`, passwordHash: hash, role: "ANALYST", teamId } })).id;
  captain = await new ApiClient().login(u("cap"), PASS);
});

afterAll(async () => {
  await db.team.deleteMany({ where: { tag: TAG } });
  await db.user.deleteMany({ where: { username: { endsWith: TAG.toLowerCase() } } });
  await db.$disconnect();
});

describe("Integración · identidad del equipo, roles y Leyendas en el roster", () => {
  it("I8 · imagen del equipo validada por contenido; coach y capitán editan el emblema; el coach asigna roles", async () => {
    // La imagen subida al crear el equipo se sirve como PNG, protegida y versionada
    const team = (await coach.get("/api/team")).body.team;
    expect(team.logoUpdatedAt).toEqual(expect.any(String));
    const res = await fetch(`${BASE_URL}/api/teams/${teamId}/logo?v=1`, { headers: { Cookie: coach.cookie } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-security-policy")).toMatch(/default-src 'none'/);
    expect((await fetch(`${BASE_URL}/api/teams/${teamId}/logo`)).status).toBe(401); // requiere sesión

    // Un archivo que dice ser PNG pero no lo es se rechaza
    const fake = await coach.patch("/api/team", { logo: FAKE });
    expect(fake.status).toBe(422);
    expect(fake.body.error).toMatch(/no es una imagen/);

    // El capitán cambia el emblema (imagen y color), pero no el nombre
    expect((await captain.patch("/api/team", { color: "#0AC8B9", logo: null })).status).toBe(200);
    expect(await db.team.findUniqueOrThrow({ where: { id: teamId } })).toMatchObject({ color: "#0AC8B9", logo: null, logoUpdatedAt: null });
    expect((await captain.patch("/api/team", { name: "Otro nombre" })).status).toBe(403);
    expect((await captain.get("/api/team")).body).toMatchObject({ canEditEmblem: true, canManage: false });

    // Roles: solo el coach los asigna y el equipo nunca se queda sin coach
    expect((await captain.patch(`/api/team/members/${analystId}`, { role: "CAPTAIN" })).status).toBe(403);
    const promoted = await coach.patch(`/api/team/members/${analystId}`, { role: "CAPTAIN" });
    expect(promoted.status).toBe(200);
    expect(promoted.body.message).toMatch(/ahora es Capitán/);
    const coachId = (await coach.get("/api/auth/me")).body.user.id as string;
    const alone = await coach.patch(`/api/team/members/${coachId}`, { role: "ANALYST" });
    expect(alone.status).toBe(400);
    expect(alone.body.error).toMatch(/único coach/);
  });

  it("I9 · la Leyenda que se une con el código del equipo entra al roster con su op.gg", async () => {
    const code = (await coach.get("/api/team")).body.team.inviteCode as string;
    // Leyenda sin equipo que luego se une con el código (el registro directo usa la misma validación)
    await db.user.create({ data: { username: u("ley"), email: `${u("ley")}@test.dev`, passwordHash: await bcrypt.hash(PASS, 8), role: "LEGEND" } });
    const legend = await new ApiClient().login(u("ley"), PASS);

    const without = await legend.post("/api/team/join", { inviteCode: code });
    expect(without.status).toBe(422);
    expect(without.body.error).toMatch(/op.gg/);
    // El op.gg debe ser del servidor del equipo (KR)
    expect((await legend.post("/api/team/join", { inviteCode: code, player: { opgg: "https://op.gg/lol/summoners/lan/Peanut-KR1", position: "SUB" } })).status).toBe(422);
    expect(await db.user.findUniqueOrThrow({ where: { username: u("ley") } })).toMatchObject({ teamId: null });

    const ok = await legend.post("/api/team/join", { inviteCode: code, player: { opgg: OPGG, position: "JUNGLE" } });
    expect(ok.status).toBe(200);
    expect(ok.body.joinedRoster).toBe(true);

    const user = await db.user.findUniqueOrThrow({ where: { username: u("ley") }, include: { player: true } });
    expect(user).toMatchObject({ role: "LEGEND", teamId });
    expect(user.player).toMatchObject({ teamId, gameName: "Peanut", tagLine: "KR1", position: "JUNGLE" });

    // El roster la muestra con su cuenta; la Leyenda sigue siendo de solo lectura
    const roster = (await coach.get("/api/team/players")).body.players;
    expect(roster.find((p: { account: string | null }) => p.account === u("ley"))).toMatchObject({ position: "JUNGLE" });
    expect((await legend.post("/api/team/players", { opgg: OPGG, position: "SUB" })).status).toBe(403);

    // Si el coach la quita del equipo, también sale del roster
    expect((await coach.req("DELETE", `/api/team/members/${user.id}`)).status).toBe(200);
    expect(await db.player.count({ where: { userId: user.id } })).toBe(0);
  });
});
