import "server-only";
import type { DraftGame, Prisma } from "@prisma/client";
import { db } from "./db";
import { fail } from "./api";
import { chatWritable, systemMessage } from "./chat";
import { getChampions } from "./champions";
import { RiotError, fetchMatchResult, parseGameId, riotEnabled, riotHttpStatus } from "./riot";
import {
  DRAFT_ORDER,
  TURN_SECONDS,
  MIN_MATCHING_CHAMPIONS,
  fearlessLocked,
  matchSides,
  sideChooser,
  splitActions,
  unavailableReason,
  type DraftActions,
  type DraftGameDTO,
  type DraftStateDTO,
} from "./draft";
import type { loadChatScrim } from "./chat";

type ChatScrim = Awaited<ReturnType<typeof loadChatScrim>>;

const actionsOf = (g: Pick<DraftGame, "actions">) => (Array.isArray(g.actions) ? (g.actions as DraftActions) : []);
const turnEnd = (timer: boolean) => (timer ? new Date(Date.now() + TURN_SECONDS * 1000) : null);
// Margen para la latencia: el servidor resuelve el turno un poco después de que el reloj llega a 0
const GRACE_MS = 1500;

export function toGameDTO(g: DraftGame): DraftGameDTO {
  return {
    number: g.number,
    status: g.status,
    blueTeamId: g.blueTeamId,
    redTeamId: g.redTeamId,
    sideChosenBy: g.sideChosenBy,
    blueReady: g.blueReady,
    redReady: g.redReady,
    actions: actionsOf(g),
    step: g.step,
    hover: g.hover,
    turnEndsAt: g.turnEndsAt?.toISOString() ?? null,
    winnerTeamId: g.winnerTeamId,
    matchId: g.matchId,
  };
}

export const loadGames = (scrimId: string) => db.draftGame.findMany({ where: { scrimId }, orderBy: { number: "asc" } });

/** Campeones bloqueados por fearless para el juego `number` (picks de los juegos anteriores). */
function lockedFor(scrim: ChatScrim, games: DraftGame[], number: number) {
  if (!scrim.draftFearless) return new Set<string>();
  return fearlessLocked(games.filter((g) => g.number < number).map((g) => ({ actions: actionsOf(g) })));
}

const tagOf = (scrim: ChatScrim, teamId: string) => (teamId === scrim.requesterTeamId ? scrim.requesterTeam.tag : scrim.opponentTeam.tag);

/** Resumen del draft terminado para el chat. */
function summary(scrim: ChatScrim, g: DraftGame, names: Map<string, string>) {
  const side = splitActions(actionsOf(g));
  const list = (ids: (string | null)[]) => ids.map((c) => (c ? (names.get(c) ?? c) : "—")).join(", ");
  return `Draft del juego ${g.number} terminado. [${tagOf(scrim, g.blueTeamId)}] azul: ${list(side.BLUE.picks)} · [${tagOf(scrim, g.redTeamId)}] rojo: ${list(side.RED.picks)}`;
}

/**
 * Registra la acción del turno `step` (baneo, pick o baneo omitido con null). Usa el paso como bloqueo
 * optimista: si otro cliente ya registró ese turno, no se aplica dos veces.
 */
async function applyLock(scrim: ChatScrim, games: DraftGame[], g: DraftGame, step: number, champ: string | null, auto: boolean) {
  const actions = [...actionsOf(g), champ];
  const done = actions.length >= DRAFT_ORDER.length;
  return db.$transaction(async (tx) => {
    const res = await tx.draftGame.updateMany({
      where: { id: g.id, step, status: "DRAFTING" },
      data: {
        actions: actions as Prisma.InputJsonValue,
        step: step + 1,
        hover: null,
        status: done ? "DONE" : "DRAFTING",
        turnEndsAt: done ? null : turnEnd(scrim.draftTimer),
      },
    });
    if (res.count === 0) return false;
    if (done) {
      const { list } = await getChampions();
      const names = new Map(list.map((c) => [c.id, c.name]));
      await systemMessage(tx, scrim.id, summary(scrim, { ...g, actions }, names));
    } else if (auto && DRAFT_ORDER[step].kind === "PICK") {
      // Nada que avisar en baneos; en picks automáticos se avisa para que nadie se sorprenda
      const { list } = await getChampions();
      const name = list.find((c) => c.id === champ)?.name ?? champ;
      await systemMessage(tx, scrim.id, `Se acabó el tiempo del juego ${g.number}: [${tagOf(scrim, DRAFT_ORDER[step].side === "BLUE" ? g.blueTeamId : g.redTeamId)}] eligió ${name} automáticamente.`);
    }
    return true;
  });
}

