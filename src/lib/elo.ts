// Rating de equipos (sistema Elo en escala ×5): base 6000, K = 160 y diferencia de referencia 2000.
// Equivale al Elo clásico (base 1200, K 32, 400) multiplicado por 5, por eso se comporta igual.
export const BASE_RATING = 6000;
const K = 160;
const SCALE = 2000;

/** Delta de rating para el equipo A, usando el % de juegos ganados como resultado. */
export function eloDelta(ratingA: number, ratingB: number, winsA: number, winsB: number) {
  const played = winsA + winsB;
  if (played === 0) return 0;
  const expected = 1 / (1 + 10 ** ((ratingB - ratingA) / SCALE));
  const actual = winsA / played;
  // Más juegos jugados = resultado más significativo (hasta x1.5)
  const weight = Math.min(1.5, 0.75 + played * 0.15);
  return Math.round(K * weight * (actual - expected));
}

/** Probabilidad (0-1) que el sistema le da al equipo A de ganar cada juego. */
export function expectedScore(ratingA: number, ratingB: number) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / SCALE));
}

/**
 * Puntos en juego para el equipo A en un scrim de `games` juegos, para cada marcador posible
 * (de ganarlos todos a perderlos todos). Usa la misma fórmula que se aplica al registrar el resultado.
 */
export function pointsAtStake(ratingA: number, ratingB: number, games: number) {
  return Array.from({ length: games + 1 }, (_, i) => {
    const mine = games - i;
    const theirs = i;
    return { mine, theirs, delta: eloDelta(ratingA, ratingB, mine, theirs) };
  });
}

export const TIERS = [
  { min: 9000, name: "Retador", color: "#F4C874", icon: "CHALLENGER" },
  { min: 8500, name: "Gran Maestro", color: "#E84057", icon: "GRANDMASTER" },
  { min: 8000, name: "Maestro", color: "#9D48E0", icon: "MASTER" },
  { min: 7500, name: "Diamante", color: "#576BCE", icon: "DIAMOND" },
  { min: 7000, name: "Esmeralda", color: "#2DD4A8", icon: "EMERALD" },
  { min: 6500, name: "Platino", color: "#4E9996", icon: "PLATINUM" },
  { min: 6000, name: "Oro", color: "#C89B3C", icon: "GOLD" },
  { min: 5500, name: "Plata", color: "#A09B8C", icon: "SILVER" },
  { min: 5000, name: "Bronce", color: "#8C5A3C", icon: "BRONZE" },
  { min: -Infinity, name: "Hierro", color: "#5B5A56", icon: "IRON" },
] as const;

export function tierFor(rating: number) {
  return TIERS.find((t) => rating >= t.min)!;
}
