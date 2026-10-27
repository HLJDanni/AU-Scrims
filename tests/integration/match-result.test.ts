// Integración: el ganador de un juego del draft se asigna pegando el Game ID (match-v5 de Riot).
// Usa una partida pública real del servidor KR; sin RIOT_API_KEY solo comprueba que se pide registrar a mano.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ApiClient } from "../helpers/http";

const db = new PrismaClient();
const sfx = Date.now().toString(36).slice(-4).toUpperCase();
const tags = [`M${sfx}`, `N${sfx}`];
const PASS = "GameId12345";
// Partida clasificatoria real: lado 100 (azul) perdió y el 200 (rojo) ganó
const MATCH = "KR_8421752997";
const MATCH_START = new Date(1792169600635 - 1011 * 1000);
const SIDE_100 = ["Ambessa", "Khazix", "Ryze", "Corki", "Lissandra"];
const SIDE_200 = ["Renekton", "Rengar", "Galio", "Tristana", "Milio"];
const ids: Record<string, string> = {};
let host: ApiClient;
let scrimId = "";

/** Acciones del draft (20) con los picks dados para cada lado, en el orden profesional. */
function actions(blue: string[], red: string[]) {
  const order = "BBBBBBBRRBBRRBRBRBBR"; // lado de cada acción
  const kind = "BBBBBBPPPPPPBBBBPPPP"; // B = baneo, P = pick
  const b = [...blue];
  const r = [...red];
  return Array.from(order, (side, i) => (kind[i] === "P" ? (side === "B" ? b.shift()! : r.shift()!) : null));
}

beforeAll(async () => {
  const hash = await bcrypt.hash(PASS, 8);
  for (const tag of tags) {
    const team = await db.team.create({ data: { name: `GameId ${tag}`, tag, region: "KR", inviteCode: `GI${tag}X` } });
    ids[tag] = team.id;
    await db.user.create({ data: { username: `coach.${tag.toLowerCase()}`, email: `coach.${tag.toLowerCase()}@test.dev`, passwordHash: hash, role: "COACH", teamId: team.id } });
  }
  host = await new ApiClient().login(`coach.${tags[0].toLowerCase()}`, PASS);
  const scrim = await db.scrim.create({
    data: {
      requesterTeamId: ids[tags[0]],
      opponentTeamId: ids[tags[1]],
      startAt: new Date(MATCH_START.getTime() - 30 * 60_000),
      endAt: new Date(MATCH_START.getTime() + 3 * 3600_000),
      games: 2,
      status: "CONFIRMED",
    },
  });
  scrimId = scrim.id;
  // Juego 1: en el draft M fue azul con los campeones que en la partida jugaron en el lado 200 (lados cambiados en el lobby)
  const draft = { blue: SIDE_200, red: SIDE_100 };
  await db.draftGame.create({
    data: {
      scrimId,
      number: 1,
      blueTeamId: ids[tags[0]],
      redTeamId: ids[tags[1]],
      sideChosenBy: ids[tags[1]],
      status: "DONE",
      step: 20,
      actions: actions(draft.blue, draft.red) as Prisma.InputJsonValue,
      createdAt: new Date(MATCH_START.getTime() - 5 * 60_000),
    },
  });
});

afterAll(async () => {
  await db.team.deleteMany({ where: { tag: { in: tags } } });
  await db.user.deleteMany({ where: { username: { in: [...tags.map((t) => `coach.${t.toLowerCase()}`), `admin.${tags[0].toLowerCase()}`] } } });
  await db.$disconnect();
});

