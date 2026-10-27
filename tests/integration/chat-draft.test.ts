// Integración: chat del scrim y draft de la serie (API + reglas + PostgreSQL), con equipos temporales.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ApiClient } from "../helpers/http";

const db = new PrismaClient();
const sfx = Date.now().toString(36).slice(-4).toUpperCase();
const PASS = "ChatDraft123";
const tags = ["A", "B", "C"].map((l) => `${l}${sfx}`);
const ids: Record<string, string> = {};
const users: Record<string, ApiClient> = {};
let scrimId = "";
const draft = (c: ApiClient, body: Record<string, unknown>) => c.post(`/api/scrims/${scrimId}/draft`, body);

beforeAll(async () => {
  const hash = await bcrypt.hash(PASS, 8);
  for (const tag of tags) {
    const team = await db.team.create({ data: { name: `Draft ${tag}`, tag, inviteCode: `CD${tag}X` } });
    ids[tag] = team.id;
    await db.user.create({ data: { username: `coach.${tag.toLowerCase()}`, email: `coach.${tag.toLowerCase()}@test.dev`, passwordHash: hash, role: "COACH", teamId: team.id } });
    users[tag] = await new ApiClient().login(`coach.${tag.toLowerCase()}`, PASS);
  }
  const startAt = new Date(Date.now() + 2 * 86400_000);
  const scrim = await db.scrim.create({
    data: { requesterTeamId: ids[tags[0]], opponentTeamId: ids[tags[1]], startAt, endAt: new Date(startAt.getTime() + 3 * 3600_000), games: 3, status: "PENDING" },
  });
  scrimId = scrim.id;
});

afterAll(async () => {
  await db.team.deleteMany({ where: { tag: { in: tags } } });
  await db.user.deleteMany({ where: { username: { in: tags.map((t) => `coach.${t.toLowerCase()}`) } } });
  await db.$disconnect();
});

