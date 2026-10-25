"use client";
import { motion } from "framer-motion";
import { Crown, Flame, Layers, Medal, Search, Swords, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import type { LeaderboardRow } from "@/lib/leaderboard";
import { TIERS } from "@/lib/elo";
import { cn } from "@/lib/client";
import { Tabs, TabPanel } from "../ui/tabs";
import { EmptyState, PageHeader, Skeleton, TeamEmblem } from "../ui/misc";
import { Button } from "../ui/button";
import { RankIcon } from "../ui/rank-icon";
import { useShell } from "../app-shell";

type Tab = "ranking" | "tiers" | "activity";

export function LeaderboardView() {
  const { data } = useSWR<{ teams: LeaderboardRow[] }>("/api/leaderboard");
  const [tab, setTab] = useState<Tab>("ranking");
  const teams = data?.teams;

  return (
    <>
      <PageHeader
        eyebrow="Temporada actual"
        title="Ranking de equipos"
        description="El rating se calcula con un sistema Elo según el porcentaje de juegos ganados en cada scrim y la fuerza del rival."
      />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        className="mb-6"
        tabs={[
          { id: "ranking", label: "Clasificación", icon: <Trophy className="h-4 w-4" /> },
          { id: "tiers", label: "Divisiones", icon: <Layers className="h-4 w-4" /> },
          { id: "activity", label: "Más activos", icon: <Flame className="h-4 w-4" /> },
        ]}
      />
      {!teams ? (
        <div className="space-y-3">
          <Skeleton className="h-56" />
          <Skeleton className="h-96" />
        </div>
      ) : teams.length === 0 ? (
        <EmptyState icon={<Trophy className="h-6 w-6" />} title="Aún no hay equipos" />
      ) : (
        <TabPanel id={tab}>
          {tab === "ranking" && (
            <div className="space-y-8">
              <Podium teams={teams.slice(0, 3)} />
              <RankTable teams={teams} />
            </div>
          )}
          {tab === "tiers" && <Tiers teams={teams} />}
          {tab === "activity" && <RankTable teams={[...teams].sort((a, b) => b.scrims - a.scrims || b.rating - a.rating)} activity />}
        </TabPanel>
      )}
    </>
  );
}

function Podium({ teams }: { teams: LeaderboardRow[] }) {
  const order = [teams[1], teams[0], teams[2]].filter(Boolean);
  const heights: Record<number, string> = { 1: "h-40", 2: "h-28", 3: "h-20" };
  const icons: Record<number, React.ReactNode> = {
    1: <Crown className="h-6 w-6 text-gold-300 drop-shadow-[0_0_10px_#C89B3C]" />,
    2: <Medal className="h-5 w-5 text-stone-300" />,
    3: <Medal className="h-5 w-5 text-[#C86B3C]" />,
  };
  return (
    <div className="hex-panel overflow-hidden px-4 pt-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_220px_at_50%_100%,rgba(200,155,60,.22),transparent)]" />
      <div className="relative mx-auto flex max-w-3xl items-end justify-center gap-3 sm:gap-6">
        {order.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + (t.rank === 1 ? 0.25 : i * 0.1), type: "spring", stiffness: 180, damping: 18 }}
            className="flex w-1/3 max-w-[200px] flex-col items-center"
          >
            {icons[t.rank]}
            <motion.div whileHover={{ scale: 1.06, rotate: t.rank === 1 ? 0 : i === 0 ? -3 : 3 }} className={cn("mt-2", t.rank === 1 && "animate-float")}>
              <TeamEmblem team={t} size={t.rank === 1 ? 84 : 64} />
            </motion.div>
            <p className="mt-2 max-w-full truncate text-center text-sm font-semibold text-gold-50">{t.name}</p>
            <p className="flex items-center gap-1 font-display text-lg font-bold" style={{ color: t.tierColor }}>
              <RankIcon tier={t.tierIcon} size={24} title={t.tier} />
              {t.rating}
            </p>
            <div
              className={cn(
                "mt-3 flex w-full items-start justify-center rounded-t-md border border-b-0 pt-3 font-display text-3xl font-bold",
                heights[t.rank],
                t.rank === 1 ? "border-gold-300/70 bg-gradient-to-b from-gold-500/40 to-gold-700/10 text-gold-100" : "border-void-500 bg-gradient-to-b from-void-600/80 to-void-800/20 text-stone-300",
              )}
            >
              {t.rank}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Form({ form }: { form: LeaderboardRow["form"] }) {
  return (
    <div className="flex gap-1">
      {form.length === 0 && <span className="text-xs text-stone-400">—</span>}
      {form.map((r, i) => (
        <span
          key={i}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold",
            r === "W" ? "bg-win/20 text-win" : r === "L" ? "bg-blood/20 text-blood" : "bg-void-600 text-stone-300",
          )}
        >
          {r === "W" ? "V" : r === "L" ? "D" : "E"}
        </span>
      ))}
    </div>
  );
}

