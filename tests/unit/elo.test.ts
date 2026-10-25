import { describe, expect, it } from "vitest";
import { eloDelta, tierFor } from "@/lib/elo";

describe("Unitarias · Elo y divisiones", () => {
  it("U1 · con ratings iguales, ganar todos los juegos suma puntos y perder todos resta lo mismo", () => {
    const win = eloDelta(1200, 1200, 3, 0);
    const loss = eloDelta(1200, 1200, 0, 3);
    expect(win).toBeGreaterThan(0);
    expect(loss).toBe(-win);
    // Un empate exacto entre iguales no mueve el rating
    expect(eloDelta(1200, 1200, 2, 2)).toBe(0);
  });

  it("U2 · vencer a un rival más fuerte vale más que vencer a uno más débil; sin juegos el delta es 0", () => {
    const upset = eloDelta(1100, 1400, 3, 0);
    const expected = eloDelta(1400, 1100, 3, 0);
    expect(upset).toBeGreaterThan(expected);
    expect(eloDelta(1200, 1300, 0, 0)).toBe(0);
    // Más juegos jugados = resultado más significativo
    expect(eloDelta(1200, 1200, 5, 0)).toBeGreaterThan(eloDelta(1200, 1200, 1, 0));
  });

  it("U3 · tierFor asigna la división correcta en los límites", () => {
    expect(tierFor(999).name).toBe("Hierro");
    expect(tierFor(1000).name).toBe("Bronce");
    expect(tierFor(1199).name).toBe("Plata");
    expect(tierFor(1200).name).toBe("Oro");
    expect(tierFor(1500).name).toBe("Diamante");
    expect(tierFor(2400).name).toBe("Retador");
  });
});
