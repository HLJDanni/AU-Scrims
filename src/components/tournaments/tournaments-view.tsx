"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, ChevronRight, ClipboardCheck, Plus, Trophy, XCircle } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { api, cn } from "@/lib/client";
import { DIVISIONS, MIN_RATING, MIN_SCRIM_WINS, type Division } from "@/lib/tournament-rules";
import { fromNow } from "@/lib/dates";
import { Tabs, TabPanel } from "../ui/tabs";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { EmptyState, PageHeader, Skeleton, TeamEmblem } from "../ui/misc";
import { RankIcon } from "../ui/rank-icon";
import { useShell } from "../app-shell";
import { TournamentBoard } from "./tournament-board";
import { STATUS_LABEL, type TeamEligibility, type TournamentSummary } from "./types";

type Tab = Division | "REQUIREMENTS";
type ListResponse = { tournaments: TournamentSummary[]; eligibility: TeamEligibility };

export function TournamentsView() {
  const { data, mutate } = useSWR<ListResponse>("/api/tournaments");
  const [tab, setTab] = useState<Tab | null>(null);
  const current: Tab = tab ?? data?.eligibility.division ?? "ELITE";

  return (
    <>
      <PageHeader
        eyebrow="Mini torneos"
        title="Torneos suizos"
        description={`Formato suizo: 3 victorias clasifican y 3 derrotas eliminan. Pueden jugar los equipos con ${MIN_RATING.toLocaleString("es-MX")} puntos de ranking, ${MIN_SCRIM_WINS} scrims ganados y ELO promedio de Platino II en adelante.`}
      />
      <Tabs<Tab>
        value={current}
        onChange={setTab}
        className="mb-6"
        tabs={[
          { id: "ELITE", label: DIVISIONS.ELITE.short, icon: <RankIcon tier="CHALLENGER" size={18} /> },
          { id: "ASCENSO", label: DIVISIONS.ASCENSO.short, icon: <RankIcon tier="DIAMOND" size={18} /> },
          { id: "REQUIREMENTS", label: "Requisitos", icon: <ClipboardCheck className="h-4 w-4" /> },
        ]}
      />
      {!data ? (
        <Skeleton className="h-96" />
      ) : (
        <TabPanel id={current}>
          {current === "REQUIREMENTS" ? <Requirements mine={data.eligibility} /> : <DivisionPanel division={current} data={data} onChanged={() => mutate()} />}
        </TabPanel>
      )}
    </>
  );
}

