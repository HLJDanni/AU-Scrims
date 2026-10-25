"use client";
// Bracket suizo estilo Mundial: cada ronda es una columna y cada récord (2-0, 1-1, 0-2…) se ubica más arriba
// o más abajo según qué tan bien van esos equipos. Las líneas verdes llevan al ganador hacia arriba y las rojas
// al perdedor hacia abajo; a la derecha quedan los clasificados (3-x) y los eliminados (x-3).
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, MousePointer2, Trophy, XCircle } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/client";
import { LOSSES_TO_ELIMINATE, WINS_TO_QUALIFY } from "@/lib/swiss";
import { TeamEmblem } from "../ui/misc";
import type { MatchDTO, TournamentDetail } from "./types";

type Rec = { w: number; l: number };
const parse = (r: string): Rec => {
  const [w, l] = r.split("-").map(Number);
  return { w, l };
};
const recKey = (r: Rec) => `${r.w}-${r.l}`;
const ROWS = WINS_TO_QUALIFY + LOSSES_TO_ELIMINATE - 1; // diferencias posibles en juego: +2 … -2
const rowFor = (r: Rec) => 2 + (WINS_TO_QUALIFY - 1 - (r.w - r.l)); // fila 1 = encabezados

type Group = { round: number; rec: Rec; matches: MatchDTO[]; placeholder: boolean };

function groupLabel(rec: Rec) {
  const toQualify = rec.w === WINS_TO_QUALIFY - 1;
  const toElim = rec.l === LOSSES_TO_ELIMINATE - 1;
  if (toQualify && toElim) return { text: "Todo o nada", cls: "text-gold-300" };
  if (toQualify) return { text: "Por la clasificación", cls: "text-win" };
  if (toElim) return { text: "Por no quedar fuera", cls: "text-blood" };
  return null;
}