function RankTable({ teams, activity }: { teams: LeaderboardRow[]; activity?: boolean }) {
  const { user, openCreate } = useShell();
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? teams.filter((r) => r.name.toLowerCase().includes(t) || r.tag.toLowerCase().includes(t)) : teams;
  }, [teams, q]);

  return (
    <div className="hex-panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-void-500/60 p-4">
        <p className="font-display text-sm font-semibold uppercase tracking-widest text-gold-200">{activity ? "Por scrims jugados" : "Tabla general"}</p>
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input className="field h-9 py-1.5 pl-9" placeholder="Buscar equipo…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-stone-400">
              <th className="px-4 py-3 font-semibold">#</th>
              <th className="px-4 py-3 font-semibold">Equipo</th>
              <th className="px-4 py-3 font-semibold">División</th>
              <th className="px-4 py-3 text-right font-semibold">Rating</th>
              <th className="px-4 py-3 text-center font-semibold">Scrims</th>
              <th className="px-4 py-3 text-center font-semibold">Juegos</th>
              <th className="px-4 py-3 font-semibold">Win rate</th>
              <th className="px-4 py-3 font-semibold">Forma</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => {
              const mine = t.id === user.team.id;
              return (
                <motion.tr
                  key={t.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i, 15) * 0.03 }}
                  className={cn("group border-t border-void-500/40 transition-colors hover:bg-gold-200/[0.04]", mine && "bg-hex-500/25")}
                >
                  <td className="px-4 py-3 font-display text-base font-bold text-gold-100">{t.rank}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <TeamEmblem team={t} size={36} />
                      <div>
                        <p className="font-semibold text-gold-50">
                          {t.name}
                          {mine && <span className="ml-2 rounded bg-hex-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-void-950">Tu equipo</span>}
                        </p>
                        <p className="text-[11px] text-stone-400">{t.region}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: t.tierColor }}>
                      <RankIcon tier={t.tierIcon} size={26} />
                      {t.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-display text-base font-bold text-gold-50">{t.rating}</td>
                  <td className="px-4 py-3 text-center text-stone-300">
                    {t.scrimWins}/{t.scrims}
                  </td>
                  <td className="px-4 py-3 text-center text-stone-300">
                    <span className="text-win">{t.gamesWon}</span> - <span className="text-blood">{t.gamesLost}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-void-600">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${t.winRate}%` }}
                          transition={{ delay: 0.2 + i * 0.03, duration: 0.7, ease: "easeOut" }}
                          className="h-full rounded-full bg-gold-gradient"
                        />
                      </div>
                      <span className="text-xs text-stone-300">{t.winRate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Form form={t.form} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!mine && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => openCreate({ opponentTeamId: t.id })}
                      >
                        <Swords className="h-3.5 w-3.5" /> Retar
                      </Button>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tiers({ teams }: { teams: LeaderboardRow[] }) {
  const groups = TIERS.map((tier) => ({ tier, teams: teams.filter((t) => t.tier === tier.name) })).filter((g) => g.teams.length);
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((g, gi) => (
        <motion.div key={g.tier.name} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.06 }} className="hex-panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="flex items-center gap-2 font-display text-lg font-bold tracking-wider" style={{ color: g.tier.color }}>
              <RankIcon tier={g.tier.icon} size={36} />
              {g.tier.name}
            </p>
            <span className="text-xs text-stone-400">{Number.isFinite(g.tier.min) ? `${g.tier.min}+ pts` : "< 5000 pts"}</span>
          </div>
          <div className="space-y-2">
            {g.teams.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-md bg-void-950/50 px-3 py-2">
                <span className="w-6 font-display text-sm font-bold text-stone-300">{t.rank}</span>
                <TeamEmblem team={t} size={30} />
                <span className="flex-1 truncate text-sm text-gold-50">{t.name}</span>
                <span className="font-display text-sm font-bold text-gold-100">{t.rating}</span>
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
