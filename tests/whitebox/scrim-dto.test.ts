// Caja blanca: se recorren deliberadamente todas las ramas de toDTO (src/lib/scrims.ts).
import { describe, expect, it } from "vitest";
import { toDTO } from "@/lib/scrims";

const home = { id: "home", name: "Home", tag: "HOM", color: "#C8AA6E", rating: 1250 };
const away = { id: "away", name: "Away", tag: "AWY", color: "#0AC8B9", rating: 1180 };

function scrim(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    requesterTeamId: home.id,
    opponentTeamId: away.id,
    createdById: "u1",
    startAt: new Date("2030-01-01T19:00:00Z"),
    endAt: new Date("2030-01-01T21:00:00Z"),
    games: 3,
    status: "COMPLETED",
    roomLink: null,
    notes: null,
    proposedStartAt: null,
    proposedEndAt: null,
    proposedGames: null,
    proposedByTeamId: null,
    requesterScore: 2,
    opponentScore: 1,
    ratingDelta: 12,
    createdAt: new Date("2029-12-01T00:00:00Z"),
    updatedAt: new Date("2029-12-01T00:00:00Z"),
    requesterTeam: home,
    opponentTeam: away,
    createdBy: { username: "coach.home" },
    ...overrides,
  } as any;
}

describe("Caja blanca · toDTO (perspectiva del equipo)", () => {
  it("W1 · rama anfitrión vs rama invitado: equipos, marcador y delta se invierten correctamente", () => {
    const asHost = toDTO(scrim(), home.id);
    expect(asHost).toMatchObject({ isHost: true, myScore: 2, opponentScore: 1, ratingDelta: 12, createdBy: "coach.home" });
    expect(asHost.myTeam.id).toBe(home.id);
    expect(asHost.opponent.id).toBe(away.id);

    const asGuest = toDTO(scrim(), away.id);
    expect(asGuest).toMatchObject({ isHost: false, myScore: 1, opponentScore: 2, ratingDelta: -12 });
    expect(asGuest.myTeam.id).toBe(away.id);

    // Rama ratingDelta == null y createdBy == null
    const pending = toDTO(scrim({ status: "PENDING", requesterScore: null, opponentScore: null, ratingDelta: null, createdBy: null }), away.id);
    expect(pending.ratingDelta).toBeNull();
    expect(pending.myScore).toBeNull();
    expect(pending.createdBy).toBeNull();
  });

  it("W2 · ramas de propuesta: sin propuesta, propuesta propia, propuesta del rival y juegos por defecto", () => {
    expect(toDTO(scrim(), home.id).proposal).toBeNull();
    // Solo una de las dos fechas presente => se considera sin propuesta
    expect(toDTO(scrim({ proposedStartAt: new Date("2030-01-02T19:00:00Z") }), home.id).proposal).toBeNull();

    const withProposal = scrim({
      status: "CONFIRMED",
      proposedStartAt: new Date("2030-01-02T19:00:00Z"),
      proposedEndAt: new Date("2030-01-02T21:00:00Z"),
      proposedGames: null, // => usa los juegos actuales
      proposedByTeamId: away.id,
    });
    const forHost = toDTO(withProposal, home.id);
    expect(forHost.proposal).toEqual({ startAt: "2030-01-02T19:00:00.000Z", endAt: "2030-01-02T21:00:00.000Z", games: 3, byMe: false });
    expect(toDTO(withProposal, away.id).proposal?.byMe).toBe(true);
    expect(toDTO({ ...withProposal, proposedGames: 5 }, home.id).proposal?.games).toBe(5);
  });
});