export function SwissBracket({ data, onReport }: { data: TournamentDetail; onReport: (m: MatchDTO) => void }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<{ d: string; win: boolean; key: string }[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<string | null>(null);

  const totalRounds =
    data.tournament.status === "FINISHED" ? data.rounds.length : Math.max(WINS_TO_QUALIFY + LOSSES_TO_ELIMINATE - 1, data.rounds.length);

  // Grupos reales (por récord previo al partido) y huecos de rondas futuras para ver la forma completa
  const groups = useMemo<Group[]>(() => {
    const out: Group[] = [];
    for (let round = 1; round <= totalRounds; round++) {
      const real = data.rounds.find((r) => r.round === round);
      if (real) {
        const map = new Map<string, MatchDTO[]>();
        for (const m of real.matches) map.set(m.recordA, [...(map.get(m.recordA) ?? []), m]);
        for (const [k, matches] of map) out.push({ round, rec: parse(k), matches, placeholder: false });
      } else if (data.tournament.status !== "FINISHED") {
        for (let w = 0; w < WINS_TO_QUALIFY; w++) {
          const l = round - 1 - w;
          if (l >= 0 && l < LOSSES_TO_ELIMINATE) out.push({ round, rec: { w, l }, matches: [], placeholder: true });
        }
      }
    }
    return out;
  }, [data, totalRounds]);

  const edges = useMemo(() => {
    const out = new Map<string, { from: string; to: string; win: boolean }>();
    const add = (from: string, to: string, win: boolean) => out.set(`${from}>${to}`, { from, to, win });
    const next = (round: number, rec: Rec) =>
      rec.w >= WINS_TO_QUALIFY ? `Q:${recKey(rec)}` : rec.l >= LOSSES_TO_ELIMINATE ? `E:${recKey(rec)}` : `${round + 1}:${recKey(rec)}`;
    // Dónde aparece cada equipo en cada ronda
    const where = new Map<string, string>();
    for (const g of groups)
      for (const m of g.matches) {
        where.set(`${g.round}|${m.teamA.id}`, `${g.round}:${recKey(g.rec)}`);
        if (m.teamB) where.set(`${g.round}|${m.teamB.id}`, `${g.round}:${recKey(g.rec)}`);
      }
    for (const g of groups) {
      const from = `${g.round}:${recKey(g.rec)}`;
      const shape = () => {
        add(from, next(g.round, { w: g.rec.w + 1, l: g.rec.l }), true);
        add(from, next(g.round, { w: g.rec.w, l: g.rec.l + 1 }), false);
      };
      if (g.placeholder) shape();
      for (const m of g.matches) {
        if (!m.winnerId) {
          shape();
          continue;
        }
        const sides: [string, string | null][] = [[m.teamA.id, m.recordA], ...(m.teamB ? ([[m.teamB.id, m.recordB]] as [string, string | null][]) : [])];
        for (const [teamId, before] of sides) {
          const r = parse(before ?? recKey(g.rec));
          const won = m.winnerId === teamId;
          const after = won ? { w: r.w + 1, l: r.l } : { w: r.w, l: r.l + 1 };
          const target = after.w >= WINS_TO_QUALIFY || after.l >= LOSSES_TO_ELIMINATE ? next(g.round, after) : (where.get(`${g.round + 1}|${teamId}`) ?? next(g.round, after));
          add(from, target, won);
        }
      }
    }
    return [...out.values()];
  }, [groups]);

  const qualified = useMemo(() => buckets(data, "QUALIFIED"), [data]);
  const eliminated = useMemo(() => buckets(data, "ELIMINATED"), [data]);
  const exitCol = totalRounds + 1;

  // Conectores: se miden las cajas ya pintadas y se trazan curvas entre ellas
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const draw = () => {
      const base = grid.getBoundingClientRect();
      const node = (key: string) => grid.querySelector<HTMLElement>(`[data-node="${key}"]`);
      const out: { d: string; win: boolean; key: string }[] = [];
      for (const e of edges) {
        const from = node(e.from);
        const to = node(e.to);
        if (!from || !to) continue;
        {
          const win = e.win;
          const a = from.getBoundingClientRect();
          const b = to.getBoundingClientRect();
          const x1 = a.right - base.left;
          const y1 = a.top - base.top + a.height / 2 + (win ? -6 : 6);
          const x2 = b.left - base.left;
          const y2 = b.top - base.top + Math.min(b.height / 2, 28);
          const mid = (x1 + x2) / 2;
          out.push({ d: `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`, win, key: `${e.from}>${e.to}` });
        }
      }
      setPaths(out);
      setSize({ w: grid.scrollWidth, h: grid.scrollHeight });
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(grid);
    return () => ro.disconnect();
  }, [edges, qualified, eliminated]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-stone-300">
        <span className="flex items-center gap-1.5">
          <ArrowUpRight className="h-3.5 w-3.5 text-win" /> El ganador sube
        </span>
        <span className="flex items-center gap-1.5">
          <ArrowDownRight className="h-3.5 w-3.5 text-blood" /> El perdedor baja
        </span>
        <span className="flex items-center gap-1.5">
          <span className="rounded border border-gold-300/60 px-1 text-[9px] font-bold text-gold-300">BO3</span> Partido decisivo
        </span>
        <span className="flex items-center gap-1.5 text-stone-400">
          <MousePointer2 className="h-3.5 w-3.5" /> Pasa el cursor por un equipo para ver su camino
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border border-void-500/60 bg-void-950/50 p-4">
        <div
          ref={gridRef}
          className="relative grid w-max"
          style={{
            gridTemplateColumns: `repeat(${totalRounds}, 13.5rem) 12rem`,
            gridTemplateRows: `auto repeat(${ROWS}, minmax(3rem, auto))`,
            columnGap: "2.25rem",
            rowGap: "1rem",
          }}
          onMouseLeave={() => setHover(null)}
        >
          <svg className="pointer-events-none absolute left-0 top-0" width={size.w} height={size.h} aria-hidden>
            {paths.map((p) => (
              <path key={p.key} d={p.d} fill="none" stroke={p.win ? "#2DD4A8" : "#E84057"} strokeOpacity={0.45} strokeWidth={1.6} strokeDasharray={p.win ? undefined : "4 3"} />
            ))}
          </svg>

          {Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => {
            const current = data.tournament.status === "ACTIVE" && round === data.tournament.round;
            return (
              <div key={`h${round}`} style={{ gridColumn: round, gridRow: 1 }} className="pb-1">
                <p className={cn("font-display text-xs font-bold uppercase tracking-[0.2em]", current ? "text-hex-200" : "text-gold-200")}>
                  Ronda {round}
                  {current && " · en juego"}
                </p>
              </div>
            );
          })}
          <div style={{ gridColumn: exitCol, gridRow: 1 }} className="pb-1">
            <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-gold-200">Resultado</p>
          </div>

          {groups.map((g) => (
            <GroupBox key={`${g.round}:${recKey(g.rec)}`} group={g} me={data.me.teamId} hover={hover} onHover={setHover} onReport={onReport} />
          ))}

          <div style={{ gridColumn: exitCol, gridRow: `2 / span ${ROWS}` }} className="relative z-10 flex flex-col justify-between gap-4">
            <ExitBoxes kind="Q" groups={qualified} hover={hover} onHover={setHover} />
            <ExitBoxes kind="E" groups={eliminated} hover={hover} onHover={setHover} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Equipos clasificados o eliminados agrupados por su récord final (3-0, 3-1, 3-2 / 0-3, 1-3, 2-3). */
type ExitBucket = { rec: Rec; teams: TournamentDetail["table"][number]["team"][] };

function buckets(data: TournamentDetail, status: "QUALIFIED" | "ELIMINATED"): ExitBucket[] {
  const recs =
    status === "QUALIFIED"
      ? Array.from({ length: LOSSES_TO_ELIMINATE }, (_, l) => ({ w: WINS_TO_QUALIFY, l }))
      : Array.from({ length: WINS_TO_QUALIFY }, (_, w) => ({ w: WINS_TO_QUALIFY - 1 - w, l: LOSSES_TO_ELIMINATE }));
  return recs.map((rec) => ({
    rec,
    teams: data.table.filter((e) => e.status === status && e.wins === rec.w && e.losses === rec.l).map((e) => e.team),
  }));
}

function ExitBoxes({
  kind,
  groups,
  hover,
  onHover,
}: {
  kind: "Q" | "E";
  groups: ExitBucket[];
  hover: string | null;
  onHover: (id: string | null) => void;
}) {
  const q = kind === "Q";
  return (
    <div className="space-y-2">
      <p className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest", q ? "text-win" : "text-blood")}>
        {q ? <Trophy className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />} {q ? "Clasificados" : "Eliminados"}
      </p>
      {groups.map((b) => (
        <div
          key={recKey(b.rec)}
          data-node={`${kind}:${recKey(b.rec)}`}
          className={cn("rounded-md border p-2", q ? "border-win/35 bg-win/[0.06]" : "border-blood/30 bg-blood/[0.06]", !b.teams.length && "opacity-50")}
        >
          <p className={cn("mb-1 font-display text-sm font-bold", q ? "text-win" : "text-blood")}>{recKey(b.rec)}</p>
          {b.teams.length ? (
            <div className="space-y-1">
              {b.teams.map((t) => (
                <div
                  key={t.id}
                  onMouseEnter={() => onHover(t.id)}
                  className={cn("flex items-center gap-1.5 rounded px-1 py-0.5 text-xs transition-colors duration-100", hover === t.id ? "bg-gold-300/20 text-gold-50" : "text-stone-200")}
                >
                  <TeamEmblem team={t} size={18} />
                  <span className="truncate">{t.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-stone-400">—</p>
          )}
        </div>
      ))}
    </div>
  );
}

function GroupBox({
  group,
  me,
  hover,
  onHover,
  onReport,
}: {
  group: Group;
  me: string;
  hover: string | null;
  onHover: (id: string | null) => void;
  onReport: (m: MatchDTO) => void;
}) {
  const diff = group.rec.w - group.rec.l;
  const label = groupLabel(group.rec);
  return (
    <motion.div
      data-node={`${group.round}:${recKey(group.rec)}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: group.round * 0.04 }}
      style={{ gridColumn: group.round, gridRow: rowFor(group.rec) }}
      className={cn(
        "relative z-10 self-center rounded-md border p-2",
        group.placeholder
          ? "border-dashed border-void-500 bg-void-950/40"
          : diff > 0
            ? "border-win/30 bg-void-900/95"
            : diff < 0
              ? "border-blood/30 bg-void-900/95"
              : "border-gold-500/50 bg-void-900/95",
      )}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2 px-0.5">
        <span className={cn("font-display text-base font-bold", diff > 0 ? "text-win" : diff < 0 ? "text-blood" : "text-gold-100")}>{recKey(group.rec)}</span>
        {label && <span className={cn("text-[10px] font-semibold uppercase tracking-wider", label.cls)}>{label.text}</span>}
      </div>
      {group.placeholder ? (
        <p className="px-0.5 pb-1 text-[11px] text-stone-400">Por definir</p>
      ) : (
        <div className="space-y-1.5">
          {group.matches.map((m) => (
            <Match key={m.id} m={m} me={me} hover={hover} onHover={onHover} onReport={onReport} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function Match({ m, me, hover, onHover, onReport }: { m: MatchDTO; me: string; hover: string | null; onHover: (id: string | null) => void; onReport: (m: MatchDTO) => void }) {
  const mine = m.teamA.id === me || m.teamB?.id === me;
  const involved = hover && (m.teamA.id === hover || m.teamB?.id === hover);
  const mixed = !m.bye && m.recordB !== null && m.recordB !== m.recordA;
  const Row = ({ team, score, record }: { team: MatchDTO["teamA"]; score: number | null; record?: string | null }) => {
    const won = m.winnerId === team.id;
    const lost = Boolean(m.winnerId) && !won;
    return (
      <div
        onMouseEnter={() => onHover(team.id)}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 transition-colors duration-100",
          hover === team.id && "bg-gold-300/20",
          lost && hover !== team.id && "opacity-45",
        )}
      >
        <TeamEmblem team={team} size={18} />
        <span className={cn("min-w-0 flex-1 truncate text-xs", won ? "font-semibold text-gold-50" : "text-stone-300")}>{team.name}</span>
        {mixed && record && (
          <span className="rounded bg-void-700 px-1 text-[9px] text-stone-300" title="Récord con el que llegó a este partido">
            {record}
          </span>
        )}
        {score !== null && <span className={cn("font-display text-xs font-bold", won ? "text-win" : "text-stone-400")}>{score}</span>}
      </div>
    );
  };
  return (
    <div
      className={cn(
        "overflow-hidden rounded border bg-void-950/80 transition-[border-color,box-shadow] duration-100",
        involved ? "border-gold-300 shadow-gold" : mine ? "border-hex-200/50" : "border-void-500/70",
        hover && !involved && "opacity-60",
      )}
    >
      <Row team={m.teamA} score={m.scoreA} record={m.recordA} />
      {m.bye ? (
        <p className="border-t border-void-500/50 px-2 py-1 text-[10px] italic text-stone-400">Descansa · cuenta como victoria</p>
      ) : (
        <>
          <div className="border-t border-void-500/40" />
          <Row team={m.teamB!} score={m.scoreB} record={m.recordB} />
          <div className="flex items-center justify-between border-t border-void-500/40 bg-void-900/60 px-2 py-0.5">
            <span className={cn("text-[9px] font-bold uppercase tracking-wider", m.bestOf === 3 ? "text-gold-300" : "text-stone-400")}>Bo{m.bestOf}</span>
            {m.canReport ? (
              <button onClick={() => onReport(m)} className="text-[10px] font-semibold text-hex-100 hover:underline">
                Registrar
              </button>
            ) : (
              !m.winnerId && <span className="text-[9px] uppercase tracking-wider text-stone-400">Pendiente</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
