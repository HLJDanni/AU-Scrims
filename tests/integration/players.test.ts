// Integración: roster de jugadores (API + reglas + PostgreSQL). Funciona con o sin RIOT_API_KEY en el servidor:
// las reglas del roster se validan antes de consultar a Riot; con clave, además se verifica el rango real.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ApiClient, loggedIn } from "../helpers/http";

const db = new PrismaClient();
const sfx = Date.now().toString(36).slice(-4).toUpperCase();
const TAG = `R${sfx}`;
const PASS = "Roster12345";
// Cuenta pública real (servidor KR) para que el alta funcione también cuando la app consulta a Riot
const REAL = { gameName: "Hide on bush", tagLine: "KR1", link: "https://op.gg/lol/summoners/kr/Hide%20on%20bush-KR1" };
const kr = (name: string, tag = "KR1") => `https://op.gg/lol/summoners/kr/${encodeURIComponent(name)}-${tag}`;
let teamId = "";
let cap: ApiClient;
let analyst: ApiClient;
let other: ApiClient;

beforeAll(async () => {
  const team = await db.team.create({ data: { name: `Roster ${sfx}`, tag: TAG, region: "KR", inviteCode: `RS${sfx}XXXX` } });
  teamId = team.id;
  const hash = await bcrypt.hash(PASS, 8);
  for (const [role, prefix] of [["CAPTAIN", "cap"], ["ANALYST", "analyst"]] as const)
    await db.user.create({ data: { username: `${prefix}.${TAG.toLowerCase()}`, email: `${prefix}.${TAG.toLowerCase()}@test.dev`, passwordHash: hash, role, teamId } });
  [cap, analyst, other] = await Promise.all([
    new ApiClient().login(`cap.${TAG.toLowerCase()}`, PASS),
    new ApiClient().login(`analyst.${TAG.toLowerCase()}`, PASS),
    loggedIn("coach.hxw"),
  ]);
});

afterAll(async () => {
  await db.team.deleteMany({ where: { tag: TAG } });
  await db.user.deleteMany({ where: { username: { endsWith: TAG.toLowerCase() } } });
  await db.$disconnect();
});

describe("Integración · roster de jugadores", () => {
  it("I3 · link de op.gg obligatorio, reglas del roster, roles, rango desde Riot (si hay clave) y perfil privado para otros equipos", async () => {
    const riot = (await cap.get("/api/team/players")).body.rankSync as boolean;
    const mid = { opgg: REAL.link, position: "MID", tier: "IRON", division: 4, lp: 1 }; // el rango del cliente se ignora

    // Validaciones previas a Riot: link obligatorio, solo op.gg, servidor del equipo (KR)
    const { opgg: _, ...withoutLink } = mid;
    const missing = await cap.post("/api/team/players", withoutLink);
    expect(missing.status).toBe(422);
    expect(missing.body.error).toMatch(/op.gg es obligatorio/);
    expect((await cap.post("/api/team/players", { ...mid, opgg: "https://u.gg/lol/profile/kr1/Hide%20on%20bush-KR1" })).status).toBe(422);
    const wrongServer = await cap.post("/api/team/players", { ...mid, opgg: "https://op.gg/lol/summoners/lan/Hide%20on%20bush-KR1" });
    expect(wrongServer.status).toBe(422);
    expect(wrongServer.body.error).toMatch(/servidor LAN/);
    expect((await cap.post("/api/team/players", { ...mid, opgg: kr("ab") })).status).toBe(422); // Riot ID inválido

    // Analista: solo lectura
    expect((await analyst.post("/api/team/players", mid)).status).toBe(403);
    expect((await analyst.get("/api/team/players")).status).toBe(200);

    // Alta del capitán
    const created = await cap.post("/api/team/players", mid);
    expect(created.status).toBe(200);
    expect(created.body.rankSync).toBe(riot);
    expect(created.body.player).toMatchObject({ riotId: `${REAL.gameName}#${REAL.tagLine}`, position: "MID", opgg: REAL.link });
    if (riot) {
      // Con clave: rango real traído de Riot, nunca el que mandó el cliente
      expect(created.body.player.tier).not.toBe("IRON");
      expect(created.body.player.rankUpdatedAt).toEqual(expect.any(String));
      expect(created.body.player.level).toBeGreaterThan(0);
    } else {
      expect(created.body.player).toMatchObject({ tier: null, division: null, lp: 0, rankUpdatedAt: null });
    }
    const row = await db.player.findUniqueOrThrow({ where: { id: created.body.player.id } });
    expect(row).toMatchObject({ teamId, gameName: REAL.gameName, tagLine: REAL.tagLine });

    // Reglas del roster (antes de consultar a Riot)
    expect((await cap.post("/api/team/players", { ...mid, opgg: kr("OtroMid", "KR9") })).status).toBe(409); // titular repetido
    const dup = await cap.post("/api/team/players", { ...mid, opgg: kr("HIDE ON BUSH"), position: "SUB" }); // misma cuenta
    expect(dup.status).toBe(409);
    expect(dup.body.error).toMatch(/ya está registrado/);

    // Con clave: una cuenta que no existe se rechaza
    if (riot) {
      const fake = await cap.post("/api/team/players", { ...mid, opgg: kr(`NoExiste${sfx}`, "ZZZ9"), position: "SUB" });
      expect(fake.status).toBe(422);
      expect(fake.body.error).toMatch(/No existe una cuenta/);
    }

    // Sincronizar: con clave actualiza; sin clave avisa que falta configurarla
    const sync = await cap.post("/api/team/players/sync");
    if (riot) expect(sync.body).toMatchObject({ updated: 1, failed: [] });
    else {
      expect(sync.status).toBe(503);
      expect(sync.body.error).toMatch(/RIOT_API_KEY/);
    }

    // Editar la posición (misma cuenta: no vuelve a consultar a Riot)
    const edited = await cap.patch(`/api/team/players/${created.body.player.id}`, { opgg: REAL.link, position: "SUB" });
    expect(edited.status).toBe(200);
    expect(edited.body.player.position).toBe("SUB");

    // Otro equipo: no puede editarlo; ve el ELO promedio pero no los jugadores (no hay scrim entre ambos)
    expect((await other.req("DELETE", `/api/team/players/${created.body.player.id}`)).status).toBe(404);
    const profile = await other.get(`/api/teams/${teamId}/profile`);
    expect(profile.status).toBe(200);
    expect(profile.body.team.tag).toBe(TAG);
    expect(profile.body.players).toEqual([]);
    expect(profile.body.rosterHidden).toMatch(/scrim agendado/);

    // Quitar
    expect((await cap.req("DELETE", `/api/team/players/${created.body.player.id}`)).status).toBe(200);
    expect(await db.player.count({ where: { id: created.body.player.id } })).toBe(0);
  });
});