/**
 * Si el reloj del turno llegó a 0 se fija el campeón seleccionado; sin selección, un baneo se omite
 * y un pick toma uno al azar entre los disponibles. Lo ejecuta cualquier consulta al draft.
 */
export async function resolveTimeouts(scrim: ChatScrim, games: DraftGame[]) {
  const g = games.find((x) => x.status === "DRAFTING");
  if (!g || !scrim.draftTimer || !g.turnEndsAt || g.turnEndsAt.getTime() + GRACE_MS > Date.now()) return false;
  const step = g.step;
  const { list } = await getChampions();
  const locked = lockedFor(scrim, games, g.number);
  const actions = actionsOf(g);
  const free = list.filter((c) => !unavailableReason(c.id, actions, locked));
  // Se fija el campeón seleccionado; sin selección, el baneo se omite y el pick es al azar
  let champ: string | null = g.hover && free.some((c) => c.id === g.hover) ? g.hover : null;
  if (!champ && DRAFT_ORDER[step].kind === "PICK") champ = free[Math.floor(Math.random() * free.length)]?.id ?? null;
  return applyLock(scrim, games, g, step, champ, true);
}

export async function draftState(scrim: ChatScrim, games: DraftGame[], user: { teamId: string; role: string }): Promise<DraftStateDTO> {
  const mineIsHost = scrim.requesterTeamId === user.teamId;
  const pick = (t: ChatScrim["requesterTeam"]) => ({ id: t.id, name: t.name, tag: t.tag, color: t.color, logoUpdatedAt: t.logoUpdatedAt?.toISOString() ?? null });
  const last = games.at(-1);
  const started = games.some((g) => g.status !== "READY_CHECK");
  let next: DraftStateDTO["next"] = null;
  if (games.length < scrim.games && (!last || last.status === "DONE")) {
    next = { number: games.length + 1, chooserTeamId: sideChooser(games.length + 1, scrim.opponentTeamId, last) };
  }
  const canAct = chatWritable(scrim) && user.role !== "LEGEND";
  return {
    scrim: { id: scrim.id, games: scrim.games, status: scrim.status, startAt: scrim.startAt.toISOString() },
    myTeam: pick(mineIsHost ? scrim.requesterTeam : scrim.opponentTeam),
    rival: pick(mineIsHost ? scrim.opponentTeam : scrim.requesterTeam),
    settings: { fearless: scrim.draftFearless, timer: scrim.draftTimer, editable: canAct && !started },
    games: games.map(toGameDTO),
    next,
    canAct,
    riotMatch: riotEnabled(),
    serverTime: new Date().toISOString(),
  };
}

export type DraftCommand =
  | { type: "settings"; fearless?: boolean; timer?: boolean }
  | { type: "side"; game: number; side: "BLUE" | "RED" }
  | { type: "ready"; game: number }
  | { type: "hover"; game: number; step: number; champion: string | null }
  | { type: "lock"; game: number; step: number; champion: string | null }
  | { type: "winner"; game: number; teamId: string }
  | { type: "match"; game: number; matchId: string }
  | { type: "reset"; game: number };

