"use client";
import { motion } from "framer-motion";
import { Crown, Info, Lock, Medal, TrendingDown, TrendingUp, Users } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/client";
import { POSITIONS, type Position } from "@/lib/lol";
import type { RankedPlayer } from "@/lib/player-ranking";
import { EmptyState, PageHeader, Skeleton, TeamEmblem } from "../ui/misc";
import { PositionBadge } from "../team/team-profile";

type Filter = Position | "ALL";
type Response = { players: RankedPlayer[]; minGames: number; kdaMatches: number; source: "riot" | "demo" };

const FILTERS: { id: Filter; label: string }[] = [{ id: "ALL", label: "Todos" }, ...POSITIONS.filter((p) => p.id !== "SUB").map((p) => ({ id: p.id as Filter, label: p.label }))];

const wrColor = (wr: number) => (wr >= 60 ? "#2DD4A8" : wr >= 52 ? "#C8AA6E" : wr >= 48 ? "#A09B8C" : "#E84057");
const kdaColor = (k: number | null) => (k == null ? "#7B7A72" : k >= 4 ? "#F4C874" : k >= 3 ? "#2DD4A8" : k >= 2 ? "#F0E6D2" : "#A09B8C");

export function PlayersRanking() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const { data, isLoading } = useSWR<Response>(`/api/players/ranking?position=${filter}`, { keepPreviousData: true });
  const players = data?.players ?? [];
  const podium = players.slice(0, 3);

  return (
    <>
      <PageHeader
        eyebrow="Ranking de jugadores"
        title="Quiénes destacan"
        description={`Top de la plataforma por win rate en SoloQ (mínimo ${data?.minGames ?? 20} partidas), con el KDA de sus últimas ${data?.kdaMatches ?? 20} partidas y cómo ha evolucionado su win rate.`}
      />

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div role="radiogroup" aria-label="Filtrar por rol" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="radio"
              aria-checked={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors duration-100",
                filter === f.id ? "border-gold-200 bg-gold-200 text-void-950" : "border-void-500 text-stone-300 hover:border-gold-500 hover:text-gold-50",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-stone-400">
          <Lock className="h-3.5 w-3.5" /> Solo Riot ID, equipo, KDA y win rate: el op.gg y el roster completo siguen siendo privados
        </p>
      </div>

      {data?.source === "demo" && (
        <p className="mb-5 flex items-start gap-2 rounded-md border border-gold-300/40 bg-gold-700/15 px-4 py-3 text-xs text-stone-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-200" />
          Datos de demostración: sin <code className="text-gold-100">RIOT_API_KEY</code> configurada, el win rate, el KDA y la evolución salen de datos de prueba. Con la
          clave, se llenan desde la API de Riot al usar «Actualizar rangos» en cada equipo.
        </p>
      )}

      {isLoading && !data ? (
        <div className="space-y-4">
          <Skeleton className="h-56" />
          <Skeleton className="h-96" />
        </div>
      ) : players.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="Aún no hay jugadores en el ranking" text={`Entran los jugadores con al menos ${data?.minGames ?? 20} partidas de SoloQ sincronizadas.`} />
      ) : (
        <div className={cn("space-y-8 transition-opacity duration-150", isLoading && "opacity-60")}>
          <Podium players={podium} />
          <Table players={players} />
        </div>
      )}
    </>
  );
}

function Sparkline({ data, w = 96, h = 28 }: { data: number[]; w?: number; h?: number }) {
  if (data.length < 2) return <span className="text-[10px] text-stone-400">Sin historial</span>;
  const min = Math.min(...data) - 1;
  const max = Math.max(...data) + 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * (w - 4) + 2, h - 2 - ((v - min) / (max - min)) * (h - 4)]);
  const up = data[data.length - 1] >= data[0];
  const color = up ? "#2DD4A8" : "#E84057";
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label={`Win rate de ${data[0]}% a ${data[data.length - 1]}%`}>
      <path d={`${d} L${pts.at(-1)![0]},${h} L${pts[0][0]},${h} Z`} fill={color} fillOpacity={0.12} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r={2.2} fill={color} />
    </svg>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value == null) return null;
  const up = value >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-semibold", up ? "text-win" : "text-blood")}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}
      {value} pts
    </span>
  );
}

