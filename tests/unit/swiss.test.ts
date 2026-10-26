import { describe, expect, it } from "vitest";
import { bestOfFor, pairRound, standings, statusFor, type SwissEntry, type SwissMatch } from "@/lib/swiss";
import { evaluateEligibility } from "@/lib/tournament-rules";

/** ¿Existe un emparejamiento perfecto de estos equipos sin repetir rival? (fuerza bruta, solo para pruebas) */
function rematchFreeExists(ids: string[], played: Set<string>): boolean {
  if (ids.length === 0) return true;
  const [first, ...rest] = ids;
  return rest.some((o) => !played.has([first, o].sort().join("|")) && rematchFreeExists(rest.filter((x) => x !== o), played));
}

/** Simula un torneo completo con el motor real; gana siempre la mejor siembra salvo "upsets" deterministas. */
function simulate(n: number) {
  const forcedRematches: number[] = [];
  let avoidableRematches = 0;
  const entries: SwissEntry[] = Array.from({ length: n }, (_, i) => ({ teamId: `T${i + 1}`, seed: i + 1, wins: 0, losses: 0, status: "ALIVE" }));
  const matches: SwissMatch[] = [];
  let round = 0;
  while (entries.some((e) => e.status === "ALIVE") && round < 9) {
    round++;
    const pairs = pairRound(entries, matches, round);
    const played = new Set(matches.filter((m) => m.teamBId).map((m) => [m.teamAId, m.teamBId!].sort().join("|")));
    const real = pairs.filter((p) => p.teamBId);
    if (real.some((p) => played.has([p.teamAId, p.teamBId!].sort().join("|")))) {
      // Hubo revancha: solo es válida si no existía alternativa
      if (rematchFreeExists(real.flatMap((p) => [p.teamAId, p.teamBId!]), played)) avoidableRematches++;
      else forcedRematches.push(round);
    }
    for (const p of pairs) {
      const a = entries.find((e) => e.teamId === p.teamAId)!;
      const b = p.teamBId ? entries.find((e) => e.teamId === p.teamBId)! : null;
      // Upset determinista cada 3 partidos para que haya récords mezclados
      const upset = (round + a.seed) % 3 === 0;
      const winner = !b ? a : (a.seed < b.seed) !== upset ? a : b;
      const loser = !b ? null : winner === a ? b : a;
      matches.push({ round, teamAId: p.teamAId, teamBId: p.teamBId, winnerId: winner.teamId });
      winner.wins++;
      winner.status = statusFor(winner.wins, winner.losses);
      if (loser) {
        loser.losses++;
        loser.status = statusFor(loser.wins, loser.losses);
      }
    }
  }
  return { entries, matches, round, forcedRematches, avoidableRematches };
}

describe("Unitarias · motor suizo y elegibilidad", () => {
  it("S1 · ronda 1 por siembra, Bo3 en partidos decisivos, descanso con número impar y sin revanchas evitables", () => {
    const entries: SwissEntry[] = Array.from({ length: 8 }, (_, i) => ({ teamId: `T${i + 1}`, seed: i + 1, wins: 0, losses: 0, status: "ALIVE" }));
    expect(pairRound(entries, [], 1).map((p) => [p.teamAId, p.teamBId])).toEqual([
      ["T1", "T5"],
      ["T2", "T6"],
      ["T3", "T7"],
      ["T4", "T8"],
    ]);
    expect(bestOfFor({ wins: 1, losses: 1 }, { wins: 1, losses: 0 })).toBe(1);
    expect(bestOfFor({ wins: 2, losses: 1 }, { wins: 1, losses: 1 })).toBe(3); // puede clasificar
    expect(bestOfFor({ wins: 0, losses: 2 }, { wins: 1, losses: 1 })).toBe(3); // puede quedar eliminado

    // Impar: el peor ubicado descansa, una sola vez por equipo
    const odd = entries.slice(0, 5);
    const r1 = pairRound(odd, [], 1);
    expect(r1.filter((p) => p.teamBId === null)).toEqual([{ teamAId: "T5", teamBId: null, bestOf: 0 }]);

    for (const n of [4, 6, 7, 8, 12, 16]) {
      const { entries: done, matches, round, avoidableRematches } = simulate(n);
      // Termina: nadie queda en juego y nadie jugó más de 5 rondas
      expect(done.every((e) => e.status !== "ALIVE"), `n=${n}`).toBe(true);
      expect(round, `n=${n}`).toBeLessThanOrEqual(7);
      expect(done.every((e) => e.wins + e.losses <= 5), `n=${n}`).toBe(true);
      // Nunca repite rival si había otra opción (a veces es inevitable: p. ej. los 2 últimos 2-2 ya se enfrentaron)
      expect(avoidableRematches, `revancha evitable con n=${n}`).toBe(0);
      // Cada equipo descansa como máximo una vez
      const byes = matches.filter((m) => !m.teamBId).map((m) => m.teamAId);
      expect(new Set(byes).size, `n=${n}`).toBe(byes.length);
    }

    const { entries: done, matches } = simulate(8);
    const table = standings(done, matches);
    expect(table[0].wins).toBe(3);
    expect(table.at(-1)!.losses).toBe(3);
  });

  it("S2 · elegibilidad: Barón (Maestro+), Heraldo (Platino II–Diamante), y rechazo por rating, victorias, roster o ELO", () => {
    const five = (tier: "MASTER" | "DIAMOND" | "PLATINUM" | "GOLD", division: number | null, lp = 50) =>
      (["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"] as const).map((position) => ({ position, tier, division, lp }));

    const elite = evaluateEligibility({ rating: 1400, scrimWins: 12, players: five("MASTER", null, 300) });
    expect(elite.division).toBe("ELITE");
    expect(elite.checks.every((c) => c.ok)).toBe(true);

    expect(evaluateEligibility({ rating: 1100, scrimWins: 10, players: five("DIAMOND", 3) }).division).toBe("ASCENSO");
    expect(evaluateEligibility({ rating: 1100, scrimWins: 10, players: five("PLATINUM", 2, 0) }).division).toBe("ASCENSO"); // límite inferior
    const plat3 = evaluateEligibility({ rating: 1100, scrimWins: 10, players: five("PLATINUM", 3, 99) });
    expect(plat3.division).toBeNull();
    expect(plat3.checks.find((c) => c.id === "elo")!.ok).toBe(false);

    const lowRating = evaluateEligibility({ rating: 999, scrimWins: 15, players: five("MASTER", null) });
    expect(lowRating.division).toBeNull();
    expect(lowRating.eloDivision).toBe("ELITE"); // tendría la división por ELO, pero no el rating
    expect(lowRating.checks.find((c) => c.id === "rating")!.detail).toMatch(/faltan 1/);

    expect(evaluateEligibility({ rating: 1500, scrimWins: 9, players: five("MASTER", null) }).division).toBeNull();
    expect(evaluateEligibility({ rating: 1500, scrimWins: 20, players: five("MASTER", null).slice(0, 4) }).division).toBeNull();
    // Los suplentes no cuentan para el promedio
    const withSub = [...five("DIAMOND", 1), { position: "SUB" as const, tier: "GOLD" as const, division: 4, lp: 0 }];
    expect(evaluateEligibility({ rating: 1000, scrimWins: 10, players: withSub }).division).toBe("ASCENSO");
  });
});
