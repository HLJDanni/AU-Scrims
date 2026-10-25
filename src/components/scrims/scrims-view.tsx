"use client";
import { AnimatePresence } from "framer-motion";
import { History, Inbox, Plus, Search, Send, Swords, Repeat2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";
import type { ScrimDTO } from "@/lib/constants";
import { fmtDay } from "@/lib/dates";
import { cn } from "@/lib/client";
import { Tabs, TabPanel } from "../ui/tabs";
import { EmptyState, PageHeader, Skeleton, StatCard } from "../ui/misc";
import { Button } from "../ui/button";
import { useShell } from "../app-shell";
import { ScrimCard } from "./scrim-card";
import { scrimState } from "./use-scrim-actions";

type Tab = "upcoming" | "requests" | "history";
type ReqSection = "received" | "sent" | "reschedules";
type HistFilter = "all" | "won" | "lost" | "cancelled";

export function ScrimsView() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) || "upcoming";
  const setTab = (t: Tab) => router.replace(`/scrims?tab=${t}`, { scroll: false });

  const upcoming = useSWR<{ scrims: ScrimDTO[] }>("/api/scrims?scope=upcoming");
  const requests = useSWR<{ scrims: ScrimDTO[] }>("/api/scrims?scope=requests");
  const history = useSWR<{ scrims: ScrimDTO[] }>(tab === "history" ? "/api/scrims?scope=history" : null);

  const incoming = (requests.data?.scrims ?? []).filter((s) => scrimState(s).awaitingMe || scrimState(s).proposalForMe).length;
  const { openCreate } = useShell();

  return (
    <>
      <PageHeader
        eyebrow="Gestión de scrims"
        title="Scrims del equipo"
        description="Solo el staff (coach, analista y capitán) de tu equipo ve esta información."
        actions={
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4" /> Agendar scrim
          </Button>
        }
      />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        className="mb-6"
        tabs={[
          { id: "upcoming", label: "Próximos", icon: <Swords className="h-4 w-4" />, count: upcoming.data?.scrims.length },
          { id: "requests", label: "Solicitudes", icon: <Inbox className="h-4 w-4" />, count: incoming },
          { id: "history", label: "Historial", icon: <History className="h-4 w-4" /> },
        ]}
      />
      <TabPanel id={tab}>
        {tab === "upcoming" && <Upcoming list={upcoming.data?.scrims} />}
        {tab === "requests" && <Requests list={requests.data?.scrims} />}
        {tab === "history" && <HistoryTab list={history.data?.scrims} />}
      </TabPanel>
    </>
  );
}

function Loading() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-20" />
      ))}
    </div>
  );
}

/** Agrupa por día para una lectura tipo agenda. */
function groupByDay(list: ScrimDTO[]) {
  const map = new Map<string, ScrimDTO[]>();
  for (const s of list) {
    const k = new Date(s.startAt).toDateString();
    map.set(k, [...(map.get(k) ?? []), s]);
  }
  return [...map.entries()];
}

function Upcoming({ list }: { list?: ScrimDTO[] }) {
  const { openCreate } = useShell();
  if (!list) return <Loading />;
  if (!list.length)
    return (
      <EmptyState
        icon={<Swords className="h-6 w-6" />}
        title="No hay scrims confirmados"
        text="Agenda un scrim o revisa las solicitudes pendientes."
        action={<Button onClick={() => openCreate()}>Agendar scrim</Button>}
      />
    );
  return (
    <div className="space-y-7">
      {groupByDay(list).map(([day, items]) => (
        <section key={day}>
          <h3 className="mb-3 flex items-center gap-3 font-display text-sm font-semibold capitalize tracking-wider text-gold-200">
            {fmtDay(items[0].startAt)}
            <span className="h-px flex-1 bg-gradient-to-r from-gold-500/50 to-transparent" />
          </h3>
          <div className="space-y-2">
            <AnimatePresence>
              {items.map((s, i) => (
                <ScrimCard key={s.id} scrim={s} index={i} />
              ))}
            </AnimatePresence>
          </div>
        </section>
      ))}
    </div>
  );
}