/** Ejecuta una acción del draft validando turnos, equipos y reglas. */
export async function runCommand(scrim: ChatScrim, games: DraftGame[], user: { id: string; username: string; teamId: string }, cmd: DraftCommand) {
  const myTag = tagOf(scrim, user.teamId);
  const game = "game" in cmd ? games.find((g) => g.number === cmd.game) : undefined;
  const needGame = () => game ?? fail(404, "Ese juego todavía no existe");

  switch (cmd.type) {
    case "settings": {
      if (games.some((g) => g.status !== "READY_CHECK")) fail(400, "El draft ya comenzó: el modo no se puede cambiar en esta serie");
      const data: { draftFearless?: boolean; draftTimer?: boolean } = {};
      const changes: string[] = [];
      if (cmd.fearless !== undefined && cmd.fearless !== scrim.draftFearless) {
        data.draftFearless = cmd.fearless;
        changes.push(cmd.fearless ? "activó el draft fearless (los campeones elegidos no se repiten en la serie)" : "desactivó el draft fearless");
      }
      if (cmd.timer !== undefined && cmd.timer !== scrim.draftTimer) {
        data.draftTimer = cmd.timer;
        changes.push(cmd.timer ? `activó el temporizador de ${TURN_SECONDS} s` : "desactivó el temporizador");
      }
      if (!changes.length) return;
      await db.$transaction(async (tx) => {
        await tx.scrim.update({ where: { id: scrim.id }, data });
        await systemMessage(tx, scrim.id, `${user.username} [${myTag}] ${changes.join(" y ")}.`);
      });
      return;
    }

    case "side": {
      const last = games.at(-1);
      if (cmd.game !== games.length + 1) fail(409, "Ese juego ya tiene lados elegidos");
      if (cmd.game > scrim.games) fail(400, `La serie es de ${scrim.games} juegos`);
      if (last && last.status !== "DONE") fail(400, "Termina el draft del juego anterior primero");
      const chooser = sideChooser(cmd.game, scrim.opponentTeamId, last);
      if (!chooser) fail(400, "Registra quién ganó el juego anterior: el perdedor elige lado");
      if (chooser !== user.teamId) fail(403, "La elección de lado le toca al otro equipo");
      const rivalId = user.teamId === scrim.requesterTeamId ? scrim.opponentTeamId : scrim.requesterTeamId;
      const [blue, red] = cmd.side === "BLUE" ? [user.teamId, rivalId] : [rivalId, user.teamId];
      await db.$transaction(async (tx) => {
        await tx.draftGame.create({ data: { scrimId: scrim.id, number: cmd.game, blueTeamId: blue, redTeamId: red, sideChosenBy: user.teamId } });
        await systemMessage(tx, scrim.id, `Juego ${cmd.game}: [${myTag}] eligió el lado ${cmd.side === "BLUE" ? "azul" : "rojo"}.`);
      });
      return;
    }

    case "ready": {
      const g = needGame();
      if (g.status !== "READY_CHECK") fail(400, "El draft de este juego ya comenzó");
      const isBlue = g.blueTeamId === user.teamId;
      const blueReady = isBlue ? true : g.blueReady;
      const redReady = isBlue ? g.redReady : true;
      const both = blueReady && redReady;
      await db.draftGame.updateMany({
        where: { id: g.id, status: "READY_CHECK" },
        data: { blueReady, redReady, ...(both ? { status: "DRAFTING", step: 0, actions: [], turnEndsAt: turnEnd(scrim.draftTimer) } : {}) },
      });
      return;
    }

    case "hover":
    case "lock": {
      const g = needGame();
      if (g.status !== "DRAFTING") fail(400, "Este juego no está en draft");
      if (cmd.step !== g.step) fail(409, "El turno ya cambió");
      const turn = DRAFT_ORDER[g.step];
      const actingTeam = turn.side === "BLUE" ? g.blueTeamId : g.redTeamId;
      if (actingTeam !== user.teamId) fail(403, "No es el turno de tu equipo");
      if (cmd.champion) {
        const { ids } = await getChampions();
        if (!ids.has(cmd.champion)) fail(422, "Campeón inválido");
        const reason = unavailableReason(cmd.champion, actionsOf(g), lockedFor(scrim, games, g.number));
        if (reason) fail(409, reason);
      } else if (cmd.type === "lock" && turn.kind === "PICK") fail(422, "Elige un campeón");
      if (cmd.type === "hover") {
        await db.draftGame.updateMany({ where: { id: g.id, step: g.step }, data: { hover: cmd.champion } });
        return;
      }
      const ok = await applyLock(scrim, games, g, g.step, cmd.champion, false);
      if (!ok) fail(409, "El turno ya cambió");
      return;
    }

    case "winner": {
      const g = needGame();
      if (g.status !== "DONE") fail(400, "Termina el draft antes de registrar quién ganó");
      if (cmd.teamId !== g.blueTeamId && cmd.teamId !== g.redTeamId) fail(422, "Equipo inválido");
      if (games.some((x) => x.number > g.number)) fail(400, "El siguiente juego ya comenzó: el ganador no se puede cambiar");
      if (g.winnerTeamId === cmd.teamId) return;
      await db.$transaction(async (tx) => {
        // Un ganador manual reemplaza al verificado (por ejemplo, si se pegó un Game ID equivocado)
        await tx.draftGame.update({ where: { id: g.id }, data: { winnerTeamId: cmd.teamId, matchId: null } });
        const more = g.number < scrim.games ? ` [${tagOf(scrim, cmd.teamId === g.blueTeamId ? g.redTeamId : g.blueTeamId)}] elige lado para el juego ${g.number + 1}.` : "";
        await systemMessage(tx, scrim.id, `${user.username} registró manualmente que [${tagOf(scrim, cmd.teamId)}] ganó el juego ${g.number}.${more}`);
      });
      return;
    }

    case "match": {
      const g = needGame();
      if (g.status !== "DONE") fail(400, "Termina el draft antes de registrar la partida");
      if (games.some((x) => x.number > g.number)) fail(400, "El siguiente juego ya comenzó: el resultado no se puede cambiar");
      if (!riotEnabled()) fail(503, "Falta configurar RIOT_API_KEY para verificar partidas: registra el ganador manualmente");
      const matchId = parseGameId(cmd.matchId, scrim.requesterTeam.region ?? "LAN");
      if (!matchId) fail(422, "Ese no parece un Game ID. Ejemplo: LA1_1234567890 o solo el número");
      if (g.matchId === matchId) return;
      const used = await db.draftGame.findUnique({ where: { matchId: matchId! }, select: { number: true, scrimId: true } });
      if (used) fail(409, used.scrimId === scrim.id ? `Ese Game ID ya se registró en el juego ${used.number}` : "Ese Game ID ya se registró en otro scrim");

      let result;
      try {
        result = await fetchMatchResult(matchId!);
      } catch (e) {
        if (e instanceof RiotError) fail(riotHttpStatus(e), e.message);
        throw e;
      }
      // La partida debe ser posterior al draft y con los campeones que se eligieron
      if (result.startedAt.getTime() < g.createdAt.getTime() - 10 * 60_000) fail(409, "Esa partida se jugó antes de este draft: revisa el Game ID");
      const side = splitActions(actionsOf(g));
      const { swapped, matched } = matchSides({ blue: side.BLUE.picks, red: side.RED.picks }, result.champions);
      if (matched < MIN_MATCHING_CHAMPIONS)
        fail(409, `Los campeones de ${matchId} no coinciden con el draft del juego ${g.number} (coinciden ${matched} de 10). Revisa el Game ID.`);

      // El lado 100 del cliente es el azul; si en el lobby se cambiaron de lado, se respeta quién jugó qué
      const blueWon = (result.winnerSide === 100) !== swapped;
      const winnerTeamId = blueWon ? g.blueTeamId : g.redTeamId;
      const loserTeamId = blueWon ? g.redTeamId : g.blueTeamId;
      await db.$transaction(async (tx) => {
        await tx.draftGame.update({ where: { id: g.id }, data: { winnerTeamId, matchId } });
        const minutes = Math.round(result.durationSec / 60);
        const more = g.number < scrim.games ? ` [${tagOf(scrim, loserTeamId)}] elige lado para el juego ${g.number + 1}.` : "";
        await systemMessage(
          tx,
          scrim.id,
          `Juego ${g.number} verificado con Riot (${matchId}, ${minutes} min): ganó [${tagOf(scrim, winnerTeamId)}] con el lado ${(result.winnerSide === 100) ? "azul" : "rojo"}.${swapped ? " En la partida jugaron con los lados cambiados." : ""}${more}`,
        );
      });
      return;
    }

    case "reset": {
      const g = needGame();
      if (g.winnerTeamId || games.some((x) => x.number > g.number)) fail(400, "Este juego ya cerró: no se puede repetir el draft");
      await db.$transaction(async (tx) => {
        await tx.draftGame.update({
          where: { id: g.id },
          data: { status: "READY_CHECK", blueReady: false, redReady: false, actions: [], step: 0, hover: null, turnEndsAt: null },
        });
        await systemMessage(tx, scrim.id, `${user.username} [${myTag}] reinició el draft del juego ${g.number}.`);
      });
      return;
    }
  }
}
