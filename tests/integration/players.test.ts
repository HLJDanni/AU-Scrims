// Integración: roster de jugadores (API + reglas + PostgreSQL) y su visibilidad en el perfil del equipo.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ApiClient, loggedIn, teamId } from "../helpers/http";

const db = new PrismaClient();
const tag = `T${Date.now().toString(36).slice(-3).toUpperCase()}`;
let cap: ApiClient;
let analyst: ApiClient;
let other: ApiClient;
let shrId: string;
let backup: { id: string; position: "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT" | "SUB" }[] = [];

beforeAll(async () => {
  [cap, analyst, other] = await Promise.all([loggedIn("cap.shr"), loggedIn("analyst.shr"), loggedIn("coach.hxw")]);
  shrId = await teamId(cap, "SHR");
  // Libera la posición MID moviendo temporalmente a los titulares demo a suplentes
  backup = await db.player.findMany({ where: { teamId: shrId, position: "MID" }, select: { id: true, position: true } });
  await db.player.updateMany({ where: { id: { in: backup.map((b) => b.id) } }, data: { position: "SUB" } });
});

afterAll(async () => {
  await db.player.deleteMany({ where: { tagLine: tag } });
  for (const b of backup) await db.player.update({ where: { id: b.id }, data: { position: b.position } });
  await db.$disconnect();
});

describe("Integración · roster de jugadores", () => {
  it("I3 · capitán agrega/edita jugadores, analista no puede, se validan posición y cuenta duplicada, y el rival ve el perfil", async () => {
    const link = (name: string, region = "las") => `https://www.op.gg/summoners/${region}/${name}-${tag}`;
    // Ya no se envía el rango: lo trae la API de Riot (en este entorno no hay RIOT_API_KEY)
    const mid = { opgg: link("QaMidLaner"), position: "MID", tier: "CHALLENGER", division: 1, lp: 999 };

    // El link de op.gg es obligatorio y debe ser del servidor del equipo (SHR juega en LAS)
    const { opgg: _, ...withoutLink } = mid;
    const missing = await cap.post("/api/team/players", withoutLink);
    expect(missing.status).toBe(422);
    expect(missing.body.error).toMatch(/op.gg es obligatorio/);
    expect((await cap.post("/api/team/players", { ...mid, opgg: `https://u.gg/lol/profile/la2/QaMidLaner-${tag}` })).status).toBe(422);
    const wrongServer = await cap.post("/api/team/players", { ...mid, opgg: link("QaMidLaner", "lan") });
    expect(wrongServer.status).toBe(422);
    expect(wrongServer.body.error).toMatch(/servidor LAN/);

    // Analista: solo lectura
    expect((await analyst.post("/api/team/players", mid)).status).toBe(403);
    expect((await analyst.get("/api/team/players")).status).toBe(200);

    // Capitán agrega al MID
    const created = await cap.post("/api/team/players", mid);
    expect(created.status).toBe(200);
    // El rango enviado por el cliente se ignora; sin clave de Riot queda sin sincronizar
    expect(created.body.player).toMatchObject({ riotId: `QaMidLaner#${tag}`, position: "MID", tier: null, division: null, lp: 0, rankUpdatedAt: null });
    expect(created.body.rankSync).toBe(false);
    const sync = await cap.post("/api/team/players/sync");
    expect(sync.status).toBe(503);
    expect(sync.body.error).toMatch(/RIOT_API_KEY/);
    expect(created.body.player.opgg).toBe(`https://op.gg/lol/summoners/las/QaMidLaner-${tag}`); // normalizado
    const row = await db.player.findUniqueOrThrow({ where: { id: created.body.player.id } });
    expect(row).toMatchObject({ teamId: shrId, gameName: "QaMidLaner", tagLine: tag });

    // Segundo titular en MID → 409
    expect((await cap.post("/api/team/players", { ...mid, opgg: link("QaOtroMid") })).status).toBe(409);
    // Misma cuenta (sin importar mayúsculas) → 409
    const dup = await cap.post("/api/team/players", { ...mid, opgg: link("qamidlaner"), position: "SUB" });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toMatch(/ya está registrado/);
    // Riot ID inválido dentro del link → 422
    expect((await cap.post("/api/team/players", { ...mid, opgg: link("ab"), position: "SUB" })).status).toBe(422);

    // Editar: cambiar a suplente y a otra cuenta
    const edited = await cap.patch(`/api/team/players/${created.body.player.id}`, { opgg: link("QaRenamed"), position: "SUB" });
    expect(edited.status).toBe(200);
    expect(edited.body.player).toMatchObject({ riotId: `QaRenamed#${tag}`, position: "SUB", tier: null });

    // Otro equipo no puede editarlo, pero sí ve el perfil con descripción y ELO promedio
    expect((await other.req("DELETE", `/api/team/players/${created.body.player.id}`)).status).toBe(404);
    const profile = await other.get(`/api/teams/${shrId}/profile`);
    expect(profile.status).toBe(200);
    expect(profile.body.team.tag).toBe("SHR");
    expect(profile.body.players.some((p: { riotId: string }) => p.riotId === `QaRenamed#${tag}`)).toBe(true);
    expect(profile.body.rankSync).toBe(false);
    expect(profile.body.eloAverage.label).toEqual(expect.any(String));
    expect(profile.body.players[0]).not.toHaveProperty("teamId");

    // Quitar
    expect((await cap.req("DELETE", `/api/team/players/${created.body.player.id}`)).status).toBe(200);
    expect(await db.player.count({ where: { id: created.body.player.id } })).toBe(0);
  });
});
