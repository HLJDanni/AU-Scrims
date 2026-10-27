"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Ban, Check, Flame, Lock, RotateCcw, Search, Shield, Swords, Timer, Trophy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR, { SWRConfig } from "swr";
import { toast } from "sonner";
import { api, cn, fetcher } from "@/lib/client";
import {
  DRAFT_ORDER,
  TURN_SECONDS,
  fearlessLocked,
  phaseLabel,
  slotOf,
  splitActions,
  unavailableReason,
  type DraftGameDTO,
  type DraftStateDTO,
  type DraftTeam,
  type Side,
} from "@/lib/draft";
import type { Lane } from "@/lib/champion-roles";
import { Button } from "../ui/button";
import { Skeleton, TeamEmblem } from "../ui/misc";

type Champion = { id: string; name: string; roles: Lane[] };
type ChampData = { version: string; champions: Champion[] };

const SIDE = {
  BLUE: { label: "Lado azul", color: "#3FA9F5", glow: "rgba(63,169,245,.55)", soft: "rgba(63,169,245,.14)" },
  RED: { label: "Lado rojo", color: "#E84057", glow: "rgba(232,64,87,.55)", soft: "rgba(232,64,87,.14)" },
} as const;
const POSITION_ICON = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-";
const ROLES: { id: Lane | ""; label: string }[] = [
  { id: "", label: "Todos" },
  { id: "TOP", label: "Top" },
  { id: "JUNGLE", label: "Jungla" },
  { id: "MIDDLE", label: "Medio" },
  { id: "BOTTOM", label: "ADC" },
  { id: "UTILITY", label: "Soporte" },
];
const DD = "https://ddragon.leagueoflegends.com/cdn";
const iconUrl = (v: string, id: string) => `${DD}/${v}/img/champion/${id}.png`;
const splashUrl = (id: string) => `${DD}/img/champion/centered/${id}_0.jpg`;

export function DraftRoom({ scrimId }: { scrimId: string }) {
  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: true, dedupingInterval: 500, keepPreviousData: true }}>
      <Room scrimId={scrimId} />
    </SWRConfig>
  );
}

/** Reloj sincronizado con el servidor (la cuenta regresiva no depende de la hora del equipo). */
function useServerNow(serverTime?: string) {
  const offset = useRef(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (serverTime) offset.current = Date.parse(serverTime) - Date.now();
  }, [serverTime]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  return now + offset.current;
}

