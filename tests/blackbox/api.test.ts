// Caja negra: se prueba la API desplegada solo por sus entradas/salidas HTTP, sin conocer la implementación.
// Requiere el stack levantado (docker compose up -d) y los datos demo.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiClient, BASE_URL, farSlot, loggedIn, teamId } from "../helpers/http";

let shr: ApiClient; // anfitrión
let dmc: ApiClient; // rival
let hxw: ApiClient; // tercero sin relación
let dmcId: string;
const created: string[] = [];

beforeAll(async () => {
  [shr, dmc, hxw] = await Promise.all([loggedIn("coach.shr"), loggedIn("analyst.dmc"), loggedIn("cap.hxw")]);
  dmcId = await teamId(shr, "DMC");
});

afterAll(async () => {
  // Limpieza: se cancelan los scrims creados por la prueba
  for (const id of created) await shr.post(`/api/scrims/${id}/cancel`);
});

async function createScrim(slot = farSlot()) {
  const r = await shr.post("/api/scrims", { opponentTeamId: dmcId, ...slot, roomLink: "https://discord.gg/blackbox" });
  if (r.status === 200) created.push(r.body.scrim.id);
  return r;
}

describe("Caja negra · API REST", () => {
  it("N1 · Autenticación: credenciales malas dan 401 genérico; buenas dan cookie httpOnly y /me devuelve rol y equipo", async () => {
    const anon = new ApiClient();
    const bad = await anon.post("/api/auth/login", { identifier: "coach.shr", password: "incorrecta1" });
    expect(bad.status).toBe(401);
    expect(bad.body.error).toBe("Usuario o contraseña incorrectos");
    const ghost = await anon.post("/api/auth/login", { identifier: "no.existe", password: "incorrecta1" });
    expect(ghost.body.error).toBe(bad.body.error); // no revela si el usuario existe

    const okRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: BASE_URL },
      body: JSON.stringify({ identifier: "coach.shr", password: process.env.SEED_PASSWORD ?? "Scrims2026!" }),
    });
    expect(okRes.status).toBe(200);
    const cookie = okRes.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/aus_session=/);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");

    const me = await shr.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ username: "coach.shr", role: "COACH" });
    expect(me.body.user.team.tag).toBe("SHR");
    expect(me.body.user.passwordHash).toBeUndefined();
  });

  it("N2 · Control de acceso: sin sesión la API responde 401, las páginas redirigen a /login y se bloquea otro origen", async () => {
    const anon = new ApiClient();
    for (const path of ["/api/scrims?scope=history", "/api/team", "/api/leaderboard", "/api/teams"]) {
      expect((await anon.get(path)).status, path).toBe(401);
    }
    for (const page of ["/dashboard", "/calendar", "/scrims", "/team"]) {
      const r = await anon.get(page);
      expect(r.status, page).toBe(307);
      expect(r.headers.get("location")).toContain("/login");
    }
    const csrf = await shr.req("POST", "/api/scrims", { opponentTeamId: dmcId, ...farSlot() }, { Origin: "https://evil.example" });
    expect(csrf.status).toBe(403);
    // Solo el coach administra el equipo
    expect((await dmc.post("/api/team/invite")).status).toBe(403);
  });

  it("N3 · Agendar: datos válidos crean solicitud PENDIENTE con juegos y link; datos inválidos dan 422", async () => {
    const slot = farSlot(2, 5);
    const ok = await createScrim(slot);
    expect(ok.status).toBe(200);
    expect(ok.body.scrim).toMatchObject({ status: "PENDING", isHost: true, games: 5, roomLink: "https://discord.gg/blackbox" });
    expect(ok.body.scrim.opponent.tag).toBe("DMC");
    expect(new Date(ok.body.scrim.startAt).toISOString()).toBe(slot.startAt);

    const past = new Date(Date.now() - 2 * 86400_000);
    const invalid = [
      { ...farSlot(), games: 11 },
      { ...farSlot(), games: 0 },
      { startAt: past.toISOString(), endAt: new Date(past.getTime() + 7200_000).toISOString(), games: 3 },
      { ...farSlot(0.25) },
      { ...farSlot(), roomLink: "javascript:alert(1)" },
    ];
    for (const body of invalid) {
      const r = await shr.post("/api/scrims", { opponentTeamId: dmcId, ...body });
      expect(r.status, JSON.stringify(body)).toBe(422);
      expect(typeof r.body.error).toBe("string");
    }
    const self = await shr.post("/api/scrims", { opponentTeamId: (await shr.get("/api/auth/me")).body.user.team.id, ...farSlot() });
    expect(self.status).toBe(400);
  });

  it("N4 · Agenda: un choque de horario da 409, el anfitrión no puede aceptar su propia solicitud y el rival sí", async () => {
    const slot = farSlot(2);
    const first = await createScrim(slot);
    expect(first.status).toBe(200);
    const id = first.body.scrim.id;

    // Solapamiento parcial (empieza 1 h después)
    const overlap = await shr.post("/api/scrims", {
      opponentTeamId: dmcId,
      startAt: new Date(new Date(slot.startAt).getTime() + 3600_000).toISOString(),
      endAt: new Date(new Date(slot.endAt).getTime() + 3600_000).toISOString(),
      games: 3,
    });
    expect(overlap.status).toBe(409);
    expect(overlap.body.error).toMatch(/Choque de horario/);

    expect((await shr.post(`/api/scrims/${id}/respond`, { action: "accept" })).status).toBe(403);
    const accepted = await dmc.post(`/api/scrims/${id}/respond`, { action: "accept" });
    expect(accepted.status).toBe(200);
    expect(accepted.body.scrim).toMatchObject({ status: "CONFIRMED", isHost: false });
    expect((await dmc.post(`/api/scrims/${id}/respond`, { action: "accept" })).status).toBe(400); // ya respondida
  });

  it("N5 · Privacidad: un equipo ajeno no ve el scrim ni lo encuentra en su historial; el ranking sí es público para el staff", async () => {
    const r = await createScrim();
    const id = r.body.scrim.id;

    expect((await hxw.get(`/api/scrims/${id}`)).status).toBe(404);
    expect((await hxw.patch(`/api/scrims/${id}`, { roomLink: "https://evil.example" })).status).toBe(404);
    expect((await hxw.post(`/api/scrims/${id}/cancel`)).status).toBe(404);

    for (const scope of ["upcoming", "requests", "history"]) {
      const list = await hxw.get(`/api/scrims?scope=${scope}`);
      expect(list.status).toBe(200);
      expect(list.body.scrims.some((s: { id: string }) => s.id === id)).toBe(false);
      // Todo lo que ve HXW involucra a HXW
      for (const s of list.body.scrims) expect(s.myTeam.tag).toBe("HXW");
    }

    const board = await hxw.get("/api/leaderboard");
    expect(board.status).toBe(200);
    expect(board.body.teams.length).toBeGreaterThanOrEqual(2);
    const ratings = board.body.teams.map((t: { rating: number }) => t.rating);
    expect([...ratings].sort((a, b) => b - a)).toEqual(ratings); // ordenado por rating
  });
});
