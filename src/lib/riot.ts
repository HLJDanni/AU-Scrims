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

async function call<T>(url: string, notFound = "No existe una cuenta de Riot con ese Riot ID"): Promise<T> {
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
  if (res.status === 404) throw new RiotError("not_found", notFound);
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

// ---------- MATCH-V5: resultado de una partida por su Game ID ----------
// Enrutamiento regional de match-v5 (OCE usa "sea", distinto de account-v1)
const MATCH_REGIONAL: Record<string, string> = { LA1: "americas", LA2: "americas", NA1: "americas", BR1: "americas", EUW1: "europe", EUN1: "europe", KR: "asia", OC1: "sea" };
export const MATCH_PLATFORM: Record<string, string> = Object.fromEntries(Object.entries(PLATFORM).map(([region, p]) => [region, p.toUpperCase()]));

/**
 * Normaliza lo que pega el usuario: "LA1_1234567890", "la1-1234567890" o solo el número (se usa el servidor del equipo).
 * Devuelve el ID de match-v5 o null si no tiene forma de Game ID.
 */
export function parseGameId(input: string, region: string) {
  const m = /^(?:([A-Za-z]{2,4}\d?)[_\s-]?)?(\d{6,13})$/.exec(input.trim());
  if (!m) return null;
  const platform = (m[1] ?? MATCH_PLATFORM[region] ?? "").toUpperCase();
  if (!MATCH_REGIONAL[platform]) return null;
  return `${platform}_${m[2]}`;
}

export type MatchResult = {
  matchId: string;
  startedAt: Date;
  durationSec: number;
  queueId: number;
  winnerSide: 100 | 200;
  champions: { 100: string[]; 200: string[] };
};

export async function fetchMatchResult(matchId: string): Promise<MatchResult> {
  if (!riotEnabled()) throw new RiotError("auth", "Falta configurar RIOT_API_KEY");
  const platform = matchId.split("_")[0];
  type Match = {
    info: {
      gameStartTimestamp: number;
      gameDuration: number;
      queueId: number;
      teams: { teamId: 100 | 200; win: boolean }[];
      participants: { teamId: 100 | 200; championName: string }[];
    };
  };
  const m = await call<Match>(
    `https://${MATCH_REGIONAL[platform]}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
    `Riot no encontró la partida ${matchId}. Revisa el número y el servidor; una partida recién terminada puede tardar unos minutos en aparecer.`,
  );
  const winner = m.info.teams.find((t) => t.win)?.teamId;
  if (!winner) throw new RiotError("not_found", "La partida no tiene un ganador registrado (¿se canceló o hubo remake?)");
  const champions = { 100: [] as string[], 200: [] as string[] };
  for (const p of m.info.participants) champions[p.teamId]?.push(p.championName);
  return { matchId, startedAt: new Date(m.info.gameStartTimestamp), durationSec: m.info.gameDuration, queueId: m.info.queueId, winnerSide: winner, champions };
}

/** Traduce un error de Riot a un código HTTP para nuestra API. */
export function riotHttpStatus(e: RiotError) {
  return { not_found: 422, auth: 503, rate_limit: 429, unavailable: 502 }[e.kind];
}
