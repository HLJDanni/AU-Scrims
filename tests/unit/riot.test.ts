// Cliente de la API de Riot con fetch simulado: no consume cuota ni necesita una clave real.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RiotError, fetchRankedProfile, fetchRecentRankedMatches } from "@/lib/riot";

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

  it("U9 · partidas de SoloQ para el KDA: solo descarga las nuevas, con tope por sincronización y enrutamiento regional", async () => {
    const ids = ["LA1_9", "LA1_8", "LA1_7", "LA1_6", "LA1_5", "LA1_4", "LA1_3"];
    const match = (id: string, k: number) => ({
      metadata: { matchId: id },
      info: { gameEndTimestamp: 1_790_000_000_000, gameCreation: 1, participants: [{ puuid: "OTRO", kills: 0, deaths: 0, assists: 0, win: false }, { puuid: "PUUID-1", kills: k, deaths: 2, assists: 7, win: true }] },
    });
    const calls = mockRiot([
      { match: /\/matches\/by-puuid\/PUUID-1\/ids\?queue=420&type=ranked/, body: ids },
      ...ids.map((id, i) => ({ match: new RegExp(`/matches/${id}$`), body: match(id, i) })),
    ]);
    const out = await fetchRecentRankedMatches("LAN", "PUUID-1", new Set(["LA1_9", "LA1_8"]), { maxNew: 3 });
    expect(out.map((m) => m.matchId)).toEqual(["LA1_7", "LA1_6", "LA1_5"]); // salta las conocidas y respeta el tope
    expect(out[0]).toMatchObject({ kills: 2, deaths: 2, assists: 7, win: true }); // toma al jugador correcto
    expect(out[0].playedAt).toBeInstanceOf(Date);
    expect(calls.every((c) => c.url.startsWith("https://americas.api.riotgames.com/lol/match/v5/"))).toBe(true);
    expect(calls).toHaveLength(4); // 1 lista + 3 detalles

    mockRiot([{ match: /ids/, body: [] }]);
    const sea = await fetchRecentRankedMatches("OCE", "PUUID-1", new Set());
    expect(sea).toEqual([]);
  });
});