function Room({ scrimId }: { scrimId: string }) {
  const key = `/api/scrims/${scrimId}/draft`;
  const { data: state, error, mutate } = useSWR<DraftStateDTO>(key, {
    refreshInterval: (s) => (s && (s.games.some((g) => g.status !== "DONE") || s.next) ? 1000 : 4000),
  });
  const { data: champs } = useSWR<ChampData>("/api/champions", { revalidateOnFocus: false, refreshInterval: 0 });
  const [view, setView] = useState<number | "lobby" | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(body: Record<string, unknown>, ok?: string) {
    setBusy(true);
    try {
      const next = await api<DraftStateDTO>(key, { body });
      await mutate(next, { revalidate: false });
      if (ok) toast.success(ok);
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      await mutate();
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (error)
    return (
      <Shell>
        <div className="mx-auto mt-24 max-w-md rounded-md border border-gold-500/40 bg-void-900/90 p-6 text-center">
          <Lock className="mx-auto mb-3 h-8 w-8 text-gold-300" />
          <p className="font-display text-lg font-bold text-gold-50">Draft no disponible</p>
          <p className="mt-2 text-sm text-stone-300">{(error as Error).message}</p>
          <Link href="/calendar" className="mt-5 inline-block">
            <Button variant="secondary">Volver al calendario</Button>
          </Link>
        </div>
      </Shell>
    );
  if (!state || !champs)
    return (
      <Shell>
        <div className="mx-auto max-w-6xl space-y-4 p-6">
          <Skeleton className="h-20" />
          <div className="grid gap-4 lg:grid-cols-[260px_1fr_260px]">
            <Skeleton className="h-[420px]" />
            <Skeleton className="h-[420px]" />
            <Skeleton className="h-[420px]" />
          </div>
        </div>
      </Shell>
    );

  const active = state.games.find((g) => g.status !== "DONE");
  const last = state.games.at(-1);
  const auto: number | "lobby" = active ? active.number : last && !last.winnerTeamId ? last.number : state.next ? "lobby" : (last?.number ?? "lobby");
  const shown = view ?? auto;
  const game = typeof shown === "number" ? state.games.find((g) => g.number === shown) : undefined;

  return (
    <Shell>
      <TopBar state={state} shown={game ? game.number : "lobby"} onShow={(v) => setView(v === auto ? null : v)} />
      <div className="mx-auto w-full max-w-[1400px] flex-1 px-3 pb-8 pt-4 sm:px-6">
        <AnimatePresence mode="wait">
          <motion.div key={`${game?.number ?? "lobby"}-${game?.status ?? ""}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
            {!game ? (
              <Lobby state={state} champs={champs} busy={busy} send={send} onShowGame={(n) => setView(n)} onSaved={() => mutate()} />
            ) : game.status === "READY_CHECK" ? (
              <ReadyCheck state={state} game={game} busy={busy} send={send} />
            ) : (
              <Board key={game.number} state={state} game={game} champs={champs} busy={busy} send={send} onNext={() => setView(null)} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-void-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_0%_0%,rgba(63,169,245,.10),transparent),radial-gradient(900px_420px_at_100%_0%,rgba(232,64,87,.10),transparent),radial-gradient(700px_300px_at_50%_110%,rgba(200,155,60,.12),transparent)]" />
      <div className="relative flex flex-1 flex-col">{children}</div>
    </div>
  );
}

const teamOf = (s: DraftStateDTO, id: string) => (s.myTeam.id === id ? s.myTeam : s.rival);

function TopBar({ state, shown, onShow }: { state: DraftStateDTO; shown: number | "lobby"; onShow: (v: number | "lobby") => void }) {
  const tabs: (number | "lobby")[] = ["lobby", ...state.games.map((g) => g.number)];
  return (
    <header className="sticky top-0 z-20 border-b border-gold-500/40 bg-void-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-3 py-3 sm:px-6">
        <Link href={`/chat?scrim=${state.scrim.id}`} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-stone-300 hover:bg-void-700 hover:text-gold-50">
          <ArrowLeft className="h-4 w-4" /> Chat
        </Link>
        <div className="flex items-center gap-2">
          <TeamEmblem team={state.myTeam} size={30} />
          <span className="font-display text-sm font-bold tracking-widest text-gold-50">
            {state.myTeam.tag} <span className="text-stone-400">vs</span> {state.rival.tag}
          </span>
          <TeamEmblem team={state.rival} size={30} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {state.settings.fearless && (
            <span className="flex items-center gap-1 rounded border border-gold-300/60 bg-gold-700/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gold-100">
              <Flame className="h-3 w-3" /> Fearless
            </span>
          )}
          <span className="flex items-center gap-1 rounded border border-void-500 px-2 py-0.5 text-[10px] uppercase tracking-widest text-stone-300">
            <Timer className="h-3 w-3" /> {state.settings.timer ? `${TURN_SECONDS} s` : "Sin tiempo"}
          </span>
          <span className="rounded border border-void-500 px-2 py-0.5 text-[10px] uppercase tracking-widest text-stone-300">Bo{state.scrim.games}</span>
        </div>
        <nav className="ml-auto flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const g = typeof t === "number" ? state.games.find((x) => x.number === t) : undefined;
            const winner = g?.winnerTeamId ? teamOf(state, g.winnerTeamId) : null;
            return (
              <button
                key={t}
                onClick={() => onShow(t)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 font-display text-[11px] font-bold uppercase tracking-widest transition",
                  shown === t ? "bg-gold-gradient text-void-950" : "text-stone-300 hover:bg-void-700 hover:text-gold-50",
                )}
              >
                {t === "lobby" ? "Serie" : `Juego ${t}`}
                {g && g.status !== "DONE" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-hex-200" />}
                {winner && <span className={cn("text-[9px]", shown === t ? "text-void-900" : "text-gold-200")}>{winner.tag}</span>}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="h-px bg-gold-line" />
    </header>
  );
}

// ---------- Serie: modo, lados y resultados ----------

function Switch({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-gold-300 bg-gold-gradient" : "border-void-500 bg-void-800",
      )}
    >
      <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 35 }} className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-gold-50 shadow", checked ? "right-0.5" : "left-0.5")} />
    </button>
  );
}

type Send = (body: Record<string, unknown>, ok?: string) => Promise<boolean>;

function Lobby({
  state,
  champs,
  busy,
  send,
  onShowGame,
  onSaved,
}: {
  state: DraftStateDTO;
  champs: ChampData;
  busy: boolean;
  send: Send;
  onShowGame: (n: number) => void;
  onSaved: () => void;
}) {
  const { settings, next } = state;
  const editable = settings.editable;
  const chooser = next?.chooserTeamId ? teamOf(state, next.chooserTeamId) : null;
  const iChoose = state.canAct && next?.chooserTeamId === state.myTeam.id;
  const locked = settings.fearless ? fearlessLocked(state.games) : new Set<string>();

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <section className="space-y-5">
        <div className="hex-panel overflow-hidden p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-hex-200">Draft de la serie</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-wide text-gold-50 sm:text-3xl">
            {next ? `Juego ${next.number} de ${state.scrim.games}` : "Serie terminada"}
          </h1>

          {next ? (
            <div className="mt-5">
              {iChoose ? (
                <>
                  <p className="text-sm text-stone-300">
                    {next.number === 1 ? "Como equipo invitado, eliges lado para el primer juego." : "Perdieron el juego anterior: eligen lado para este juego."}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {(["BLUE", "RED"] as const).map((side) => (
                      <motion.button
                        key={side}
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={busy}
                        onClick={() => send({ type: "side", game: next.number, side }, `Elegiste el ${SIDE[side].label.toLowerCase()}`)}
                        className="group relative overflow-hidden rounded-md border-2 p-5 text-left disabled:opacity-60"
                        style={{ borderColor: SIDE[side].color, background: `linear-gradient(135deg, ${SIDE[side].soft}, transparent 70%)` }}
                      >
                        <p className="font-display text-xl font-bold tracking-widest" style={{ color: SIDE[side].color }}>
                          {SIDE[side].label.toUpperCase()}
                        </p>
                        <p className="mt-1 text-xs text-stone-300">
                          {side === "BLUE" ? "Primer pick y primer baneo." : "Último pick: puedes contrarrestar al rival."}
                        </p>
                        <Shield className="absolute -bottom-3 -right-3 h-20 w-20 opacity-10 transition group-hover:opacity-25" style={{ color: SIDE[side].color }} />
                      </motion.button>
                    ))}
                  </div>
                </>
              ) : chooser ? (
                <WaitLine text={`Esperando que [${chooser.tag}] elija lado para el juego ${next.number}…`} />
              ) : (
                <div className="rounded-md border border-gold-300/40 bg-gold-700/20 p-4 text-sm text-gold-100">
                  Registra quién ganó el juego {next.number - 1}: el perdedor elige lado para el siguiente.
                  <Button size="sm" variant="secondary" className="mt-3" onClick={() => onShowGame(next.number - 1)}>
                    Ir al juego {next.number - 1}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-stone-300">Ya se jugaron todos los drafts de la serie. Recuerda registrar el resultado del scrim en su detalle.</p>
          )}
        </div>

        <SeriesScore state={state} onSaved={onSaved} />

        <div className="hex-panel p-5">
          <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.18em] text-gold-100">Juegos</h2>
          {state.games.length === 0 ? (
            <p className="text-sm text-stone-400">Aún no empieza ningún juego.</p>
          ) : (
            <ul className="space-y-2">
              {state.games.map((g) => (
                <GameRow key={g.number} state={state} game={g} version={champs.version} onClick={() => onShowGame(g.number)} />
              ))}
            </ul>
          )}
        </div>
      </section>

      <aside className="space-y-5">
        <div className="hex-panel p-5">
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-gold-100">Modo de draft</h2>
          <div className="mt-4 space-y-4">
            <label className="flex items-start justify-between gap-4">
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-gold-50">
                  <Flame className="h-4 w-4 text-gold-300" /> Fearless
                </span>
                <span className="mt-0.5 block text-xs text-stone-400">Un campeón elegido en un juego no puede volver a elegirse en la serie (por ningún equipo).</span>
              </span>
              <Switch label="Draft fearless" checked={settings.fearless} disabled={!editable || busy} onChange={(v) => send({ type: "settings", fearless: v }, v ? "Draft fearless activado" : "Draft normal")} />
            </label>
            <label className="flex items-start justify-between gap-4">
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-gold-50">
                  <Timer className="h-4 w-4 text-gold-300" /> Temporizador de {TURN_SECONDS} s
                </span>
                <span className="mt-0.5 block text-xs text-stone-400">Como en el Mundial. Si se acaba el tiempo se fija el campeón seleccionado; sin selección, el baneo se omite y el pick es al azar.</span>
              </span>
              <Switch label="Temporizador" checked={settings.timer} disabled={!editable || busy} onChange={(v) => send({ type: "settings", timer: v }, v ? "Temporizador activado" : "Temporizador desactivado")} />
            </label>
          </div>
          <p className="mt-4 text-[11px] text-stone-400">
            {editable ? "Cualquier miembro del staff de ambos equipos puede cambiarlo hasta que empiece el primer draft. Los cambios se avisan en el chat." : "El modo quedó fijo al empezar el primer draft de la serie."}
          </p>
        </div>

        <div className="hex-panel p-5 text-xs text-stone-300">
          <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-[0.18em] text-gold-100">Orden profesional</h2>
          <p>Baneos 1: A R A R A R · Picks 1: A R R A A R · Baneos 2: R A R A · Picks 2: R A A R (A = azul, R = rojo).</p>
          <p className="mt-2">Juego 1: el equipo invitado elige lado. Desde el juego 2, elige el que perdió el anterior.</p>
        </div>

        {settings.fearless && locked.size > 0 && (
          <div className="hex-panel p-5">
            <h2 className="mb-3 flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-[0.18em] text-gold-100">
              <Flame className="h-4 w-4 text-gold-300" /> Bloqueados ({locked.size})
            </h2>
            <ChampStrip ids={[...locked]} version={champs.version} />
          </div>
        )}
      </aside>
    </div>
  );
}

function WaitLine({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-3 rounded-md border border-hex-200/40 bg-hex-500/20 px-4 py-3 text-sm text-hex-100">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inset-0 animate-ping rounded-full bg-hex-200/70" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-hex-200" />
      </span>
      {text}
    </p>
  );
}

function ChampStrip({ ids, version, size = 28 }: { ids: (string | null)[]; version: string; size?: number }) {
  return (
    <div className="flex flex-wrap gap-1">
      {ids.map((id, i) =>
        id ? (
          <img key={`${id}-${i}`} src={iconUrl(version, id)} alt={id} title={id} width={size} height={size} loading="lazy" className="rounded-sm border border-void-500" />
        ) : (
          <span key={`none-${i}`} className="flex items-center justify-center rounded-sm border border-dashed border-void-500 text-stone-400" style={{ width: size, height: size }}>
            <Ban className="h-3 w-3" />
          </span>
        ),
      )}
    </div>
  );
}

function GameRow({ state, game, version, onClick }: { state: DraftStateDTO; game: DraftGameDTO; version: string; onClick: () => void }) {
  const blue = teamOf(state, game.blueTeamId);
  const red = teamOf(state, game.redTeamId);
  const split = splitActions(game.actions);
  return (
    <li>
      <button onClick={onClick} className="flex w-full flex-col gap-2 rounded-md border border-void-500/70 bg-void-950/50 p-3 text-left transition hover:border-gold-500/60 sm:flex-row sm:items-center">
        <span className="w-20 shrink-0 font-display text-xs font-bold uppercase tracking-widest text-gold-100">Juego {game.number}</span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: SIDE.BLUE.color }}>
            {blue.tag} {game.winnerTeamId === blue.id && <Trophy className="h-3.5 w-3.5 text-gold-300" />}
          </span>
          <ChampStrip ids={split.BLUE.picks} version={version} size={24} />
          <span className="text-stone-400">vs</span>
          <ChampStrip ids={split.RED.picks} version={version} size={24} />
          <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: SIDE.RED.color }}>
            {game.winnerTeamId === red.id && <Trophy className="h-3.5 w-3.5 text-gold-300" />} {red.tag}
          </span>
        </div>
        <span className="shrink-0 text-[11px] text-stone-400">
          {game.status === "READY_CHECK" ? "Esperando listos" : game.status === "DRAFTING" ? "En draft" : game.winnerTeamId ? "Terminado" : "Falta ganador"}
        </span>
      </button>
    </li>
  );
}

// ---------- Confirmación de listos ----------

function ReadyCheck({ state, game, busy, send }: { state: DraftStateDTO; game: DraftGameDTO; busy: boolean; send: Send }) {
  const mineBlue = game.blueTeamId === state.myTeam.id;
  const myReady = mineBlue ? game.blueReady : game.redReady;
  const rows: { side: Side; team: DraftTeam; ready: boolean }[] = [
    { side: "BLUE", team: teamOf(state, game.blueTeamId), ready: game.blueReady },
    { side: "RED", team: teamOf(state, game.redTeamId), ready: game.redReady },
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-hex-200">Juego {game.number}</p>
      <h1 className="mt-1 text-center font-display text-3xl font-bold tracking-wide text-gold-50">Preparados para el draft</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {rows.map((r) => (
          <motion.div
            key={r.side}
            initial={{ opacity: 0, x: r.side === "BLUE" ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative overflow-hidden rounded-md border-2 p-6 text-center"
            style={{ borderColor: SIDE[r.side].color, background: `linear-gradient(180deg, ${SIDE[r.side].soft}, transparent)` }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: SIDE[r.side].color }}>
              {SIDE[r.side].label}
            </p>
            <TeamEmblem team={r.team} size={72} className="mx-auto mt-3" />
            <p className="mt-3 font-display text-lg font-bold text-gold-50">{r.team.name}</p>
            <p className={cn("mt-2 flex items-center justify-center gap-1.5 text-sm font-semibold", r.ready ? "text-win" : "text-stone-400")}>
              {r.ready ? (
                <>
                  <Check className="h-4 w-4" /> Listo
                </>
              ) : (
                "Esperando…"
              )}
            </p>
          </motion.div>
        ))}
      </div>
      <div className="mt-6 flex flex-col items-center gap-3">
        {state.canAct && !myReady && (
          <Button size="lg" loading={busy} onClick={() => send({ type: "ready", game: game.number })}>
            <Check className="h-4 w-4" /> Estamos listos
          </Button>
        )}
        <p className="text-xs text-stone-400">El draft empieza en cuanto ambos equipos confirmen. Sus picks aparecen en tiempo real para los dos.</p>
      </div>
    </div>
  );
}

// ---------- Tablero de draft estilo Mundial ----------

function Board({ state, game, champs, busy, send, onNext }: { state: DraftStateDTO; game: DraftGameDTO; champs: ChampData; busy: boolean; send: Send; onNext: () => void }) {
  const now = useServerNow(state.serverTime);
  const drafting = game.status === "DRAFTING";
  const turn = drafting ? DRAFT_ORDER[game.step] : null;
  const actingTeamId = turn ? (turn.side === "BLUE" ? game.blueTeamId : game.redTeamId) : null;
  const myTurn = Boolean(state.canAct && turn && actingTeamId === state.myTeam.id);
  const blue = teamOf(state, game.blueTeamId);
  const red = teamOf(state, game.redTeamId);
  const split = splitActions(game.actions);
  const byId = useMemo(() => new Map(champs.champions.map((c) => [c.id, c])), [champs]);
  const locked = useMemo(
    () => (state.settings.fearless ? fearlessLocked(state.games.filter((g) => g.number < game.number)) : new Set<string>()),
    [state.settings.fearless, state.games, game.number],
  );

  // Selección local en mi turno; el rival ve la selección como "hover" (igual que en la transmisión)
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => setSel(null), [game.step]);
  const pending = myTurn ? sel : game.hover;

  function choose(id: string) {
    if (!myTurn || busy) return;
    setSel(id);
    api(`/api/scrims/${state.scrim.id}/draft`, { body: { type: "hover", game: game.number, step: game.step, champion: id } }).catch(() => null);
  }
  async function lock(champion: string | null) {
    if (!turn) return;
    await send({ type: "lock", game: game.number, step: game.step, champion });
  }

  const remaining = drafting && game.turnEndsAt ? Math.max(0, Math.ceil((Date.parse(game.turnEndsAt) - now) / 1000)) : null;
  const slotFor = (side: Side, kind: "BAN" | "PICK") => (turn && turn.side === side && turn.kind === kind ? slotOf(game.step) : -1);

  return (
    <div className="space-y-4">
      {/* Encabezado: equipos y reloj */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-4">
        <TeamBanner team={blue} side="BLUE" active={turn?.side === "BLUE"} mine={blue.id === state.myTeam.id} />
        <div className="flex min-w-[96px] flex-col items-center justify-center rounded-md border border-gold-500/50 bg-void-900/90 px-2 py-2 text-center sm:min-w-[170px] sm:px-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-stone-300 sm:text-[10px] sm:tracking-[0.2em]">{drafting ? phaseLabel(game.step) : "Draft terminado"}</p>
          {drafting ? (
            <motion.p
              key={remaining ?? "inf"}
              initial={{ scale: 1.15, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              className={cn("font-display text-4xl font-bold tabular-nums sm:text-5xl", remaining !== null && remaining <= 10 ? "text-blood" : "text-gold-50")}
            >
              {remaining ?? "∞"}
            </motion.p>
          ) : (
            <Check className="my-1 h-9 w-9 text-win" />
          )}
          <p className="text-[10px] uppercase tracking-widest text-stone-400">Juego {game.number}</p>
        </div>
        <TeamBanner team={red} side="RED" active={turn?.side === "RED"} mine={red.id === state.myTeam.id} />
      </div>

      {/* Baneos */}
      <div className="flex items-center justify-between gap-2">
        <BanRow ids={split.BLUE.bans} side="BLUE" active={slotFor("BLUE", "BAN")} pending={pending} version={champs.version} />
        <span className="hidden text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400 sm:block">Baneos</span>
        <BanRow ids={split.RED.bans} side="RED" active={slotFor("RED", "BAN")} pending={pending} version={champs.version} reverse />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[250px_1fr_250px]">
        <PickColumn ids={split.BLUE.picks} side="BLUE" active={slotFor("BLUE", "PICK")} pending={pending} byId={byId} className="order-1" />
        <div className="order-3 col-span-2 lg:order-2 lg:col-span-1">
          {drafting ? (
            <>
              <TurnBar turn={turn!} team={teamOf(state, actingTeamId!)} myTurn={myTurn} sel={sel} byId={byId} busy={busy} onLock={lock} />
              <ChampionGrid
                champs={champs}
                actions={game.actions}
                locked={locked}
                selected={pending}
                interactive={myTurn}
                onChoose={choose}
              />
            </>
          ) : (
            <DoneCenter state={state} game={game} byId={byId} busy={busy} send={send} onNext={onNext} />
          )}
        </div>
        <PickColumn ids={split.RED.picks} side="RED" active={slotFor("RED", "PICK")} pending={pending} byId={byId} className="order-2 lg:order-3" />
      </div>

      {state.canAct && !game.winnerTeamId && (
        <div className="flex justify-center">
          <button
            onClick={() => {
              if (confirm(`¿Reiniciar el draft del juego ${game.number}? Se borran sus baneos y picks y ambos equipos deben confirmar de nuevo.`))
                send({ type: "reset", game: game.number }, "Draft reiniciado");
            }}
            className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-blood"
          >
            <RotateCcw className="h-3 w-3" /> Reiniciar draft de este juego
          </button>
        </div>
      )}
    </div>
  );
}

function TeamBanner({ team, side, active, mine }: { team: DraftTeam; side: Side; active: boolean; mine: boolean }) {
  const right = side === "RED";
  return (
    <motion.div
      animate={{ boxShadow: active ? `0 0 30px -6px ${SIDE[side].glow}` : "0 0 0 0 rgba(0,0,0,0)" }}
      className={cn("relative flex items-center gap-3 overflow-hidden rounded-md border-2 px-3 py-2 sm:px-4", right && "flex-row-reverse text-right")}
      style={{ borderColor: active ? SIDE[side].color : `${SIDE[side].color}55`, background: `linear-gradient(${right ? "270deg" : "90deg"}, ${SIDE[side].soft}, transparent 80%)` }}
    >
      <TeamEmblem team={team} size={44} className="hidden sm:block" />
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] sm:text-[10px] sm:tracking-[0.3em]" style={{ color: SIDE[side].color }}>
          <span className="sm:hidden">{side === "BLUE" ? "Azul" : "Rojo"}</span>
          <span className="hidden sm:inline">{SIDE[side].label}</span>
          {mine && <span className="hidden text-gold-200 sm:inline"> · Tu equipo</span>}
        </p>
        <p className="truncate font-display text-base font-bold tracking-wide text-gold-50 sm:text-xl">
          <span className="sm:hidden">{team.tag}</span>
          <span className="hidden sm:inline">{team.name}</span>
        </p>
        {mine && <p className="text-[9px] uppercase tracking-widest text-gold-200 sm:hidden">Tu equipo</p>}
      </div>
    </motion.div>
  );
}

function BanRow({ ids, side, active, pending, version, reverse }: { ids: (string | null)[]; side: Side; active: number; pending: string | null; version: string; reverse?: boolean }) {
  return (
    <div className={cn("flex gap-0.5 sm:gap-1.5", reverse && "flex-row-reverse")}>
      {Array.from({ length: 5 }, (_, i) => {
        const done = i < ids.length;
        const champ = done ? ids[i] : i === active ? pending : null;
        const isActive = i === active;
        return (
          <div
            key={i}
            className={cn("relative h-[30px] w-[30px] overflow-hidden rounded-sm border bg-void-900 sm:h-12 sm:w-12", isActive ? "animate-pulse" : "")}
            style={{ borderColor: isActive ? SIDE[side].color : "#3C3C41", boxShadow: isActive ? `0 0 14px ${SIDE[side].glow}` : undefined }}
          >
            <AnimatePresence>
              {champ && (
                <motion.img
                  key={champ}
                  src={iconUrl(version, champ)}
                  alt={champ}
                  initial={{ scale: 1.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: done ? 1 : 0.5 }}
                  className="h-full w-full object-cover grayscale"
                />
              )}
            </AnimatePresence>
            {done && <span className="absolute inset-0 bg-[linear-gradient(135deg,transparent_46%,#E84057_47%,#E84057_53%,transparent_54%)]" />}
            {done && !ids[i] && <Ban className="absolute inset-0 m-auto h-4 w-4 text-stone-400" />}
          </div>
        );
      })}
    </div>
  );
}

function PickColumn({ ids, side, active, pending, byId, className }: { ids: (string | null)[]; side: Side; active: number; pending: string | null; byId: Map<string, Champion>; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: 5 }, (_, i) => {
        const done = i < ids.length;
        const champ = done ? ids[i] : i === active ? pending : null;
        const isActive = i === active;
        return (
          <motion.div
            key={i}
            animate={{ boxShadow: isActive ? `0 0 22px -4px ${SIDE[side].glow}` : "0 0 0 0 rgba(0,0,0,0)" }}
            className="relative h-16 overflow-hidden rounded-md border bg-void-900 sm:h-[86px]"
            style={{ borderColor: isActive ? SIDE[side].color : done ? `${SIDE[side].color}66` : "#3C3C41" }}
          >
            <AnimatePresence mode="popLayout">
              {champ && (
                <motion.img
                  key={champ}
                  src={splashUrl(champ)}
                  alt={byId.get(champ)?.name ?? champ}
                  initial={{ opacity: 0, scale: 1.15 }}
                  animate={{ opacity: done ? 1 : 0.45, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="absolute inset-0 h-full w-full object-cover object-[50%_20%]"
                />
              )}
            </AnimatePresence>
            {done && (
              <motion.span
                initial={{ opacity: 0.9 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="pointer-events-none absolute inset-0"
                style={{ background: SIDE[side].color }}
              />
            )}
            <div
              className={cn("absolute inset-0 flex flex-col justify-end p-2", side === "RED" && "items-end text-right")}
              style={{ background: `linear-gradient(${side === "RED" ? "270deg" : "90deg"}, rgba(1,10,19,.85), rgba(1,10,19,.15) 70%)` }}
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.25em]" style={{ color: SIDE[side].color }}>
                {isActive ? (done ? "" : "Eligiendo…") : `Pick ${i + 1}`}
              </p>
              <p className="truncate font-display text-sm font-bold tracking-wide text-gold-50 sm:text-base">{champ ? (byId.get(champ)?.name ?? champ) : ""}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function TurnBar({
  turn,
  team,
  myTurn,
  sel,
  byId,
  busy,
  onLock,
}: {
  turn: (typeof DRAFT_ORDER)[number];
  team: DraftTeam;
  myTurn: boolean;
  sel: string | null;
  byId: Map<string, Champion>;
  busy: boolean;
  onLock: (c: string | null) => void;
}) {
  const ban = turn.kind === "BAN";
  return (
    <div
      className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3"
      style={{ borderColor: `${SIDE[turn.side].color}88`, background: `linear-gradient(90deg, ${SIDE[turn.side].soft}, transparent)` }}
    >
      <p className="text-sm text-gold-50">
        {myTurn ? (
          <>
            <b className="font-display tracking-wide">Tu turno:</b> {ban ? "elige un campeón para banear" : "elige tu campeón"}
            {sel && <span className="text-gold-200"> · {byId.get(sel)?.name}</span>}
          </>
        ) : (
          <>
            Turno de <b style={{ color: SIDE[turn.side].color }}>[{team.tag}]</b> · {ban ? "baneo" : "selección"}
          </>
        )}
      </p>
      {myTurn && (
        <div className="flex items-center gap-2">
          {ban && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onLock(null)}>
              Sin baneo
            </Button>
          )}
          <Button size="sm" variant={ban ? "danger" : "primary"} disabled={!sel} loading={busy} onClick={() => onLock(sel)}>
            {ban ? <Ban className="h-4 w-4" /> : <Swords className="h-4 w-4" />} {ban ? "Banear" : "Fijar campeón"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ChampionGrid({
  champs,
  actions,
  locked,
  selected,
  interactive,
  onChoose,
}: {
  champs: ChampData;
  actions: (string | null)[];
  locked: Set<string>;
  selected: string | null;
  interactive: boolean;
  onChoose: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Lane | "">("");
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return champs.champions.filter((c) => (!term || c.name.toLowerCase().includes(term) || c.id.toLowerCase().includes(term)) && (!role || c.roles.includes(role)));
  }, [champs, q, role]);

  return (
    <div className="hex-panel p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[160px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar campeón…" className="field h-9 py-1.5 pl-9" aria-label="Buscar campeón" />
        </div>
        <div className="flex flex-wrap gap-1">
          {ROLES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              aria-pressed={role === r.id}
              title={r.label}
              className={cn("flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition", role === r.id ? "bg-gold-gradient text-void-950" : "text-stone-300 hover:bg-void-700 hover:text-gold-50")}
            >
              {r.id && <img src={`${POSITION_ICON}${r.id.toLowerCase()}.png`} alt="" className={cn("h-4 w-4", role === r.id && "brightness-0")} />}
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid max-h-[46vh] grid-cols-[repeat(auto-fill,minmax(58px,1fr))] gap-1.5 overflow-y-auto pr-1 lg:max-h-[440px]">
        {list.map((c) => {
          const reason = unavailableReason(c.id, actions, locked);
          const fearless = locked.has(c.id);
          const isSel = selected === c.id;
          return (
            <button
              key={c.id}
              onClick={() => !reason && onChoose(c.id)}
              disabled={!interactive || Boolean(reason)}
              title={reason ?? c.name}
              className={cn(
                "group relative flex flex-col items-center gap-0.5 rounded p-0.5 transition",
                interactive && !reason && "hover:bg-void-700",
                isSel && "bg-gold-500/25 ring-2 ring-gold-300",
                !interactive && "cursor-default",
              )}
            >
              <span className="relative block aspect-square w-full overflow-hidden rounded-sm border border-void-500">
                <img src={iconUrl(champs.version, c.id)} alt="" loading="lazy" className={cn("h-full w-full object-cover transition", reason && "grayscale opacity-30", interactive && !reason && "group-hover:scale-110")} />
                {fearless && <Lock className="absolute inset-0 m-auto h-4 w-4 text-gold-300" />}
              </span>
              <span className={cn("w-full truncate text-center text-[9px]", reason ? "text-stone-400/60" : "text-stone-300")}>{c.name}</span>
            </button>
          );
        })}
        {list.length === 0 && <p className="col-span-full py-6 text-center text-xs text-stone-400">Ningún campeón coincide</p>}
      </div>
      {locked.size > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-stone-400">
          <Flame className="h-3.5 w-3.5 text-gold-300" /> Fearless: {locked.size} campeones bloqueados por juegos anteriores.
        </p>
      )}
    </div>
  );
}

function DoneCenter({ state, game, byId, busy, send, onNext }: { state: DraftStateDTO; game: DraftGameDTO; byId: Map<string, Champion>; busy: boolean; send: Send; onNext: () => void }) {
  const teams = [teamOf(state, game.blueTeamId), teamOf(state, game.redTeamId)];
  const later = state.games.some((g) => g.number > game.number);
  const split = splitActions(game.actions);
  const names = (ids: (string | null)[]) => ids.map((c) => (c ? (byId.get(c)?.name ?? c) : "—")).join(" · ");
  return (
    <div className="hex-panel flex h-full flex-col items-center justify-center gap-5 p-6 text-center">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-hex-200">Draft terminado</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-gold-50">Juego {game.number}</h2>
      </div>
      <div className="grid w-full gap-2 text-xs sm:grid-cols-2">
        <p className="rounded border px-3 py-2 text-gold-50" style={{ borderColor: `${SIDE.BLUE.color}66` }}>
          <b style={{ color: SIDE.BLUE.color }}>[{teams[0].tag}]</b> {names(split.BLUE.picks)}
        </p>
        <p className="rounded border px-3 py-2 text-gold-50" style={{ borderColor: `${SIDE.RED.color}66` }}>
          <b style={{ color: SIDE.RED.color }}>[{teams[1].tag}]</b> {names(split.RED.picks)}
        </p>
      </div>
      <GameResult state={state} game={game} teams={teams} busy={busy} send={send} locked={later} />
      {game.winnerTeamId && game.number < state.scrim.games && !later && (
        <Button onClick={onNext}>Siguiente juego · elegir lado</Button>
      )}
      {game.winnerTeamId && game.number >= state.scrim.games && (
        <p className="text-xs text-stone-400">Fue el último juego de la serie. En la pestaña Serie puedes pasar el marcador al ranking.</p>
      )}
    </div>
  );
}

/**
 * Resultado del juego: se pega el Game ID de la partida y Riot dice qué lado ganó.
 * El servidor comprueba que los campeones coincidan con el draft. Si Riot no la encuentra
 * (o no hay clave configurada), se puede registrar el ganador a mano.
 */
function GameResult({
  state,
  game,
  teams,
  busy,
  send,
  locked,
}: {
  state: DraftStateDTO;
  game: DraftGameDTO;
  teams: DraftTeam[];
  busy: boolean;
  send: Send;
  locked: boolean;
}) {
  const [gameId, setGameId] = useState("");
  const [manual, setManual] = useState(!state.riotMatch);
  const winner = game.winnerTeamId ? teamOf(state, game.winnerTeamId) : null;
  const editable = state.canAct && !locked;

  return (
    <div className="w-full space-y-3">
      {winner && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-1 rounded-md border border-gold-300/60 bg-gold-700/25 px-4 py-3"
        >
          <p className="flex items-center gap-2 font-display text-lg font-bold text-gold-50">
            <Trophy className="h-5 w-5 text-gold-300" /> Ganó {winner.name}
          </p>
          <p className="text-[11px] text-stone-300">
            {game.matchId ? (
              <>
                Verificado con Riot · <span className="font-mono text-gold-100">{game.matchId}</span>
              </>
            ) : (
              "Registrado manualmente"
            )}
          </p>
        </motion.div>
      )}

      {editable && (!winner || !game.matchId) && state.riotMatch && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await send({ type: "match", game: game.number, matchId: gameId }, "Partida verificada con Riot")) setGameId("");
          }}
          className="space-y-2 text-left"
        >
          <label htmlFor="game-id" className="label">
            {winner ? "Verificar con el Game ID" : "Game ID de la partida"}
          </label>
          <div className="flex gap-2">
            <input
              id="game-id"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              placeholder="LA1_1234567890 o solo el número"
              className="field font-mono"
              autoComplete="off"
              required
            />
            <Button type="submit" loading={busy} disabled={gameId.trim().length < 6}>
              <Check className="h-4 w-4" /> Verificar
            </Button>
          </div>
          <p className="text-[11px] text-stone-400">
            Al terminar la partida, en el cliente de LoL abre <b className="text-gold-100">Perfil → Historial</b>, entra a la partida y copia su ID. Riot indica qué lado ganó y la
            victoria se asigna sola (también si en el lobby se cambiaron de lado).
          </p>
        </form>
      )}

      {editable && !winner && state.riotMatch && (
        <button type="button" onClick={() => setManual((v) => !v)} className="text-[11px] text-stone-400 underline-offset-2 hover:text-gold-100 hover:underline">
          {manual ? "Ocultar registro manual" : "¿Riot no encuentra la partida? Registrar el ganador manualmente"}
        </button>
      )}

      {editable && manual && (
        <div className="space-y-2">
          {!state.riotMatch && <p className="text-xs text-stone-400">Sin RIOT_API_KEY no se pueden verificar partidas: elige el ganador.</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {teams.map((t, i) => {
              const won = game.winnerTeamId === t.id;
              const side = i === 0 ? SIDE.BLUE : SIDE.RED;
              return (
                <button
                  key={t.id}
                  disabled={busy}
                  onClick={() => send({ type: "winner", game: game.number, teamId: t.id }, `Ganador del juego ${game.number}: [${t.tag}]`)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-md border-2 px-4 py-2.5 font-display text-sm font-bold tracking-wide transition",
                    won ? "text-void-950" : "text-gold-50 hover:brightness-125",
                  )}
                  style={{ borderColor: side.color, background: won ? side.color : side.soft }}
                >
                  {won && <Trophy className="h-4 w-4" />} Ganó {t.tag}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Marcador de la serie según los ganadores de cada juego, y paso del resultado al ranking. */
function SeriesScore({ state, onSaved }: { state: DraftStateDTO; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const decided = state.games.filter((g) => g.winnerTeamId);
  if (!decided.length) return null;
  const mine = decided.filter((g) => g.winnerTeamId === state.myTeam.id).length;
  const theirs = decided.length - mine;
  const pending = state.games.some((g) => !g.winnerTeamId);
  const done = state.scrim.status === "COMPLETED";
  const started = Date.parse(state.scrim.startAt) <= Date.now();
  const canSave = state.canAct && state.scrim.status === "CONFIRMED" && !pending && started;

  async function save() {
    if (!window.confirm(`¿Registrar el resultado ${state.myTeam.tag} ${mine} - ${theirs} ${state.rival.tag} en el ranking? Ya no se podrá cambiar.`)) return;
    setSaving(true);
    try {
      await api(`/api/scrims/${state.scrim.id}/result`, { body: { myScore: mine, opponentScore: theirs } });
      toast.success("Resultado registrado en el ranking");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="hex-panel flex flex-col items-center gap-4 p-5 sm:flex-row sm:justify-between">
      <div className="flex items-center gap-4">
        <TeamEmblem team={state.myTeam} size={44} />
        <p className="font-display text-3xl font-bold tabular-nums text-gold-50">
          <span className={mine > theirs ? "text-win" : ""}>{mine}</span>
          <span className="mx-2 text-stone-400">-</span>
          <span className={theirs > mine ? "text-blood" : ""}>{theirs}</span>
        </p>
        <TeamEmblem team={state.rival} size={44} />
      </div>
      <div className="text-center sm:text-right">
        {done ? (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-win">
            <Check className="h-4 w-4" /> Resultado del scrim registrado en el ranking
          </p>
        ) : canSave ? (
          <Button onClick={save} loading={saving}>
            <Trophy className="h-4 w-4" /> Registrar en el ranking
          </Button>
        ) : (
          <p className="max-w-xs text-xs text-stone-400">
            {pending
              ? "Falta el Game ID (o el ganador) de algún juego para cerrar la serie."
              : !started
                ? "El resultado se puede registrar cuando haya empezado el horario del scrim."
                : "Solo el staff puede registrar el resultado."}
          </p>
        )}
      </div>
    </div>
  );
}
