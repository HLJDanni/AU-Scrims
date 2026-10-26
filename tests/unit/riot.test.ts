// Cliente de la API de Riot con fetch simulado: no consume cuota ni necesita una clave real.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RiotError, fetchMatchResult, fetchRankedProfile, parseGameId } from "@/lib/riot";
import { matchSides } from "@/lib/draft";

type Route = { match: RegExp; status?: number; body?: unknown };

function mockRiot(routes: Route[]) {
  const calls: { url: string; token: string | null }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, token: new Headers(init?.headers).get("X-Riot-Token") });
      const r = routes.find((x) => x.match.test(url));
      if (!r) return new Response("not mocked", { status: 500 });
      return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200 });
    }),
  );
  return calls;
}

const account = { match: /\/riot\/account\/v1\/accounts\/by-riot-id\//, body: { puuid: "PUUID-1", gameName: "Arcane Mid", tagLine: "LAN" } };
const summoner = { match: /\/lol\/summoner\/v4\/summoners\/by-puuid\/PUUID-1$/, body: { summonerLevel: 312 } };

beforeEach(() => vi.stubEnv("RIOT_API_KEY", "RGAPI-test"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Unitarias · cliente de la API de Riot", () => {
  it("U8 · trae rango de SoloQ desde Riot, enruta por región y traduce los errores", async () => {
    // Rango con división: Oro II, 45 LP; ignora la cola flex
    const calls = mockRiot([
      account,
      summoner,
      {
        match: /\/lol\/league\/v4\/entries\/by-puuid\/PUUID-1$/,
        body: [
          { queueType: "RANKED_FLEX_SR", tier: "DIAMOND", rank: "I", leaguePoints: 10, wins: 5, losses: 1 },
          { queueType: "RANKED_SOLO_5x5", tier: "GOLD", rank: "II", leaguePoints: 45, wins: 60, losses: 50 },
        ],
      },
    ]);
    const gold = await fetchRankedProfile("LAN", "arcane mid", "lan");
    expect(gold).toEqual({
      puuid: "PUUID-1",
      gameName: "Arcane Mid", // devuelve el nombre con las mayúsculas reales
      tagLine: "LAN",
      summonerLevel: 312,
      tier: "GOLD",
      division: 2,
      lp: 45,
      wins: 60,
      losses: 50,
    });
    expect(calls[0].url).toBe("https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/arcane%20mid/lan");
    expect(calls.slice(1).every((c) => c.url.startsWith("https://la1.api.riotgames.com/"))).toBe(true);
    expect(calls.every((c) => c.token === "RGAPI-test")).toBe(true);

    // Maestro+ no tiene división; sin entradas = sin rango
    mockRiot([account, summoner, { match: /entries/, body: [{ queueType: "RANKED_SOLO_5x5", tier: "MASTER", rank: "I", leaguePoints: 210, wins: 200, losses: 150 }] }]);
    expect(await fetchRankedProfile("LAS", "Arcane Mid", "LAN")).toMatchObject({ tier: "MASTER", division: null, lp: 210 });
    mockRiot([account, summoner, { match: /entries/, body: [] }]);
    expect(await fetchRankedProfile("LAN", "Arcane Mid", "LAN")).toMatchObject({ tier: null, division: null, lp: 0, wins: null });

    // Errores
    const err = async (routes: Route[]) => {
      mockRiot(routes);
      return fetchRankedProfile("EUW", "X", "Y").catch((e: RiotError) => e.kind);
    };
    expect(await err([{ match: /account/, status: 404 }])).toBe("not_found");
    expect(await err([{ match: /account/, status: 403 }])).toBe("auth");
    expect(await err([{ match: /account/, status: 429 }])).toBe("rate_limit");
    expect(await err([account, { match: /summoner/, status: 404 }, { match: /entries/, body: [] }])).toBe("not_found"); // sin perfil en ese servidor
    vi.stubEnv("RIOT_API_KEY", "");
    expect(await err([account])).toBe("auth");
  });

  it("U14 · Game ID: acepta el formato del cliente, consulta match-v5 en el clúster correcto y detecta lados cambiados", async () => {
    expect(parseGameId("LA1_1234567890", "LAN")).toBe("LA1_1234567890");
    expect(parseGameId(" 1234567890 ", "LAN")).toBe("LA1_1234567890"); // solo el número: servidor del equipo
    expect(parseGameId("kr-8421752997", "LAN")).toBe("KR_8421752997");
    expect(parseGameId("8421752997", "OCE")).toBe("OC1_8421752997");
    expect(parseGameId("XX9_123456789", "LAN")).toBeNull(); // servidor desconocido
    expect(parseGameId("https://op.gg/algo", "LAN")).toBeNull();

    const match = {
      info: {
        gameStartTimestamp: 1_790_000_000_000,
        gameDuration: 1800,
        queueId: 0,
        teams: [
          { teamId: 100, win: false },
          { teamId: 200, win: true },
        ],
        participants: ["Aatrox", "LeeSin", "Ahri", "Jinx", "Thresh"]
          .map((championName) => ({ teamId: 100, championName }))
          .concat(["Gnar", "Vi", "Orianna", "Kaisa", "Nautilus"].map((championName) => ({ teamId: 200, championName }))),
      },
    };
    const calls = mockRiot([{ match: /^https:\/\/sea\.api\.riotgames\.com\/lol\/match\/v5\/matches\/OC1_42$/, body: match }]);
    const r = await fetchMatchResult("OC1_42");
    expect(calls[0].url).toMatch(/^https:\/\/sea\./); // OCE usa "sea" en match-v5
    expect(r).toMatchObject({ winnerSide: 200, durationSec: 1800 });
    expect(r.champions[200]).toContain("Kaisa");

    // Draft con los lados al revés: el "azul" del draft jugó en el lado 200 y ganó
    const sides = matchSides({ blue: ["Gnar", "Vi", "Orianna", "Kaisa", "Nautilus"], red: ["Aatrox", "LeeSin", "Ahri", "Jinx", "Thresh"] }, r.champions);
    expect(sides).toEqual({ swapped: true, matched: 10 });
    expect(matchSides({ blue: ["Aatrox", "Zed", null], red: ["Gnar"] }, r.champions)).toEqual({ swapped: false, matched: 2 });

    mockRiot([{ match: /match\/v5/, status: 404 }]);
    await expect(fetchMatchResult("LA1_1")).rejects.toThrow(/no encontró la partida LA1_1/);
  });
});
