// Integración: eliminación de equipo (solo Coach) vía API, verificando el efecto en PostgreSQL.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ApiClient, farSlot, teamId } from "../helpers/http";

const db = new PrismaClient();
const suffix = Date.now().toString(36).slice(-5);
const teamName = `QA Delete ${suffix}`;
const usernames = [`qa_del_coach_${suffix}`, `qa_del_cap_${suffix}`];

afterAll(async () => {
  await db.team.deleteMany({ where: { name: teamName } });
  await db.user.deleteMany({ where: { username: { in: usernames } } });
  await db.$disconnect();
});

describe("Integración · eliminar equipo", () => {
  it("I2 · solo el coach puede eliminarlo, debe confirmar el nombre y se borran sus scrims y la membresía del staff", async () => {
    // Coach crea el equipo al registrarse
    const coach = new ApiClient();
    const reg = await coach.post("/api/auth/register", {
      username: usernames[0],
      email: `${usernames[0]}@test.dev`,
      password: "Segura123",
      role: "COACH",
      mode: "create",
      team: { name: teamName, tag: `Q${suffix.slice(-4)}`.toUpperCase() },
    });
    expect(reg.status).toBe(200);
    const myTeamId = await teamId(coach, `Q${suffix.slice(-4)}`.toUpperCase());

    // Un capitán se une con el código de invitación
    const invite = (await coach.get("/api/team")).body.team.inviteCode;
    const cap = new ApiClient();
    expect(
      (await cap.post("/api/auth/register", { username: usernames[1], email: `${usernames[1]}@test.dev`, password: "Segura123", role: "CAPTAIN", mode: "join", inviteCode: invite })).status,
    ).toBe(200);

    // Un scrim pendiente contra otro equipo
    const dmcId = await teamId(coach, "DMC");
    const scrim = await coach.post("/api/scrims", { opponentTeamId: dmcId, ...farSlot() });
    expect(scrim.status).toBe(200);

    // El capitán no puede eliminar el equipo
    const denied = await cap.req("DELETE", "/api/team", { confirmName: teamName });
    expect(denied.status).toBe(403);
    // Nombre incorrecto
    expect((await coach.req("DELETE", "/api/team", { confirmName: "otro nombre" })).status).toBe(422);
    expect(await db.team.count({ where: { id: myTeamId } })).toBe(1);

    // El coach confirma y elimina
    const ok = await coach.req("DELETE", "/api/team", { confirmName: teamName });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ ok: true, members: 2, scrims: 1 });

    expect(await db.team.count({ where: { id: myTeamId } })).toBe(0);
    expect(await db.scrim.count({ where: { id: scrim.body.scrim.id } })).toBe(0);
    const users = await db.user.findMany({ where: { username: { in: usernames } } });
    expect(users.every((u) => u.teamId === null)).toBe(true);

    // Sin equipo: la API lo exige y la app los manda al onboarding
    expect((await coach.get("/api/team")).status).toBe(403);
    const page = await cap.get("/dashboard");
    expect(page.headers.get("location")).toContain("/onboarding");
  });
});
