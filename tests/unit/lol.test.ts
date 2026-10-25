import { describe, expect, it } from "vitest";
import { eloAverage, formatRank, opggUrl, parseRiotId, rankFromValue, rankValue } from "@/lib/lol";

describe("Unitarias · rangos de LoL", () => {
  it("U6 · ELO promedio usa a los titulares, convierte bien entre escala y rango, y parsea el Riot ID", () => {
    // Escala continua y su inverso
    expect(rankValue("IRON", 4, 0)).toBe(0);
    expect(rankValue("GOLD", 1, 50)).toBe(3 * 400 + 300 + 50);
    expect(rankFromValue(rankValue("DIAMOND", 2, 40))).toEqual({ tier: "DIAMOND", division: 2, lp: 40 });
    expect(rankFromValue(rankValue("MASTER", null, 250)).tier).toBe("MASTER");
    expect(formatRank("EMERALD", 3, 10)).toBe("Esmeralda III");
    expect(formatRank(null)).toBe("Sin rango");

    // Promedio: Diamante IV y Esmeralda IV → Esmeralda I; el suplente Hierro se ignora
    const avg = eloAverage([
      { position: "TOP", tier: "DIAMOND", division: 4, lp: 0 },
      { position: "MID", tier: "EMERALD", division: 4, lp: 0 },
      { position: "SUB", tier: "IRON", division: 4, lp: 0 },
      { position: "ADC", tier: null, division: null, lp: 0 },
    ]);
    expect(avg).toMatchObject({ tier: "EMERALD", division: 2, count: 2 });
    expect(eloAverage([])).toBeNull();

    // Riot ID
    expect(parseRiotId("ArcaneMid#lan")).toEqual({ gameName: "ArcaneMid", tagLine: "LAN" });
    expect(parseRiotId("Sin Tag")).toBeNull();
    expect(parseRiotId("ab#LAN")).toBeNull(); // nombre muy corto
    expect(opggUrl("LAN", "Arcane Mid", "LAN")).toBe("https://www.op.gg/summoners/lan/Arcane%20Mid-LAN");
  });
});
