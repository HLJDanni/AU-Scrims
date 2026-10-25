import { describe, expect, it } from "vitest";
import { BASE_RATING, eloDelta, tierFor } from "@/lib/elo";

describe("Unitarias · Elo y divisiones", () => {
  it("U1 · con ratings iguales, ganar todos los juegos suma puntos y perder todos resta lo mismo", () => {
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
    const upset = eloDelta(5500, 7000, 3, 0);
    const expected = eloDelta(7000, 5500, 3, 0);
    expect(upset).toBeGreaterThan(expected);
    expect(eloDelta(6000, 6500, 0, 0)).toBe(0);
    // Más juegos jugados = resultado más significativo
    expect(eloDelta(6000, 6000, 5, 0)).toBeGreaterThan(eloDelta(6000, 6000, 1, 0));
  });

  it("U3 · tierFor asigna la división correcta en los límites (escala ×5)", () => {
    expect(tierFor(4999).name).toBe("Hierro");
    expect(tierFor(5000).name).toBe("Bronce");
    expect(tierFor(5999).name).toBe("Plata");
    expect(tierFor(6000).name).toBe("Oro");
    expect(tierFor(7000).name).toBe("Esmeralda");
    expect(tierFor(7500).name).toBe("Diamante");
    expect(tierFor(12000).name).toBe("Retador");
  });
});
