"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, Clock, Gamepad2, Inbox, Link2, Swords, Trophy, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import type { ScrimDTO } from "@/lib/constants";
import type { LeaderboardRow } from "@/lib/leaderboard";
import { fmtFull } from "@/lib/dates";
import { tierFor } from "@/lib/elo";
import { cn } from "@/lib/client";
import { useShell } from "../app-shell";
import { EmptyState, Skeleton, StatCard, TeamEmblem } from "../ui/misc";
import { Button } from "../ui/button";
import { ScrimCard } from "../scrims/scrim-card";
import { scrimState } from "../scrims/use-scrim-actions";

function useCountdown(target?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!target) return null;
  const diff = Math.max(0, new Date(target).getTime() - now);
  return {
    live: diff === 0,
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff / 3600000) % 24),
    m: Math.floor((diff / 60000) % 60),
    s: Math.floor((diff / 1000) % 60),
  };
}

/** Contador aislado: su tick de 1 s solo re-renderiza este bloque, no todo el dashboard. */
function Countdown({ target }: { target: string }) {
  const cd = useCountdown(target)!;
  if (cd.live)
    return (
      <p className="mt-4 flex items-center gap-2 font-display text-xl font-bold text-hex-200">
        <span className="h-2.5 w-2.5 animate-ping rounded-full bg-hex-200" /> EN CURSO
      </p>
    );
  return (
    <div className="mt-4 grid grid-cols-4 gap-2 text-center">
      {(
        [
          ["d", cd.d],
          ["h", cd.h],
          ["m", cd.m],
          ["s", cd.s],
        ] as const
      ).map(([k, v]) => (
        <div key={k} className="rounded bg-void-800 py-2">
          <motion.p key={v} initial={{ y: -4, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.15 }} className="font-display text-xl font-bold tabular-nums text-gold-50">
            {String(v).padStart(2, "0")}
          </motion.p>
          <p className="text-[10px] uppercase text-stone-400">{k}</p>
        </div>
      ))}
    </div>
  );
}

