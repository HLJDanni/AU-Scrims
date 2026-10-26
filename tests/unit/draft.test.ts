import { describe, expect, it } from "vitest";
import { DRAFT_ORDER, fearlessLocked, phaseLabel, sideChooser, slotOf, splitActions, unavailableReason } from "@/lib/draft";

describe("Unitarias · reglas del draft", () => {
  it("U12 · orden profesional (Mundial): 20 acciones, 5 baneos y 5 picks por lado, en las fases correctas", () => {
    expect(DRAFT_ORDER).toHaveLength(20);
    const code = DRAFT_ORDER.map((s) => `${s.side[0]}${s.kind[0]}`).join(" ");
    // Baneos 1 · Picks 1 · Baneos 2 · Picks 2
    expect(code).toBe("BB RB BB RB BB RB BP RP RP BP BP RP RB BB RB BB RP BP BP RP");
    for (const side of ["BLUE", "RED"] as const)
      for (const kind of ["BAN", "PICK"] as const) expect(DRAFT_ORDER.filter((s) => s.side === side && s.kind === kind)).toHaveLength(5);
    expect(phaseLabel(0)).toBe("Fase de baneos 1");
    expect(phaseLabel(6)).toBe("Fase de selección 1");
    expect(phaseLabel(12)).toBe("Fase de baneos 2");
    expect(phaseLabel(16)).toBe("Fase de selección 2");
    // El 4.º pick del azul (paso 17) va en su slot 3 y el último pick del rojo en su slot 4
    expect(slotOf(17)).toBe(3);
    expect(slotOf(19)).toBe(4);
    const split = splitActions(["Ahri", null, "Zed"]);
    expect(split.BLUE.bans).toEqual(["Ahri", "Zed"]);
    expect(split.RED.bans).toEqual([null]);
  });

  it("U13 · fearless bloquea lo elegido (no lo baneado) en juegos anteriores; el perdedor elige lado", () => {
    const game1 = Array.from({ length: 20 }, (_, i) => `C${i}`); // C0-C5 baneos, C6-C11 picks, ...
    const locked = fearlessLocked([{ actions: game1 }]);
    expect(locked.size).toBe(10);
    expect(locked.has("C6")).toBe(true); // pick
    expect(locked.has("C0")).toBe(false); // baneo: se puede volver a usar
    expect(unavailableReason("C6", [], locked)).toMatch(/fearless/);
    expect(unavailableReason("C0", ["C0"], locked)).toMatch(/Ya fue/);
    expect(unavailableReason("C0", [], locked)).toBeNull();

    expect(sideChooser(1, "invitado")).toBe("invitado");
    expect(sideChooser(2, "invitado", { winnerTeamId: "A", blueTeamId: "A", redTeamId: "B" })).toBe("B");
    expect(sideChooser(3, "invitado", { winnerTeamId: "B", blueTeamId: "A", redTeamId: "B" })).toBe("A");
    expect(sideChooser(2, "invitado", { winnerTeamId: null, blueTeamId: "A", redTeamId: "B" })).toBeNull();
  });
});