function Requests({ list }: { list?: ScrimDTO[] }) {
  const [section, setSection] = useState<ReqSection>("received");
  const groups = useMemo(() => {
    const all = list ?? [];
    return {
      received: all.filter((s) => s.status === "PENDING" && !s.isHost),
      sent: all.filter((s) => s.status === "PENDING" && s.isHost),
      reschedules: all.filter((s) => s.proposal),
    };
  }, [list]);
  if (!list) return <Loading />;

  const items = groups[section];
  const sections: { id: ReqSection; label: string; icon: React.ReactNode; hint: string }[] = [
    { id: "received", label: "Recibidas", icon: <Inbox className="h-4 w-4" />, hint: "Equipos que quieren jugar contra ustedes" },
    { id: "sent", label: "Enviadas", icon: <Send className="h-4 w-4" />, hint: "Esperando respuesta del rival" },
    { id: "reschedules", label: "Re-agendas", icon: <Repeat2 className="h-4 w-4" />, hint: "Propuestas de cambio de horario" },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <div className="flex gap-2 overflow-x-auto lg:flex-col">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={cn(
              "flex min-w-max items-center gap-3 rounded-md border px-4 py-3 text-left transition-all duration-200",
              section === s.id ? "border-gold-300/70 bg-gold-700/25 text-gold-50 shadow-gold" : "border-void-500/70 text-stone-300 hover:border-gold-500",
            )}
          >
            <span className={section === s.id ? "text-gold-200" : ""}>{s.icon}</span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">{s.label}</span>
              <span className="hidden text-[11px] text-stone-400 lg:block">{s.hint}</span>
            </span>
            <span className="rounded-full bg-void-600 px-2 py-0.5 text-[11px]">{groups[s.id].length}</span>
          </button>
        ))}
      </div>
      <TabPanel id={section}>
        {items.length ? (
          <div className="space-y-2">
            <AnimatePresence>
              {items.map((s, i) => (
                <ScrimCard key={s.id} scrim={s} index={i} />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <EmptyState icon={sections.find((s) => s.id === section)!.icon} title="Nada por aquí" text={sections.find((s) => s.id === section)!.hint} />
        )}
      </TabPanel>
    </div>
  );
}

function HistoryTab({ list }: { list?: ScrimDTO[] }) {
  const [filter, setFilter] = useState<HistFilter>("all");
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (list ?? []).filter((s) => {
      if (term && !s.opponent.name.toLowerCase().includes(term) && !s.opponent.tag.toLowerCase().includes(term)) return false;
      if (filter === "won") return s.status === "COMPLETED" && s.myScore! > s.opponentScore!;
      if (filter === "lost") return s.status === "COMPLETED" && s.myScore! < s.opponentScore!;
      if (filter === "cancelled") return s.status === "CANCELLED" || s.status === "DECLINED" || scrimState(s).expired;
      return true;
    });
  }, [list, filter, q]);
  if (!list) return <Loading />;

  const completed = list.filter((s) => s.status === "COMPLETED");
  const won = completed.filter((s) => s.myScore! > s.opponentScore!).length;
  const gw = completed.reduce((a, s) => a + (s.myScore ?? 0), 0);
  const gl = completed.reduce((a, s) => a + (s.opponentScore ?? 0), 0);
  const delta = completed.reduce((a, s) => a + (s.ratingDelta ?? 0), 0);
  const pendingResult = list.filter((s) => scrimState(s).canReport).length;

  const filters: { id: HistFilter; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "won", label: "Victorias" },
    { id: "lost", label: "Derrotas" },
    { id: "cancelled", label: "Cancelados" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Scrims jugados" value={completed.length} hint={`${won} ganados`} />
        <StatCard label="Juegos" value={`${gw}-${gl}`} hint={gw + gl ? `${Math.round((gw / (gw + gl)) * 100)}% win rate` : "Sin juegos"} delay={0.05} accent="hex" />
        <StatCard label="Puntos de ranking" value={`${delta >= 0 ? "+" : ""}${delta}`} hint="Acumulado en historial" delay={0.1} />
        <StatCard label="Sin resultado" value={pendingResult} hint="Registra el marcador" delay={0.15} accent="hex" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition",
                filter === f.id ? "border-gold-200 bg-gold-200 text-void-950" : "border-void-500 text-stone-300 hover:border-gold-500 hover:text-gold-50",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input className="field pl-9" placeholder="Buscar rival…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {rows.length ? (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {rows.map((s, i) => (
              <ScrimCard key={s.id} scrim={s} index={i} />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <EmptyState icon={<History className="h-6 w-6" />} title="Sin scrims en el historial" text="Aquí aparecerán los scrims jugados, cancelados y rechazados." />
      )}
    </div>
  );
}
