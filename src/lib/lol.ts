// Rangos de SoloQ, posiciones y utilidades de Riot ID. Compartido entre cliente y servidor.

export type LolTier =
  | "IRON"
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "EMERALD"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER"
  | "CHALLENGER";
export type Position = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT" | "SUB";

export const LOL_TIERS: { id: LolTier; label: string; color: string; divisions: boolean }[] = [
  { id: "IRON", label: "Hierro", color: "#5B5A56", divisions: true },
  { id: "BRONZE", label: "Bronce", color: "#8C5A3C", divisions: true },
  { id: "SILVER", label: "Plata", color: "#A09B8C", divisions: true },
  { id: "GOLD", label: "Oro", color: "#C89B3C", divisions: true },
  { id: "PLATINUM", label: "Platino", color: "#4E9996", divisions: true },
  { id: "EMERALD", label: "Esmeralda", color: "#2DD4A8", divisions: true },
  { id: "DIAMOND", label: "Diamante", color: "#576BCE", divisions: true },
  { id: "MASTER", label: "Maestro", color: "#9D48E0", divisions: false },
  { id: "GRANDMASTER", label: "Gran Maestro", color: "#E84057", divisions: false },
  { id: "CHALLENGER", label: "Retador", color: "#F4C874", divisions: false },
];

export const POSITIONS: { id: Position; label: string; short: string }[] = [
  { id: "TOP", label: "Top", short: "TOP" },
  { id: "JUNGLE", label: "Jungla", short: "JG" },
  { id: "MID", label: "Mid", short: "MID" },
  { id: "ADC", label: "ADC", short: "ADC" },
  { id: "SUPPORT", label: "Support", short: "SUP" },
  { id: "SUB", label: "Suplente", short: "SUB" },
];

const ROMAN = ["", "I", "II", "III", "IV"];
const MASTER_BASE = 7 * 400; // Hierro IV = 0, cada división 100 LP, cada liga 400

export const tierMeta = (t: LolTier) => LOL_TIERS.find((x) => x.id === t)!;

/** Convierte un rango a una escala numérica continua para poder promediar. */
export function rankValue(tier: LolTier, division: number | null | undefined, lp: number) {
  const idx = LOL_TIERS.findIndex((t) => t.id === tier);
  if (idx >= 7) return MASTER_BASE + Math.max(0, lp); // Maestro+ sin divisiones, LP acumulados
  const div = Math.min(4, Math.max(1, division ?? 4));
  return idx * 400 + (4 - div) * 100 + Math.min(99, Math.max(0, lp));
}

/** Inverso de rankValue: devuelve la liga y división aproximadas. */
export function rankFromValue(value: number): { tier: LolTier; division: number | null; lp: number } {
  if (value >= MASTER_BASE) {
    const lp = Math.round(value - MASTER_BASE);
    // Umbrales aproximados de LP para GM y Retador
    const tier: LolTier = lp >= 1000 ? "CHALLENGER" : lp >= 500 ? "GRANDMASTER" : "MASTER";
    return { tier, division: null, lp };
  }
  const v = Math.max(0, value);
  const idx = Math.floor(v / 400);
  const inTier = v - idx * 400;
  const division = 4 - Math.floor(inTier / 100);
  return { tier: LOL_TIERS[idx].id, division, lp: Math.round(inTier % 100) };
}

export function formatRank(tier: LolTier | null | undefined, division?: number | null, lp?: number) {
  if (!tier) return "Sin rango";
  const m = tierMeta(tier);
  return m.divisions ? `${m.label} ${ROMAN[division ?? 4]}` : `${m.label} · ${lp ?? 0} LP`;
}

type RankedLike = { tier: LolTier | null; division: number | null; lp: number; position: Position };

/** ELO promedio: usa a los titulares con rango; si no hay, a todos los jugadores con rango. */
export function eloAverage(players: RankedLike[]) {
  const ranked = players.filter((p) => p.tier);
  const starters = ranked.filter((p) => p.position !== "SUB");
  const pool = starters.length ? starters : ranked;
  if (!pool.length) return null;
  const avg = pool.reduce((a, p) => a + rankValue(p.tier!, p.division, p.lp), 0) / pool.length;
  const r = rankFromValue(avg);
  return { ...r, value: Math.round(avg), label: formatRank(r.tier, r.division, r.lp), color: tierMeta(r.tier).color, count: pool.length };
}

/** "Nombre#TAG" → partes. Devuelve null si no tiene el formato de Riot ID. */
export function parseRiotId(input: string) {
  const m = input.trim().match(/^(.{3,16})#([A-Za-z0-9]{2,5})$/u);
  if (!m) return null;
  return { gameName: m[1].trim(), tagLine: m[2].toUpperCase() };
}

const OPGG_REGION: Record<string, string> = { LAN: "lan", LAS: "las", NA: "na", BR: "br", EUW: "euw", EUNE: "eune", KR: "kr", OCE: "oce" };

export function opggUrl(region: string, gameName: string, tagLine: string) {
  return `https://www.op.gg/summoners/${OPGG_REGION[region] ?? "lan"}/${encodeURIComponent(`${gameName}-${tagLine}`)}`;
}
