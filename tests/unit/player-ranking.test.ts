import { describe, expect, it } from "vitest";
import { MIN_GAMES, kdaOf, rankPlayers, type RankingInput } from "@/lib/player-ranking";

const team = { id: "t1", name: "Equipo", tag: "EQ", color: "#C8AA6E" };
const day = (n: number) => new Date(Date.UTC(2026, 9, 1 + n));
const player = (id: string, position: RankingInput["position"], wins: number, losses: number, extra: Partial<RankingInput> = {}): RankingInput => ({
  id,
  gameName: `P${id}`,
  tagLine: "LAN",
  position,
  team,
  wins,
  losses,
  matches: [],
  snapshots: [],
  ...extra,
});

describe("Unitarias · ranking de jugadores", () => {
  it("P1 · ordena por win rate con mínimo de partidas, filtra por rol, calcula KDA reciente y la evolución", () => {
    const rows = [
      player("a", "MID", 60, 40), // 60 %
      player("b", "ADC", 70, 30), // 70 %
      player("c", "MID", 3, 0), // 100 % pero solo 3 partidas → fuera
      player("d", "TOP", 55, 45, { snapshots: [{ takenAt: day(0), wins: 20, losses: 20 }, { takenAt: day(7), wins: 40, losses: 35 }] }),
      player("e", "MID", 120, 80), // 60 % con más partidas que "a" → va antes
    ];
    const all = rankPlayers(rows);
    expect(all.map((p) => p.id)).toEqual(["b", "e", "a", "d"]);
    expect(all.map((p) => p.rank)).toEqual([1, 2, 3, 4]);
    expect(all.every((p) => p.games >= MIN_GAMES)).toBe(true);

    expect(rankPlayers(rows, { position: "MID" }).map((p) => p.id)).toEqual(["e", "a"]);
    expect(rankPlayers(rows, { limit: 2 })).toHaveLength(2);

    // Evolución: 50 % → 53,3 % → 55 % (actual) = +5 pts
    const d = all.find((p) => p.id === "d")!;
    expect(d.trend).toEqual([50, 53.3, 55]);
    expect(d.delta).toBe(5);
    expect(all.find((p) => p.id === "a")!.delta).toBeNull(); // sin historial

    // KDA: (K + A) / max(1, D) con las 20 partidas más recientes
    const m = (k: number, de: number, a: number, n: number) => ({ kills: k, deaths: de, assists: a, playedAt: day(n) });
    expect(kdaOf([m(10, 2, 8, 1), m(2, 4, 6, 2)])).toEqual({ kda: 4.3, avg: { kills: 6, deaths: 3, assists: 7 } });
    expect(kdaOf([m(5, 0, 5, 1)]).kda).toBe(10); // sin muertes no divide por 0
    expect(kdaOf([]).kda).toBeNull();
    const many = Array.from({ length: 25 }, (_, i) => m(i < 5 ? 100 : 1, 1, 1, i < 5 ? 0 : i)); // las 5 más viejas no cuentan
    expect(kdaOf(many).kda).toBe(2);
  });
});