function DivisionPanel({ division, data, onChanged }: { division: Division; data: ListResponse; onChanged: () => void }) {
  const { user } = useShell();
  const [creating, setCreating] = useState(false);
  const div = DIVISIONS[division];
  const list = data.tournaments.filter((t) => t.division === division);
  const open = list.find((t) => t.status !== "FINISHED");
  const past = list.filter((t) => t.status === "FINISHED");
  const mine = data.eligibility;
  const belongs = mine.division === division;

  return (
    <div className="space-y-6">
      <div className="hex-panel flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <RankIcon tier={division === "ELITE" ? "MASTER" : "PLATINUM"} size={44} />
          <span className="text-stone-400">–</span>
          <RankIcon tier={div.icon} size={44} />
          <div>
            <p className="font-display text-lg font-bold tracking-wide" style={{ color: div.color }}>
              {div.name}
            </p>
            <p className="text-sm text-stone-300">Solo equipos con ELO promedio {div.range}</p>
          </div>
        </div>
        <div
          className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
            belongs ? "border-win/40 bg-win/5 text-gold-50" : "border-void-500 bg-void-950/50 text-stone-300",
          )}
        >
          {belongs ? <CheckCircle2 className="h-4 w-4 text-win" /> : <XCircle className="h-4 w-4 text-stone-400" />}
          {belongs
            ? `${user.team.name} juega en esta división`
            : mine.division
              ? `${user.team.name} pertenece a la ${DIVISIONS[mine.division].name}`
              : `${user.team.name} aún no cumple los requisitos`}
        </div>
      </div>

      {open ? (
        <TournamentBoard id={open.id} onChanged={onChanged} />
      ) : (
        <EmptyState
          icon={<Trophy className="h-6 w-6" />}
          title="No hay torneo abierto en esta división"
          text={belongs ? "Como coach puedes organizar uno; tu equipo queda inscrito automáticamente." : "Cuando un coach de esta división organice un torneo aparecerá aquí."}
          action={
            belongs && user.role === "COACH" ? (
              <Button onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> Organizar torneo
              </Button>
            ) : undefined
          }
        />
      )}

      {past.length > 0 && (
        <section>
          <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.2em] text-gold-200">Torneos anteriores</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {past.map((t, i) => (
              <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link href={`/tournaments/${t.id}`} className="group flex items-center gap-4 rounded-md border border-void-500/70 bg-void-900/70 p-4 transition-colors duration-100 hover:border-gold-500">
                  <Trophy className="h-5 w-5 text-gold-300" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gold-50">{t.name}</p>
                    <p className="text-xs text-stone-400">
                      {t.teams} equipos · {t.qualified.length} clasificados · terminó {t.finishedAt ? fromNow(t.finishedAt) : ""}
                    </p>
                    <div className="mt-2 flex -space-x-1.5">
                      {t.qualified.map((q) => (
                        <TeamEmblem key={q.id} team={q} size={24} />
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-stone-400 transition-transform group-hover:translate-x-1" />
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <CreateModal open={creating} onClose={() => setCreating(false)} onCreated={onChanged} division={division} />
    </div>
  );
}

function CreateModal({ open, onClose, onCreated, division }: { open: boolean; onClose: () => void; onCreated: () => void; division: Division }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/tournaments", { body: { name } });
      toast.success("Torneo creado · inscripciones abiertas");
      setName("");
      onClose();
      onCreated();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Organizar torneo suizo" subtitle={DIVISIONS[division].name}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="t-name" className="label">
            Nombre del torneo
          </label>
          <input id="t-name" className="field" minLength={3} maxLength={60} required placeholder="Copa de Otoño" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <ul className="space-y-1 text-xs text-stone-400">
          <li>• Tu equipo queda inscrito y tú inicias el torneo cuando haya al menos 4 equipos.</li>
          <li>• Rondas Bo1; los partidos para clasificar o quedar eliminado son Bo3.</li>
          <li>• Con número impar de equipos, uno descansa por ronda (cuenta como victoria).</li>
        </ul>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Crear
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Requirements({ mine }: { mine: TeamEligibility }) {
  const { data } = useSWR<{ teams: TeamEligibility[] }>("/api/tournaments/eligibility");
  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <div className="hex-panel h-fit p-5">
        <div className="mb-4 flex items-center gap-3">
          <TeamEmblem team={mine.team} size={42} />
          <div>
            <p className="font-semibold text-gold-50">{mine.team.name}</p>
            <p className="text-xs" style={{ color: mine.division ? DIVISIONS[mine.division].color : undefined }}>
              {mine.division ? DIVISIONS[mine.division].name : "Sin división: no puede jugar torneos"}
            </p>
          </div>
        </div>
        <ul className="space-y-2">
          {mine.checks.map((c) => (
            <li key={c.id} className={cn("flex items-start gap-2 rounded-md border px-3 py-2", c.ok ? "border-win/30 bg-win/5" : "border-blood/30 bg-blood/5")}>
              {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-win" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-blood" />}
              <span>
                <span className="block text-sm font-semibold text-gold-50">{c.label}</span>
                <span className="text-xs text-stone-400">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="hex-panel overflow-hidden">
        <p className="border-b border-void-500/60 p-4 font-display text-sm font-semibold uppercase tracking-widest text-gold-200">Todos los equipos</p>
        {!data ? (
          <Skeleton className="m-4 h-60" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-stone-400">
                  <th className="px-4 py-3">Equipo</th>
                  <th className="px-4 py-3">ELO promedio</th>
                  <th className="px-4 py-3 text-right">Puntos</th>
                  <th className="px-4 py-3 text-center">Scrims ganados</th>
                  <th className="px-4 py-3">Acceso</th>
                </tr>
              </thead>
              <tbody>
                {data.teams.map((e) => {
                  const failed = e.checks.filter((c) => !c.ok);
                  return (
                    <tr key={e.team.id} className="border-t border-void-500/40">
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          <TeamEmblem team={e.team} size={28} />
                          <span className="font-semibold text-gold-50">{e.team.name}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-stone-300">{e.eloLabel ?? "—"}</td>
                      <td className={cn("px-4 py-2.5 text-right font-display font-bold", e.team.rating >= MIN_RATING ? "text-gold-50" : "text-stone-400")}>
                        {e.team.rating.toLocaleString("es-MX")}
                      </td>
                      <td className={cn("px-4 py-2.5 text-center", e.scrimWins >= MIN_SCRIM_WINS ? "text-gold-50" : "text-stone-400")}>{e.scrimWins}</td>
                      <td className="px-4 py-2.5">
                        {e.division ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: DIVISIONS[e.division].color }}>
                            <RankIcon tier={DIVISIONS[e.division].icon} size={20} /> {DIVISIONS[e.division].name}
                          </span>
                        ) : (
                          <span className="text-xs text-blood" title={failed.map((c) => c.detail).join("\n")}>
                            No elegible · {failed.map((c) => c.label).join(", ")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: TournamentSummary["status"] }) {
  const s = STATUS_LABEL[status];
  return (
    <span className="text-xs font-semibold" style={{ color: s.color }}>
      {s.label}
    </span>
  );
}