describe("Integración · chat y draft del scrim", () => {
  it("I6 · el chat se abre al aceptar, solo lo ven ambos equipos y cuenta los no leídos", async () => {
    const [a, b, c] = tags.map((t) => users[t]);
    expect((await a.get(`/api/scrims/${scrimId}/messages`)).status).toBe(403); // aún pendiente
    expect((await b.post(`/api/scrims/${scrimId}/respond`, { action: "accept" })).status).toBe(200);

    const first = await a.get(`/api/scrims/${scrimId}/messages`);
    expect(first.status).toBe(200);
    expect(first.body.messages[0]).toMatchObject({ system: true });
    expect(first.body.messages[0].body).toMatch(/Se abrió este chat/);

    const text = "Hola, jugamos Bo3 con fearless?";
    const sent = await a.post(`/api/scrims/${scrimId}/messages`, { body: text });
    expect(sent.status).toBe(200);
    expect(sent.body.message).toMatchObject({ mine: true, author: `coach.${tags[0].toLowerCase()}` });
    expect((await a.post(`/api/scrims/${scrimId}/messages`, { body: "   " })).status).toBe(422);

    const inbox = await b.get("/api/chats");
    const chat = inbox.body.chats.find((x: { scrim: { id: string } }) => x.scrim.id === scrimId);
    expect(chat.unread).toBe(2); // aviso del sistema + mensaje de A
    const fresh = await b.get(`/api/scrims/${scrimId}/messages?after=${encodeURIComponent(first.body.messages[0].createdAt)}`);
    expect(fresh.body.messages.map((m: { body: string }) => m.body)).toEqual([text]);
    expect(fresh.body.messages[0].mine).toBe(false);
    await b.post(`/api/scrims/${scrimId}/messages/read`);
    expect((await b.get("/api/chats")).body.unread).toBe(0);

    // Un tercer equipo no ve ni escribe en el chat ni en el draft
    expect((await c.get(`/api/scrims/${scrimId}/messages`)).status).toBe(404);
    expect((await c.post(`/api/scrims/${scrimId}/messages`, { body: "hola" })).status).toBe(404);
    expect((await c.get(`/api/scrims/${scrimId}/draft`)).status).toBe(404);
  });

  it("I7 · draft: modo fearless, lados, listos, turnos, tiempo agotado, bloqueo de campeones entre juegos y reinicio aprobado por ambos equipos", async () => {
    const [a, b] = tags.map((t) => users[t]);
    const champs = (await a.get("/api/champions")).body.champions.map((c: { id: string }) => c.id) as string[];
    expect(champs.length).toBeGreaterThan(150);

    expect((await draft(b, { type: "settings", fearless: true })).body.settings).toMatchObject({ fearless: true, editable: true });
    // Juego 1: elige lado el equipo invitado (B)
    expect((await draft(a, { type: "side", game: 1, side: "BLUE" })).status).toBe(403);
    let st = (await draft(b, { type: "side", game: 1, side: "RED" })).body;
    expect(st.games[0]).toMatchObject({ blueTeamId: ids[tags[0]], redTeamId: ids[tags[1]], status: "READY_CHECK" });
    await draft(a, { type: "ready", game: 1 });
    st = (await draft(b, { type: "ready", game: 1 })).body;
    expect(st.games[0]).toMatchObject({ status: "DRAFTING", step: 0 });
    expect(st.settings.editable).toBe(false);
    expect((await draft(b, { type: "settings", fearless: false })).status).toBe(400);

    // A es azul y B rojo. El paso 0 es del azul: el rojo no puede actuar
    const order = "ABABABABBAABBABABAAB";
    expect((await draft(b, { type: "lock", game: 1, step: 0, champion: champs[0] })).status).toBe(403);
    for (let step = 0; step < 20; step++) {
      const who = order[step] === "A" ? a : b;
      const champion = step === 1 ? null : champs[step]; // el rojo omite su primer baneo
      if (step === 2) expect((await draft(who, { type: "lock", game: 1, step, champion: champs[0] })).status).toBe(409); // repetido
      expect((await draft(who, { type: "lock", game: 1, step, champion })).status, `paso ${step}`).toBe(200);
    }
    st = (await a.get(`/api/scrims/${scrimId}/draft`)).body;
    expect(st.games[0]).toMatchObject({ status: "DONE", step: 20 });
    expect(st.games[0].actions[1]).toBeNull();
    expect(st.next).toMatchObject({ number: 2, chooserTeamId: null }); // falta registrar el ganador
    const summary = (await a.get(`/api/scrims/${scrimId}/messages`)).body.messages.at(-1);
    expect(summary.body).toMatch(/Draft del juego 1 terminado/);

    // Gana A (azul): el perdedor (B) elige lado del juego 2
    st = (await draft(a, { type: "winner", game: 1, teamId: ids[tags[0]] })).body;
    expect(st.next).toMatchObject({ number: 2, chooserTeamId: ids[tags[1]] });
    expect((await draft(a, { type: "side", game: 2, side: "BLUE" })).status).toBe(403);
    await draft(b, { type: "side", game: 2, side: "BLUE" }); // ahora B es azul y A rojo
    await draft(a, { type: "ready", game: 2 });
    await draft(b, { type: "ready", game: 2 });

    // Tiempo agotado en un baneo: se omite y avanza el turno
    await db.draftGame.updateMany({ where: { scrimId, number: 2 }, data: { turnEndsAt: new Date(Date.now() - 5000) } });
    st = (await a.get(`/api/scrims/${scrimId}/draft`)).body;
    expect(st.games[1].step).toBe(1);
    expect(st.games[1].actions).toEqual([null]);

    // Pasos 1-5 (rojo = A en los impares) hasta el primer pick (paso 6, azul = B)
    for (let step = 1; step <= 5; step++) {
      const who = step % 2 === 1 ? a : b;
      expect((await draft(who, { type: "lock", game: 2, step, champion: champs[100 + step] })).status).toBe(200);
    }
    // Fearless: champs[6] se eligió en el juego 1
    const blocked = await draft(b, { type: "lock", game: 2, step: 6, champion: champs[6] });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatch(/fearless/);
    // champs[0] solo se baneó en el juego 1: sí se puede elegir
    expect((await draft(b, { type: "lock", game: 2, step: 6, champion: champs[0] })).status).toBe(200);

    // Tiempo agotado en un pick: se elige solo un campeón disponible (nunca uno bloqueado)
    await db.draftGame.updateMany({ where: { scrimId, number: 2 }, data: { turnEndsAt: new Date(Date.now() - 5000) } });
    st = (await b.get(`/api/scrims/${scrimId}/draft`)).body;
    const auto = st.games[1].actions[7];
    expect(st.games[1].step).toBe(8);
    expect(typeof auto).toBe("string");
    expect(st.games[0].actions.slice(6, 12)).not.toContain(auto);

    // Con un campeón seleccionado (paso 8, rojo = A), al agotarse el tiempo se fija ese campeón
    expect((await draft(a, { type: "hover", game: 2, step: 8, champion: champs[60] })).status).toBe(200);
    await db.draftGame.updateMany({ where: { scrimId, number: 2 }, data: { turnEndsAt: new Date(Date.now() - 5000) } });
    st = (await b.get(`/api/scrims/${scrimId}/draft`)).body;
    expect(st.games[1].actions[8]).toBe(champs[60]);

    // Reiniciar necesita a los dos equipos: A lo pide y el draft sigue igual hasta que B acepta
    st = (await draft(a, { type: "reset", game: 2 })).body;
    expect(st.games[1]).toMatchObject({ status: "DRAFTING", step: 9, resetRequestedBy: ids[tags[0]] });
    st = (await draft(a, { type: "reset", game: 2 })).body; // pedirlo otra vez no lo reinicia
    expect(st.games[1]).toMatchObject({ status: "DRAFTING", step: 9 });
    // B lo rechaza: no pasa nada; A lo pide de nuevo y B acepta
    st = (await draft(b, { type: "resetCancel", game: 2 })).body;
    expect(st.games[1]).toMatchObject({ status: "DRAFTING", step: 9, resetRequestedBy: null });
    await draft(a, { type: "reset", game: 2 });
    st = (await draft(b, { type: "reset", game: 2 })).body;
    expect(st.games[1]).toMatchObject({ status: "READY_CHECK", step: 0, actions: [], blueReady: false, redReady: false, resetRequestedBy: null });
    const chat = (await a.get(`/api/scrims/${scrimId}/messages`)).body.messages.map((m: { body: string }) => m.body).join(" | ");
    expect(chat).toMatch(/pidió reiniciar el draft del juego 2/);
    expect(chat).toMatch(/rechazó reiniciar/);
    expect(chat).toMatch(/aceptó: el draft del juego 2 se reinició/);
  });
});
