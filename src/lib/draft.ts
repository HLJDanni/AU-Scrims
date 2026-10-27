// Reglas del draft (las usan el servidor y la interfaz). Orden profesional del Mundial:
// Baneos 1 (B R B R B R) · Picks 1 (B R R B B R) · Baneos 2 (R B R B) · Picks 2 (R B B R).
export type Side = "BLUE" | "RED";
export type DraftKind = "BAN" | "PICK";
export type DraftStep = { side: Side; kind: DraftKind; phase: 1 | 2 };

const S = (side: Side, kind: DraftKind, phase: 1 | 2): DraftStep => ({ side, kind, phase });

export const DRAFT_ORDER: DraftStep[] = [
  S("BLUE", "BAN", 1), S("RED", "BAN", 1), S("BLUE", "BAN", 1), S("RED", "BAN", 1), S("BLUE", "BAN", 1), S("RED", "BAN", 1),
  S("BLUE", "PICK", 1), S("RED", "PICK", 1), S("RED", "PICK", 1), S("BLUE", "PICK", 1), S("BLUE", "PICK", 1), S("RED", "PICK", 1),
  S("RED", "BAN", 2), S("BLUE", "BAN", 2), S("RED", "BAN", 2), S("BLUE", "BAN", 2),
  S("RED", "PICK", 2), S("BLUE", "PICK", 2), S("BLUE", "PICK", 2), S("RED", "PICK", 2),
];

export const TURN_SECONDS = 30;

/** Acciones registradas: id del campeón o null (baneo omitido). */
export type DraftActions = (string | null)[];

export function phaseLabel(step: number) {
  if (step >= DRAFT_ORDER.length) return "Draft terminado";
  const s = DRAFT_ORDER[step];
  return `${s.kind === "BAN" ? "Fase de baneos" : "Fase de selección"} ${s.phase}`;
}

/** Baneos y picks de cada lado, en el orden en que se hicieron (con su índice global). */
export function splitActions(actions: DraftActions) {
  const out = { BLUE: { bans: [] as (string | null)[], picks: [] as (string | null)[] }, RED: { bans: [] as (string | null)[], picks: [] as (string | null)[] } };
  actions.forEach((champ, i) => {
    const s = DRAFT_ORDER[i];
    if (!s) return;
    (s.kind === "BAN" ? out[s.side].bans : out[s.side].picks).push(champ);
  });
  return out;
}

/** Índice del slot (0-4) que ocupa la acción `step` dentro de los baneos o picks de su lado. */
export function slotOf(step: number) {
  const s = DRAFT_ORDER[step];
  return DRAFT_ORDER.slice(0, step).filter((x) => x.side === s.side && x.kind === s.kind).length;
}

/**
 * Campeones bloqueados por el modo fearless: todo lo que se eligió (no lo baneado) en los juegos
 * terminados de la serie, por cualquiera de los dos equipos.
 */
export function fearlessLocked(previousGames: { actions: DraftActions }[]) {
  const locked = new Set<string>();
  for (const g of previousGames)
    g.actions.forEach((champ, i) => {
      if (champ && DRAFT_ORDER[i]?.kind === "PICK") locked.add(champ);
    });
  return locked;
}

/** Motivo por el que no se puede usar el campeón en esta acción (o null si se puede). */
export function unavailableReason(champ: string, actions: DraftActions, locked: Set<string>) {
  if (actions.includes(champ)) return "Ya fue elegido o baneado en este juego";
  if (locked.has(champ)) return "Bloqueado por fearless: ya se jugó en esta serie";
  return null;
}

/**
 * Quién elige lado en cada juego: en el primero, el equipo invitado al scrim;
 * después, el que perdió el juego anterior (como en las ligas profesionales).
 */
export function sideChooser(gameNumber: number, invitedTeamId: string, previous?: { winnerTeamId: string | null; blueTeamId: string; redTeamId: string }) {
  if (gameNumber === 1 || !previous) return invitedTeamId;
  if (!previous.winnerTeamId) return null; // falta registrar quién ganó
  return previous.winnerTeamId === previous.blueTeamId ? previous.redTeamId : previous.blueTeamId;
}

/** Mínimo de campeones (de 10) que deben coincidir entre el draft y la partida para aceptar el Game ID. */
export const MIN_MATCHING_CHAMPIONS = 6;

/**
 * Compara los picks del draft con los campeones de la partida de Riot (100 = azul, 200 = rojo).
 * Detecta si los equipos jugaron con los lados cambiados en el lobby y cuántos campeones coinciden.
 */
export function matchSides(draft: { blue: (string | null)[]; red: (string | null)[] }, game: { 100: string[]; 200: string[] }) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const overlap = (picks: (string | null)[], champs: string[]) => {
    const set = new Set(champs.map(norm));
    return picks.filter((c): c is string => Boolean(c) && set.has(norm(c!))).length;
  };
  const straight = overlap(draft.blue, game[100]) + overlap(draft.red, game[200]);
  const swapped = overlap(draft.blue, game[200]) + overlap(draft.red, game[100]);
  return { swapped: swapped > straight, matched: Math.max(straight, swapped) };
}

export type DraftGameDTO = {
  number: number;
  status: "READY_CHECK" | "DRAFTING" | "DONE";
  blueTeamId: string;
  redTeamId: string;
  sideChosenBy: string;
  blueReady: boolean;
  redReady: boolean;
  actions: DraftActions;
  step: number;
  hover: string | null;
  turnEndsAt: string | null;
  winnerTeamId: string | null;
  matchId: string | null;
  resetRequestedBy: string | null; // equipo que pidió reiniciar este draft (falta que el otro acepte)
};

export type DraftTeam = { id: string; name: string; tag: string; color: string; logoUpdatedAt: string | null };

export type DraftStateDTO = {
  scrim: { id: string; games: number; status: string; startAt: string };
  myTeam: DraftTeam;
  rival: DraftTeam;
  settings: { fearless: boolean; timer: boolean; editable: boolean };
  games: DraftGameDTO[];
  /** Próximo juego por crear (elección de lado), o null si la serie ya tiene todos sus juegos. */
  next: { number: number; chooserTeamId: string | null } | null;
  canAct: boolean;
  /** Hay RIOT_API_KEY: el ganador se verifica pegando el Game ID. */
  riotMatch: boolean;
  serverTime: string;
};
