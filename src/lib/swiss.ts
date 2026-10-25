// Motor del formato suizo (estilo Mundial de LoL): 3 victorias clasifican, 3 derrotas eliminan.
// Funciones puras, sin base de datos, para poder probarlas de forma aislada.

export const WINS_TO_QUALIFY = 3;
export const LOSSES_TO_ELIMINATE = 3;
export const MAX_ROUNDS = 9; // tope de seguridad; con 3/3 un equipo juega como máximo 5 rondas

export type SwissEntry = { teamId: string; seed: number; wins: number; losses: number; status: "ALIVE" | "QUALIFIED" | "ELIMINATED" };
export type SwissMatch = { round: number; teamAId: string; teamBId: string | null; winnerId: string | null };
export type Pairing = { teamAId: string; teamBId: string | null; bestOf: number };

/** Estado que corresponde a un récord. */
export function statusFor(wins: number, losses: number): SwissEntry["status"] {
  if (wins >= WINS_TO_QUALIFY) return "QUALIFIED";
  if (losses >= LOSSES_TO_ELIMINATE) return "ELIMINATED";
  return "ALIVE";
}

/** Bo3 cuando alguno de los dos puede clasificar o quedar eliminado con este partido; Bo1 en el resto. */
export function bestOfFor(a: { wins: number; losses: number }, b: { wins: number; losses: number }) {
  const decisive = (e: { wins: number; losses: number }) => e.wins === WINS_TO_QUALIFY - 1 || e.losses === LOSSES_TO_ELIMINATE - 1;
  return decisive(a) || decisive(b) ? 3 : 1;
}

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Buchholz: suma de victorias de los rivales enfrentados (desempate clásico del suizo). */
export function buchholz(teamId: string, entries: SwissEntry[], matches: SwissMatch[]) {
  const wins = new Map(entries.map((e) => [e.teamId, e.wins]));
  return matches.reduce((sum, m) => {
    if (!m.teamBId) return sum;
    if (m.teamAId === teamId) return sum + (wins.get(m.teamBId) ?? 0);
    if (m.teamBId === teamId) return sum + (wins.get(m.teamAId) ?? 0);
    return sum;
  }, 0);
}

/** Tabla de posiciones: victorias, menos derrotas, Buchholz y siembra. */
export function standings(entries: SwissEntry[], matches: SwissMatch[]) {
  return entries
    .map((e) => ({ ...e, buchholz: buchholz(e.teamId, entries, matches) }))
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.buchholz - a.buchholz || a.seed - b.seed);
}

/**
 * Empareja la siguiente ronda.
 *  - Ronda 1: siembra alta contra siembra baja (1 vs n/2+1, 2 vs n/2+2, …).
 *  - Después: mismo récord siempre que se pueda, sin repetir rival.
 *  - Con número impar, el equipo peor ubicado que no haya descansado recibe un descanso (bye = victoria).
 */
export function pairRound(entries: SwissEntry[], matches: SwissMatch[], round: number): Pairing[] {
  const alive = standings(entries.filter((e) => e.status === "ALIVE"), matches);
  if (alive.length === 0) return [];

  const pairings: Pairing[] = [];
  let pool = alive;
  if (pool.length % 2 === 1) {
    const hadBye = new Set(matches.filter((m) => !m.teamBId).map((m) => m.teamAId));
    const byeTeam = [...pool].reverse().find((e) => !hadBye.has(e.teamId)) ?? pool[pool.length - 1];
    pairings.push({ teamAId: byeTeam.teamId, teamBId: null, bestOf: 0 });
    pool = pool.filter((e) => e !== byeTeam);
  }

  if (round === 1) {
    const bySeed = [...pool].sort((a, b) => a.seed - b.seed);
    const half = bySeed.length / 2;
    for (let i = 0; i < half; i++) pairings.push({ teamAId: bySeed[i].teamId, teamBId: bySeed[i + half].teamId, bestOf: 1 });
    return pairings;
  }

  const played = new Set(matches.filter((m) => m.teamBId).map((m) => key(m.teamAId, m.teamBId!)));
  const solve = (list: SwissEntry[], allowRematch: boolean): [SwissEntry, SwissEntry][] | null => {
    if (list.length === 0) return [];
    const [first, ...rest] = list;
    // Preferir rivales con récord más parecido y, a igual récord, el mejor ubicado
    const candidates = rest
      .map((e, i) => ({ e, i, d: Math.abs(e.wins - first.wins) + Math.abs(e.losses - first.losses) }))
      .sort((x, y) => x.d - y.d || x.i - y.i);
    for (const { e } of candidates) {
      if (!allowRematch && played.has(key(first.teamId, e.teamId))) continue;
      const sub = solve(
        rest.filter((x) => x !== e),
        allowRematch,
      );
      if (sub) return [[first, e], ...sub];
    }
    return null;
  };

  const pairs = solve(pool, false) ?? solve(pool, true)!;
  for (const [a, b] of pairs) pairings.push({ teamAId: a.teamId, teamBId: b.teamId, bestOf: bestOfFor(a, b) });
  return pairings;
}
