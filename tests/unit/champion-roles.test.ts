// Unitaria: el filtro del draft usa la posición del campeón, no su clase de Data Dragon.
import { describe, expect, it } from "vitest";
import { LANES, rolesFor } from "@/lib/champion-roles";

describe("Unitaria · roles de campeones", () => {
  it("U15 · cada campeón tiene al menos una posición válida; los nuevos se asignan por su clase", () => {
    expect(rolesFor("Jinx", ["Marksman"])).toEqual(["BOTTOM"]);
    expect(rolesFor("LeeSin", ["Fighter", "Assassin"])).toEqual(["JUNGLE"]);
    expect(rolesFor("Thresh", ["Support", "Tank"])).toEqual(["UTILITY"]);
    expect(rolesFor("Gragas", ["Fighter", "Mage"])).toEqual(expect.arrayContaining(["JUNGLE", "TOP", "UTILITY"]));
    // Un campeón que todavía no está en la tabla
    expect(rolesFor("CampeonNuevo", ["Marksman", "Mage"])).toEqual(["BOTTOM"]);
    expect(rolesFor("CampeonNuevo", ["Tank"])).toEqual(["TOP"]);
    expect(rolesFor("CampeonNuevo", [])).toEqual(["MIDDLE"]);
    for (const lane of rolesFor("Pantheon", ["Fighter"])) expect(LANES).toContain(lane);
  });
});
