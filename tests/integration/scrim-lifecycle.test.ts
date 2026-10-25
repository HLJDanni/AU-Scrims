// Integración: API HTTP + reglas de negocio + PostgreSQL real.
// Se recorre el ciclo de vida completo de un scrim y se verifica el estado persistido en la base de datos.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { eloDelta } from "@/lib/elo";
import { getLeaderboard } from "@/lib/leaderboard";
import { ApiClient, farSlot, loggedIn, teamId } from "../helpers/http";

const db = new PrismaClient();
let frf: ApiClient;
let ion: ApiClient;
let frfId: string;
let ionId: string;
let scrimId: string | undefined;
let ratingsBefore: Record<string, number> = {};

beforeAll(async () => {
  [frf, ion] = await Promise.all([loggedIn("coach.frf"), loggedIn("cap.ion")]);
  [frfId, ionId] = await Promise.all([teamId(frf, "FRF"), teamId(ion, "ION")]);
  const teams = await db.team.findMany({ where: { id: { in: [frfId, ionId] } } });
  ratingsBefore = Object.fromEntries(teams.map((t) => [t.id, t.rating]));
});

afterAll(async () => {
  // Deja la BD como estaba: borra el scrim (y su bitácora en cascada) y restaura el rating
  if (scrimId) await db.scrim.deleteMany({ where: { id: scrimId } });
  for (const [id, rating] of Object.entries(ratingsBefore)) await db.team.update({ where: { id }, data: { rating } });
  await db.$disconnect();
});

describe("Integración · ciclo de vida de un scrim", () => {
  it("I1 · agendar → aceptar → proponer re-agenda → aprobar → jugar → registrar resultado actualiza BD, bitácora y ranking", async () => {
    // 1. FRF agenda contra ION
    const slot = farSlot(2, 3);
    const created = await frf.post("/api/scrims", { opponentTeamId: ionId, ...slot, notes: "Fearless draft" });
    expect(created.status).toBe(200);
    scrimId = created.body.scrim.id as string;
    let row = await db.scrim.findUniqueOrThrow({ where: { id: scrimId } });
    expect(row).toMatchObject({ status: "PENDING", requesterTeamId: frfId, opponentTeamId: ionId, games: 3, notes: "Fearless draft" });

    // 2. ION acepta
    expect((await ion.post(`/api/scrims/${scrimId}/respond`, { action: "accept" })).status).toBe(200);
    expect((await db.scrim.findUniqueOrThrow({ where: { id: scrimId } })).status).toBe("CONFIRMED");

    // 3. FRF propone otro horario (al estar confirmado no se mueve directo)
    const next = { startAt: new Date(new Date(slot.startAt).getTime() + 86400_000).toISOString(), endAt: new Date(new Date(slot.endAt).getTime() + 86400_000).toISOString(), games: 5 };
    const proposed = await frf.post(`/api/scrims/${scrimId}/reschedule`, next);
    expect(proposed.status).toBe(200);
    expect(proposed.body.direct).toBe(false);
    row = await db.scrim.findUniqueOrThrow({ where: { id: scrimId } });
    expect(row.startAt.toISOString()).toBe(slot.startAt); // sin cambios aún
    expect(row.proposedStartAt?.toISOString()).toBe(next.startAt);
    expect(row.proposedByTeamId).toBe(frfId);

    // 4. ION aprueba: se aplica el horario y se limpia la propuesta
    expect((await ion.post(`/api/scrims/${scrimId}/proposal`, { action: "accept" })).status).toBe(200);
    row = await db.scrim.findUniqueOrThrow({ where: { id: scrimId } });
    expect(row.startAt.toISOString()).toBe(next.startAt);
    expect(row.games).toBe(5);
    expect(row.proposedStartAt).toBeNull();
    expect(row.proposedByTeamId).toBeNull();

    // 5. El link de sala se guarda y es visible para ambos
    expect((await ion.patch(`/api/scrims/${scrimId}`, { roomLink: "https://discord.gg/integracion" })).status).toBe(200);
    expect((await frf.get(`/api/scrims/${scrimId}`)).body.scrim.roomLink).toBe("https://discord.gg/integracion");

    // 6. Antes de jugarse no se puede registrar resultado
    expect((await frf.post(`/api/scrims/${scrimId}/result`, { myScore: 3, opponentScore: 2 })).status).toBe(400);

    // 7. Simulamos que el scrim ya se jugó (lo movemos al pasado directamente en BD)
    const playedAt = new Date(Date.now() - 3 * 3600_000);
    await db.scrim.update({ where: { id: scrimId }, data: { startAt: playedAt, endAt: new Date(playedAt.getTime() + 2 * 3600_000) } });

    // 8. Validación de marcador: no puede superar los juegos acordados
    expect((await frf.post(`/api/scrims/${scrimId}/result`, { myScore: 4, opponentScore: 2 })).status).toBe(422);

    // 9. FRF registra 3-2
    const before = await db.team.findMany({ where: { id: { in: [frfId, ionId] } } });
    const rFrf = before.find((t) => t.id === frfId)!.rating;
    const rIon = before.find((t) => t.id === ionId)!.rating;
    const result = await frf.post(`/api/scrims/${scrimId}/result`, { myScore: 3, opponentScore: 2 });
    expect(result.status).toBe(200);

    const expectedDelta = eloDelta(rFrf, rIon, 3, 2);
    row = await db.scrim.findUniqueOrThrow({ where: { id: scrimId } });
    expect(row).toMatchObject({ status: "COMPLETED", requesterScore: 3, opponentScore: 2, ratingDelta: expectedDelta });
    const after = await db.team.findMany({ where: { id: { in: [frfId, ionId] } } });
    expect(after.find((t) => t.id === frfId)!.rating).toBe(rFrf + expectedDelta);
    expect(after.find((t) => t.id === ionId)!.rating).toBe(rIon - expectedDelta);

    // 10. ION no puede registrar de nuevo (bloqueo)
    expect((await ion.post(`/api/scrims/${scrimId}/result`, { myScore: 3, opponentScore: 0 })).status).toBe(400);

    // 11. ION ve el resultado desde su perspectiva y en su historial
    const ionView = (await ion.get(`/api/scrims/${scrimId}`)).body.scrim;
    expect(ionView).toMatchObject({ myScore: 2, opponentScore: 3, ratingDelta: -expectedDelta });
    const history = await ion.get("/api/scrims?scope=history");
    expect(history.body.scrims.some((s: { id: string }) => s.id === scrimId)).toBe(true);

    // 12. Bitácora completa y en orden
    const events = await db.scrimEvent.findMany({ where: { scrimId }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.type)).toEqual(["CREATED", "ACCEPTED", "PROPOSED", "PROPOSAL_ACCEPTED", "ROOM", "RESULT"]);

    // 13. El ranking (lib + BD) refleja el nuevo rating
    const board = await getLeaderboard();
    expect(board.find((t) => t.id === frfId)!.rating).toBe(rFrf + expectedDelta);
  });
});
