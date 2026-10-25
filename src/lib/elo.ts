const K = 32;

/** Delta de rating para el equipo A, usando el % de juegos ganados como resultado. */
export function eloDelta(ratingA: number, ratingB: number, winsA: number, winsB: number) {
  const played = winsA + winsB;
  if (played === 0) return 0;
  const expected = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
  const actual = winsA / played;
  // Más juegos jugados = resultado más significativo (hasta x1.5)
  const weight = Math.min(1.5, 0.75 + played * 0.15);
  return Math.round(K * weight * (actual - expected));
}

export const TIERS = [
  { min: 1800, name: "Retador", color: "#F4C874" },
  { min: 1700, name: "Gran Maestro", color: "#E84057" },
  { min: 1600, name: "Maestro", color: "#9D48E0" },
  { min: 1500, name: "Diamante", color: "#576BCE" },
  { min: 1400, name: "Esmeralda", color: "#2DD4A8" },
  { min: 1300, name: "Platino", color: "#4E9996" },
  { min: 1200, name: "Oro", color: "#C89B3C" },
  { min: 1100, name: "Plata", color: "#A09B8C" },
  { min: 1000, name: "Bronce", color: "#8C5A3C" },
  { min: -Infinity, name: "Hierro", color: "#5B5A56" },
] as const;

export function tierFor(rating: number) {
  return TIERS.find((t) => rating >= t.min)!;
}
