import "server-only";
import type { LolTier } from "./lol";

// Cliente mínimo de la API oficial de Riot Games (la misma fuente de datos que usa op.gg).
// La clave vive solo en el servidor: variable de entorno RIOT_API_KEY.

const PLATFORM: Record<string, string> = { LAN: "la1", LAS: "la2", NA: "na1", BR: "br1", EUW: "euw1", EUNE: "eun1", KR: "kr", OCE: "oc1" };
// ACCOUNT-V1 es global; se usa el clúster más cercano a la región
const REGIONAL: Record<string, string> = { LAN: "americas", LAS: "americas", NA: "americas", BR: "americas", OCE: "americas", EUW: "europe", EUNE: "europe", KR: "asia" };
const DIVISION: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 };
const APEX = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

export class RiotError extends Error {
  constructor(
    public kind: "not_found" | "auth" | "rate_limit" | "unavailable",
    message: string,
  ) {
    super(message);
  }
}

export const riotEnabled = () => Boolean(process.env.RIOT_API_KEY?.trim());

async function call<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "X-Riot-Token": process.env.RIOT_API_KEY!.trim() },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new RiotError("unavailable", "No se pudo conectar con la API de Riot");
  }
  if (res.ok) return (await res.json()) as T;
  if (res.status === 404) throw new RiotError("not_found", "No existe una cuenta de Riot con ese Riot ID");
  if (res.status === 401 || res.status === 403)
    throw new RiotError("auth", "La API key de Riot no es válida o venció (las Development keys duran 24 h)");
  if (res.status === 429) throw new RiotError("rate_limit", "Se alcanzó el límite de consultas a Riot, intenta en unos segundos");
  throw new RiotError("unavailable", `La API de Riot respondió con error ${res.status}`);
}

type Account = { puuid: string; gameName: string; tagLine: string };
type Summoner = { summonerLevel: number };
type LeagueEntry = { queueType: string; tier: string; rank: string; leaguePoints: number; wins: number; losses: number };

export type RankedProfile = {
  puuid: string;
  gameName: string;
  tagLine: string;
  summonerLevel: number | null;
  tier: LolTier | null;
  division: number | null;
  lp: number;
  wins: number | null;
  losses: number | null;
};

/** Cuenta, nivel y rango de SoloQ actual de un Riot ID. */
export async function fetchRankedProfile(region: string, gameName: string, tagLine: string): Promise<RankedProfile> {
  if (!riotEnabled()) throw new RiotError("auth", "Falta configurar RIOT_API_KEY");
  const platform = PLATFORM[region];
  const regional = REGIONAL[region];
  if (!platform || !regional) throw new RiotError("unavailable", `Región ${region} no soportada por la API de Riot`);

  const account = await call<Account>(
    `https://${regional}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
  );
  const [summoner, entries] = await Promise.all([
    call<Summoner>(`https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${account.puuid}`).catch((e) => {
      // Si la cuenta nunca jugó en este servidor, no tiene invocador allí
      if (e instanceof RiotError && e.kind === "not_found") return null;
      throw e;
    }),
    call<LeagueEntry[]>(`https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}`).catch((e) => {
      if (e instanceof RiotError && e.kind === "not_found") return [];
      throw e;
    }),
  ]);
  if (!summoner) throw new RiotError("not_found", `La cuenta existe pero no tiene perfil en el servidor ${region}`);

  const solo = entries.find((e) => e.queueType === "RANKED_SOLO_5x5");
  const tier = (solo?.tier as LolTier | undefined) ?? null;
  return {
    puuid: account.puuid,
    gameName: account.gameName,
    tagLine: account.tagLine,
    summonerLevel: summoner.summonerLevel ?? null,
    tier,
    division: solo && !APEX.has(solo.tier) ? (DIVISION[solo.rank] ?? 4) : null,
    lp: solo?.leaguePoints ?? 0,
    wins: solo?.wins ?? null,
    losses: solo?.losses ?? null,
  };
}

/** Traduce un error de Riot a un código HTTP para nuestra API. */
export function riotHttpStatus(e: RiotError) {
  return { not_found: 422, auth: 503, rate_limit: 429, unavailable: 502 }[e.kind];
}

// MATCH-V5 usa clústeres regionales (OCE va a "sea")
const MATCH_REGIONAL: Record<string, string> = { LAN: "americas", LAS: "americas", NA: "americas", BR: "americas", OCE: "sea", EUW: "europe", EUNE: "europe", KR: "asia" };
const RANKED_SOLO_QUEUE = 420;

export type RankedMatch = { matchId: string; kills: number; deaths: number; assists: number; win: boolean; playedAt: Date };

type MatchDTO = {
  metadata: { matchId: string };
  info: { gameEndTimestamp?: number; gameCreation: number; participants: { puuid: string; kills: number; deaths: number; assists: number; win: boolean }[] };
};

/**
 * Partidas recientes de SoloQ de un jugador. Solo descarga el detalle de las que aún no conocemos
 * (`known`) y como máximo `maxNew` por llamada, para cuidar el límite de la API.
 */
export async function fetchRecentRankedMatches(region: string, puuid: string, known: Set<string>, { count = 20, maxNew = 5 } = {}): Promise<RankedMatch[]> {
  if (!riotEnabled()) throw new RiotError("auth", "Falta configurar RIOT_API_KEY");
  const regional = MATCH_REGIONAL[region];
  if (!regional) throw new RiotError("unavailable", `Región ${region} no soportada por la API de Riot`);
  const ids = await call<string[]>(
    `https://${regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=${RANKED_SOLO_QUEUE}&type=ranked&start=0&count=${count}`,
  );
  const pending = ids.filter((id) => !known.has(id)).slice(0, maxNew);
  const out: RankedMatch[] = [];
  for (const id of pending) {
    const m = await call<MatchDTO>(`https://${regional}.api.riotgames.com/lol/match/v5/matches/${id}`);
    const p = m.info.participants.find((x) => x.puuid === puuid);
    if (!p) continue;
    out.push({ matchId: m.metadata.matchId, kills: p.kills, deaths: p.deaths, assists: p.assists, win: p.win, playedAt: new Date(m.info.gameEndTimestamp ?? m.info.gameCreation) });
  }
  return out;
}