export function DashboardView() {
  const { user, openCreate, openDetail } = useShell();
  const upcoming = useSWR<{ scrims: ScrimDTO[] }>("/api/scrims?scope=upcoming");
  const requests = useSWR<{ scrims: ScrimDTO[] }>("/api/scrims?scope=requests");
  const board = useSWR<{ teams: LeaderboardRow[] }>("/api/leaderboard");

  const next = upcoming.data?.scrims[0];
  const me = board.data?.teams.find((t) => t.id === user.team.id);
  const actionable = (requests.data?.scrims ?? []).filter((s) => scrimState(s).awaitingMe || scrimState(s).proposalForMe);
  const tier = tierFor(me?.rating ?? user.team.rating);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="hex-panel relative overflow-hidden p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgba(200,155,60,.16),transparent)]" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(10,200,185,.14),transparent)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-center gap-5">
            <TeamEmblem team={user.team} size={84} className="animate-float" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-hex-200">Bienvenido, {user.username}</p>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-wide text-gold-50 sm:text-4xl">{user.team.name}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-stone-300">
                <span className="font-semibold" style={{ color: tier.color }}>
                  {tier.name}
                </span>
                <span>·</span>
                <span>{me?.rating ?? user.team.rating} pts</span>
                {me && (
                  <>
                    <span>·</span>
                    <span>Puesto #{me.rank}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="rounded-md border border-gold-500/50 bg-void-950/60 p-5 lg:min-w-[340px]">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-200">
              <Clock className="h-3.5 w-3.5" /> Próximo scrim
            </p>
            {upcoming.isLoading ? (
              <Skeleton className="mt-3 h-20" />
            ) : next ? (
              <button className="mt-3 w-full text-left" onClick={() => openDetail(next.id)}>
                <div className="flex items-center gap-3">
                  <TeamEmblem team={next.opponent} size={40} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gold-50">vs {next.opponent.name}</p>
                    <p className="truncate text-xs text-stone-400 first-letter:uppercase">{fmtFull(next.startAt, next.endAt)}</p>
                  </div>
                </div>
                <Countdown target={next.startAt} />
                <div className="mt-3 flex items-center gap-3 text-xs text-stone-300">
                  <span className="flex items-center gap-1">
                    <Gamepad2 className="h-3.5 w-3.5 text-gold-200" /> {next.games} juegos
                  </span>
                  <span className={cn("flex items-center gap-1", next.roomLink ? "text-hex-100" : "text-stone-400")}>
                    <Link2 className="h-3.5 w-3.5" /> {next.roomLink ? "Sala lista" : "Sin link de sala"}
                  </span>
                </div>
              </button>
            ) : (
              <div className="mt-3">
                <p className="text-sm text-stone-300">No hay scrims confirmados.</p>
                <Button size="sm" className="mt-3" onClick={() => openCreate()}>
                  Agendar ahora
                </Button>
              </div>
            )}
          </div>
        </div>
      </motion.section>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Rating" value={me?.rating ?? user.team.rating} hint={me ? `Puesto #${me.rank} de ${board.data!.teams.length}` : "—"} icon={<Trophy className="h-4 w-4" />} />
        <StatCard label="Win rate" value={`${me?.winRate ?? 0}%`} hint={me ? `${me.gamesWon}V - ${me.gamesLost}D en juegos` : "—"} icon={<TrendingUp className="h-4 w-4" />} accent="hex" delay={0.05} />
        <StatCard label="Confirmados" value={upcoming.data?.scrims.length ?? "–"} hint="Scrims por jugar" icon={<CalendarDays className="h-4 w-4" />} delay={0.1} />
        <StatCard label="Por responder" value={actionable.length} hint="Solicitudes y re-agendas" icon={<Inbox className="h-4 w-4" />} accent="hex" delay={0.15} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {actionable.length > 0 && (
            <Section title="Requieren tu respuesta" href="/scrims?tab=requests">
              <div className="space-y-2">
                {actionable.slice(0, 4).map((s, i) => (
                  <ScrimCard key={s.id} scrim={s} index={i} />
                ))}
              </div>
            </Section>
          )}
          <Section title="Agenda de la semana" href="/calendar">
            {upcoming.isLoading ? (
              <Skeleton className="h-40" />
            ) : upcoming.data?.scrims.length ? (
              <div className="space-y-2">
                {upcoming.data.scrims.slice(0, 5).map((s, i) => (
                  <ScrimCard key={s.id} scrim={s} index={i} />
                ))}
              </div>
            ) : (
              <EmptyState icon={<Swords className="h-6 w-6" />} title="Agenda libre" text="Selecciona un rival desde el ranking o el calendario para retarlo." action={<Button onClick={() => openCreate()}>Agendar scrim</Button>} />
            )}
          </Section>
        </div>

        <Section title="Top 5" href="/leaderboard">
          <div className="hex-panel divide-y divide-void-500/40">
            {board.isLoading && <Skeleton className="m-4 h-60" />}
            {board.data?.teams.slice(0, 5).map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className={cn("flex items-center gap-3 px-4 py-3", t.id === user.team.id && "bg-hex-500/25")}
              >
                <span className={cn("w-6 font-display text-lg font-bold", i === 0 ? "text-gold-300" : "text-stone-300")}>{t.rank}</span>
                <TeamEmblem team={t} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gold-50">{t.name}</p>
                  <p className="text-[11px]" style={{ color: t.tierColor }}>
                    {t.tier}
                  </p>
                </div>
                <span className="font-display font-bold text-gold-100">{t.rating}</span>
              </motion.div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-gold-200">{title}</h2>
        <Link href={href} className="group flex items-center gap-1 text-xs text-stone-300 transition hover:text-gold-50">
          Ver todo <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
      {children}
    </section>
  );
}
