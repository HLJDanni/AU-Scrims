import { describe, expect, it } from "vitest";
import { applyResult, BASE_RATING, eloDelta, expectedScore, pointsAtStake, tierFor } from "@/lib/elo";

describe("Unitarias · Elo y divisiones", () => {
  it("U1 · todos inician en 0; con ratings iguales, ganar todos los juegos suma puntos y perder todos resta lo mismo", () => {
    expect(BASE_RATING).toBe(0);
    const win = eloDelta(BASE_RATING, BASE_RATING, 3, 0);
    const loss = eloDelta(BASE_RATING, BASE_RATING, 0, 3);
    expect(win).toBeGreaterThan(0);
    expect(loss).toBe(-win);
    // Escala ×5: 3-0 entre iguales vale 5 veces lo del Elo clásico (K 32 → 160)
    expect(win).toBe(96);
    // Un empate exacto entre iguales no mueve el rating
    expect(eloDelta(BASE_RATING, BASE_RATING, 2, 2)).toBe(0);
  });

  it("U2 · vencer a un rival más fuerte vale más que vencer a uno más débil; sin juegos el delta es 0", () => {
    const upset = eloDelta(500, 2000, 3, 0);
    const expected = eloDelta(2000, 500, 3, 0);
    expect(upset).toBeGreaterThan(expected);
    expect(eloDelta(1000, 1500, 0, 0)).toBe(0);
    // Más juegos jugados = resultado más significativo
    expect(eloDelta(1000, 1000, 5, 0)).toBeGreaterThan(eloDelta(1000, 1000, 1, 0));
  });

  it("U3 · tierFor asigna la división correcta en los límites (desde 0)", () => {
    expect(tierFor(0).name).toBe("Hierro");
    expect(tierFor(199).name).toBe("Hierro");
    expect(tierFor(200).name).toBe("Bronce");
    expect(tierFor(599).name).toBe("Plata");
    expect(tierFor(600).name).toBe("Oro");
    expect(tierFor(1000).name).toBe("Esmeralda");
    expect(tierFor(1300).name).toBe("Diamante");
    expect(tierFor(5000).name).toBe("Retador");
  });

  it("U10 · puntos en juego: mismos valores que se aplicarán al registrar cada marcador posible", () => {
    // Mismo rating, 3 juegos: 3-0 +96 · 2-1 +32 · 1-2 −32 · 0-3 −96
    expect(pointsAtStake(1000, 1000, 3).map((o) => [`${o.mine}-${o.theirs}`, o.delta])).toEqual([
      ["3-0", 96],
      ["2-1", 32],
      ["1-2", -32],
      ["0-3", -96],
    ]);
    // 400 por encima: el sistema espera ~61 % y ganar vale menos que perder
    expect(Math.round(expectedScore(600, 200) * 100)).toBe(61);
    expect(pointsAtStake(600, 200, 3).map((o) => o.delta)).toEqual([74, 10, -54, -118]);
    expect(pointsAtStake(200, 600, 3).map((o) => o.delta)).toEqual([118, 54, -10, -74]);
    // Coincide con lo que calcula el servidor para cada marcador
    for (const o of pointsAtStake(1150, 980, 5)) expect(o.delta).toBe(eloDelta(1150, 980, o.mine, o.theirs));
    expect(pointsAtStake(1000, 1000, 1)).toHaveLength(2); // Bo1: 1-0 o 0-1
  });

  it("U11 · nadie baja de 0: el perdedor solo pierde los puntos que tiene y el ganador suma completo", () => {
    // Equipos nuevos (0 pts): perder no resta
    expect(pointsAtStake(0, 0, 3).map((o) => o.delta)).toEqual([96, 32, 0, 0]);
    expect(applyResult(0, 0, 3, 0)).toEqual({ deltaA: 96, deltaB: 0 });
    // Con 50 pts, un 0-3 lo deja en 0 (−50) y el rival (0 pts, era el menos favorito) suma completo +99
    expect(applyResult(50, 0, 0, 3)).toEqual({ deltaA: -50, deltaB: 99 });
    // Lejos del piso se comporta como el Elo normal
    expect(applyResult(1000, 1000, 0, 3)).toEqual({ deltaA: -96, deltaB: 96 });
  });
});
