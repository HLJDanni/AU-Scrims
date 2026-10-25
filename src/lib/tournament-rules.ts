// Reglas de acceso a los torneos suizos. Compartido entre cliente y servidor.
import { eloAverage, formatRank, rankValue, type LolTier, type Position } from "./lol";

// Ids internos (BD): ELITE se muestra como "División Barón" y ASCENSO como "División Heraldo"
export type Division = "ELITE" | "ASCENSO";

export const MIN_RATING = 7000;
export const MIN_SCRIM_WINS = 10;
export const MIN_RANKED_STARTERS = 5;
export const MAX_TEAMS = 16;
export const MIN_TEAMS = 4;

const MASTER = rankValue("MASTER", null, 0);
const PLATINUM_II = rankValue("PLATINUM", 2, 0);

export const DIVISIONS: Record<Division, { id: Division; name: string; short: string; range: string; icon: LolTier; color: string; min: number; max: number }> = {
  ELITE: { id: "ELITE", name: "División Barón", short: "Barón", range: "Maestro – Retador", icon: "CHALLENGER", color: "#B57BFF", min: MASTER, max: Infinity },
  ASCENSO: { id: "ASCENSO", name: "División Heraldo", short: "Heraldo", range: "Platino II – Diamante I", icon: "DIAMOND", color: "#0AC8B9", min: PLATINUM_II, max: MASTER },
};

/** División que corresponde a un ELO promedio (escala de rankValue), o null si no entra en ninguna. */
export function divisionForElo(value: number): Division | null {
  if (value >= DIVISIONS.ELITE.min) return "ELITE";
  if (value >= DIVISIONS.ASCENSO.min) return "ASCENSO";
  return null;
}

type PlayerLike = { position: Position; tier: LolTier | null; division: number | null; lp: number };

export type EligibilityCheck = { id: "roster" | "elo" | "rating" | "wins"; label: string; ok: boolean; detail: string };
export type Eligibility = { division: Division | null; eloDivision: Division | null; eloLabel: string | null; checks: EligibilityCheck[] };

/** Evalúa si un equipo puede jugar torneos y en qué división. Deben cumplirse las 4 condiciones. */
export function evaluateEligibility(input: { rating: number; scrimWins: number; players: PlayerLike[] }): Eligibility {
  const rankedStarters = input.players.filter((p) => p.position !== "SUB" && p.tier);
  const avg = rankedStarters.length >= MIN_RANKED_STARTERS ? eloAverage(rankedStarters) : null;
  const eloDivision = avg ? divisionForElo(avg.value) : null;

  const checks: EligibilityCheck[] = [
    {
      id: "roster",
      label: `${MIN_RANKED_STARTERS} titulares con rango`,
      ok: rankedStarters.length >= MIN_RANKED_STARTERS,
      detail: `${rankedStarters.length}/${MIN_RANKED_STARTERS} titulares con rango registrado`,
    },
    {
      id: "elo",
      label: "ELO promedio Platino II o superior",
      ok: eloDivision !== null,
      detail: avg ? `Promedio ${avg.label}${eloDivision ? ` → ${DIVISIONS[eloDivision].name}` : " (por debajo de Platino II)"}` : "Sin promedio: faltan titulares con rango",
    },
    {
      id: "rating",
      label: `${MIN_RATING.toLocaleString("es-MX")} puntos de ranking`,
      ok: input.rating >= MIN_RATING,
      detail: `${input.rating.toLocaleString("es-MX")} pts${input.rating >= MIN_RATING ? "" : ` (faltan ${(MIN_RATING - input.rating).toLocaleString("es-MX")})`}`,
    },
    {
      id: "wins",
      label: `${MIN_SCRIM_WINS} scrims ganados`,
      ok: input.scrimWins >= MIN_SCRIM_WINS,
      detail: `${input.scrimWins} scrims ganados${input.scrimWins >= MIN_SCRIM_WINS ? "" : ` (faltan ${MIN_SCRIM_WINS - input.scrimWins})`}`,
    },
  ];
  return {
    division: checks.every((c) => c.ok) ? eloDivision : null,
    eloDivision,
    eloLabel: avg ? formatRank(avg.tier, avg.division, avg.lp) : null,
    checks,
  };
}