describe("Integración · ganador del juego por Game ID", () => {
  it("I10 · el Game ID se verifica con Riot contra el draft, asigna la victoria y cierra el resultado de la serie", async () => {
    const draft = (body: Record<string, unknown>) => host.post(`/api/scrims/${scrimId}/draft`, body);
    const state = (await host.get(`/api/scrims/${scrimId}/draft`)).body;
    if (!state.riotMatch) {
      expect((await draft({ type: "match", game: 1, matchId: MATCH })).status).toBe(503);
      return;
    }

    expect((await draft({ type: "match", game: 1, matchId: "no es un id" })).status).toBe(422);
    const missing = await draft({ type: "match", game: 1, matchId: "KR_1000000001" });
    expect(missing.status).toBe(422);
    expect(missing.body.error).toMatch(/no encontró la partida/);

    // Con el número solo, se usa el servidor del equipo (KR). Ganó el lado 200, que en el draft era el azul (M)
    const ok = await draft({ type: "match", game: 1, matchId: MATCH.split("_")[1] });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.games[0]).toMatchObject({ winnerTeamId: ids[tags[0]], matchId: MATCH });
    const msg = (await host.get(`/api/scrims/${scrimId}/messages`)).body.messages.at(-1).body as string;
    expect(msg).toMatch(/verificado con Riot/);
    expect(msg).toMatch(/lados cambiados/);

    // El mismo Game ID no sirve para otro juego, y una partida que no coincide con el draft se rechaza
    await db.draftGame.create({
      data: { scrimId, number: 2, blueTeamId: ids[tags[1]], redTeamId: ids[tags[0]], sideChosenBy: ids[tags[1]], status: "DONE", step: 20, actions: actions(["Ahri", "Zed", "Yone", "Jinx", "Lulu"], ["Garen", "Darius", "Lux", "Ashe", "Sona"]) as Prisma.InputJsonValue, createdAt: new Date(MATCH_START.getTime() - 60_000) },
    });
    const reused = await draft({ type: "match", game: 2, matchId: MATCH });
    expect(reused.status).toBe(409);
    expect(reused.body.error).toMatch(/ya se registró en el juego 1/);
    await db.draftGame.update({ where: { scrimId_number: { scrimId, number: 1 } }, data: { matchId: null } }); // libera el ID para probar el cruce de campeones
    const mismatch = await draft({ type: "match", game: 2, matchId: MATCH });
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.error).toMatch(/no coinciden con el draft/);

    // Juego 2 a mano para el otro equipo y la serie queda 1-1; el resultado pasa al ranking
    await draft({ type: "winner", game: 2, teamId: ids[tags[1]] });
    const result = await host.post(`/api/scrims/${scrimId}/result`, { myScore: 1, opponentScore: 1 });
    expect(result.status).toBe(200);
    expect((await host.get(`/api/scrims/${scrimId}/draft`)).body.scrim.status).toBe("COMPLETED");
  });

  it("I11 · solo el administrador de la app elimina un scrim: desaparece con su chat y draft y los puntos vuelven a como estaban", async () => {
    const teams = () => db.team.findMany({ where: { id: { in: [ids[tags[0]], ids[tags[1]]] } }, orderBy: { tag: "asc" }, select: { rating: true } });
    const scrim = await db.scrim.create({
      data: { requesterTeamId: ids[tags[0]], opponentTeamId: ids[tags[1]], startAt: new Date(Date.now() - 4 * 3600_000), endAt: new Date(Date.now() - 2 * 3600_000), games: 3, status: "CONFIRMED" },
    });
    const before = await teams();
    expect((await host.post(`/api/scrims/${scrim.id}/result`, { myScore: 3, opponentScore: 0 })).status).toBe(200);
    expect(await teams()).not.toEqual(before);
    await host.post(`/api/scrims/${scrim.id}/messages`, { body: "gg, era de prueba" });

    // Ningún equipo puede borrarlo, ni siquiera su coach
    expect((await host.req("DELETE", `/api/admin/scrims/${scrim.id}`)).status).toBe(403);
    expect((await host.get("/api/admin/scrims")).status).toBe(403);
    expect((await host.req("DELETE", `/api/scrims/${scrim.id}`)).status).toBe(405);

    // El administrador (cuenta sin equipo con isAdmin) sí
    const adminName = `admin.${tags[0].toLowerCase()}`;
    await db.user.create({ data: { username: adminName, email: `${adminName}@test.dev`, passwordHash: await bcrypt.hash(PASS, 8), role: "LEGEND", isAdmin: true } });
    const admin = await new ApiClient().login(adminName, PASS);
    const list = await admin.get(`/api/admin/scrims?q=${tags[0]}`);
    expect(list.body.scrims.some((x: { id: string }) => x.id === scrim.id)).toBe(true);
    const removed = await admin.req("DELETE", `/api/admin/scrims/${scrim.id}`);
    expect(removed.status).toBe(200);
    expect(removed.body.pointsReverted).toBe(true);
    expect(await teams()).toEqual(before);
    expect(await db.scrim.count({ where: { id: scrim.id } })).toBe(0);
    expect(await db.scrimMessage.count({ where: { scrimId: scrim.id } })).toBe(0);
  });
});