function Podium({ players }: { players: RankedPlayer[] }) {
  // Orden visual: 2.º, 1.º, 3.º
  const order = [players[1], players[0], players[2]].filter(Boolean);
  const style: Record<number, { h: string; ring: string; icon: React.ReactNode }> = {
    1: { h: "md:pt-0", ring: "border-gold-300 shadow-gold", icon: <Crown className="h-6 w-6 text-gold-300 drop-shadow-[0_0_10px_#C89B3C]" /> },
    2: { h: "md:pt-10", ring: "border-stone-300/60", icon: <Medal className="h-5 w-5 text-stone-300" /> },
    3: { h: "md:pt-16", ring: "border-[#C86B3C]/70", icon: <Medal className="h-5 w-5 text-[#C86B3C]" /> },
  };
  return (
    <div className="grid items-end gap-4 md:grid-cols-3">
      {order.map((p, i) => {
        const s = style[p.rank];
        return (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + (p.rank === 1 ? 0.12 : i * 0.06), duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={cn(s.h, p.rank === 1 && "order-first md:order-none")}
          >
            <div className={cn("hex-panel relative overflow-hidden border p-5 text-center", s.ring)}>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(260px_90px_at_50%_0%,rgba(200,155,60,.18),transparent)]" />
              <div className="relative flex flex-col items-center">
                {s.icon}
                <p className="mt-1 font-display text-4xl font-bold text-gold-50">{p.rank}</p>
                <p className="mt-2 max-w-full truncate text-base font-bold text-gold-50">
                  {p.gameName}
                  <span className="font-normal text-stone-400">#{p.tagLine}</span>
                </p>
                <p className="mt-1 flex items-center gap-2 text-xs text-stone-300">
                  <TeamEmblem team={p.team} size={20} /> {p.team.name}
                  <PositionBadge position={p.position} />
                </p>
                <div className="mt-4 grid w-full grid-cols-3 gap-2">
                  <Stat label="Win rate" value={`${p.winRate}%`} color={wrColor(p.winRate)} />
                  <Stat label="KDA" value={p.kda?.toFixed(1) ?? "—"} color={kdaColor(p.kda)} />
                  <Stat label="Partidas" value={String(p.games)} />
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Sparkline data={p.trend} w={140} h={34} />
                  <Delta value={p.delta} />
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-md bg-void-950/60 py-2">
      <p className="font-display text-lg font-bold" style={{ color: color ?? "#F0E6D2" }}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-stone-400">{label}</p>
    </div>
  );
}

function Table({ players }: { players: RankedPlayer[] }) {
  return (
    <div className="hex-panel overflow-hidden">
      <p className="border-b border-void-500/60 p-4 font-display text-sm font-semibold uppercase tracking-widest text-gold-200">Top {players.length}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-stone-400">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Jugador</th>
              <th className="px-4 py-3">Equipo</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3 text-center">KDA</th>
              <th className="px-4 py-3">Win rate</th>
              <th className="px-4 py-3 text-center">Partidas</th>
              <th className="px-4 py-3">Evolución</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <motion.tr
                key={p.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i, 12) * 0.02, duration: 0.18 }}
                className={cn("border-t border-void-500/40 transition-colors duration-100 hover:bg-gold-200/[0.04]", p.rank <= 3 && "bg-gold-700/10")}
              >
                <td className={cn("px-4 py-2.5 font-display text-base font-bold", p.rank === 1 ? "text-gold-300" : p.rank <= 3 ? "text-gold-100" : "text-stone-300")}>{p.rank}</td>
                <td className="px-4 py-2.5">
                  <span className="font-semibold text-gold-50">{p.gameName}</span>
                  <span className="text-stone-400">#{p.tagLine}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2 text-stone-200">
                    <TeamEmblem team={p.team} size={24} />
                    <span className="truncate">{p.team.name}</span>
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <PositionBadge position={p.position} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <p className="font-display font-bold" style={{ color: kdaColor(p.kda) }}>
                    {p.kda?.toFixed(1) ?? "—"}
                  </p>
                  {p.avg && (
                    <p className="text-[10px] text-stone-400">
                      {p.avg.kills} / {p.avg.deaths} / {p.avg.assists}
                    </p>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-void-600">
                      <div className="h-full rounded-full" style={{ width: `${p.winRate}%`, background: wrColor(p.winRate) }} />
                    </div>
                    <span className="font-display font-bold" style={{ color: wrColor(p.winRate) }}>
                      {p.winRate}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-center text-stone-300">{p.games}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkline data={p.trend} />
                    <Delta value={p.delta} />
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
