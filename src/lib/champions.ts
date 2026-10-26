import "server-only";
import { fail } from "./api";

// Lista oficial de campeones desde Data Dragon (CDN público de Riot, no usa la API key).
// Se guarda en memoria unas horas: cambia solo con cada parche.
const DDRAGON = "https://ddragon.leagueoflegends.com";
const TTL_MS = 6 * 3600_000;

export type Champion = { id: string; name: string; tags: string[] };
type ChampionCache = { version: string; list: Champion[]; ids: Set<string>; at: number };
let cache: ChampionCache | null = null;
let loading: Promise<ChampionCache> | null = null;

async function load(): Promise<ChampionCache> {
  const versions = (await (await fetch(`${DDRAGON}/api/versions.json`, { cache: "no-store" })).json()) as string[];
  const version = versions[0];
  const res = await fetch(`${DDRAGON}/cdn/${version}/data/es_MX/champion.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Data Dragon respondió ${res.status}`);
  const json = (await res.json()) as { data: Record<string, { id: string; name: string; tags: string[] }> };
  const list = Object.values(json.data)
    .map((c) => ({ id: c.id, name: c.name, tags: c.tags }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { version, list, ids: new Set(list.map((c) => c.id)), at: Date.now() };
}

export async function getChampions(): Promise<ChampionCache> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  loading ??= load()
    .then((c) => (cache = c))
    .finally(() => (loading = null));
  try {
    return await loading;
  } catch (err) {
    if (cache) return cache; // si Data Dragon falla, se sigue con la última lista conocida
    console.error(err);
    return fail(503, "No se pudo cargar la lista de campeones. Intenta de nuevo en unos segundos.");
  }
}
