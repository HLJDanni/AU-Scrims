"use client";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Check,
  Copy,
  ExternalLink,
  Gamepad2,
  Info,
  Link2,
  MessageSquareShare,
  Repeat2,
  ShieldCheck,
  Trophy,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { api, cn, refreshScrims } from "@/lib/client";
import type { ScrimDTO, ScrimEventDTO } from "@/lib/constants";
import { durationLabel, fmtFull, fromNow } from "@/lib/dates";
import { Modal } from "../ui/modal";
import { Tabs, TabPanel } from "../ui/tabs";
import { Button } from "../ui/button";
import { Skeleton, StatusBadge, TeamEmblem } from "../ui/misc";
import { useShell } from "../app-shell";
import { scrimState, useScrimActions } from "./use-scrim-actions";

type Tab = "details" | "room" | "activity";

export function ScrimDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, mutate } = useSWR<{ scrim: ScrimDTO; events: ScrimEventDTO[] }>(id ? `/api/scrims/${id}` : null);
  const [tab, setTab] = useState<Tab>("details");
  useEffect(() => setTab("details"), [id]);
  const scrim = data?.scrim?.id === id ? data.scrim : undefined;

  return (
    <Modal
      open={Boolean(id)}
      onClose={onClose}
      variant="drawer"
      title={scrim ? `vs ${scrim.opponent.name}` : "Scrim"}
      subtitle={scrim ? <StatusLine scrim={scrim} /> : undefined}
    >
      {!scrim ? (
        <div className="space-y-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-10" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="space-y-5">
          <Matchup scrim={scrim} />
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            size="sm"
            tabs={[
              { id: "details", label: "Detalles", icon: <Info className="h-3.5 w-3.5" /> },
              { id: "room", label: "Sala", icon: <Link2 className="h-3.5 w-3.5" /> },
              { id: "activity", label: "Actividad", icon: <Activity className="h-3.5 w-3.5" />, count: data!.events.length },
            ]}
          />
          <TabPanel id={tab}>
            {tab === "details" && <DetailsTab scrim={scrim} onChanged={() => mutate()} />}
            {tab === "room" && <RoomTab scrim={scrim} onSaved={() => mutate()} />}
            {tab === "activity" && <ActivityTab events={data!.events} />}
          </TabPanel>
        </div>
      )}
    </Modal>
  );
}

function StatusLine({ scrim }: { scrim: ScrimDTO }) {
  const st = scrimState(scrim);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <StatusBadge status={scrim.status} label={st.expired ? "Expirado" : undefined} />
      <span className="text-xs">{scrim.isHost ? "Solicitado por tu equipo" : `Invitación de [${scrim.opponent.tag}]`}</span>
    </span>
  );
}

function Matchup({ scrim }: { scrim: ScrimDTO }) {
  const done = scrim.status === "COMPLETED";
  return (
    <div className="hex-panel overflow-hidden p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(400px_120px_at_50%_0%,rgba(200,155,60,.18),transparent)]" />
      <div className="relative flex items-center justify-between gap-3">
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex flex-1 flex-col items-center gap-2 text-center">
          <TeamEmblem team={scrim.myTeam} size={60} />
          <p className="text-sm font-semibold text-gold-50">{scrim.myTeam.name}</p>
        </motion.div>
        <div className="text-center">
          {done ? (
            <motion.p initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-4xl font-bold text-gold-50">
              <span className={scrim.myScore! > scrim.opponentScore! ? "text-win" : ""}>{scrim.myScore}</span>
              <span className="mx-2 text-stone-400">-</span>
              <span className={scrim.opponentScore! > scrim.myScore! ? "text-blood" : ""}>{scrim.opponentScore}</span>
            </motion.p>
          ) : (
            <p className="font-display text-2xl font-bold tracking-widest text-gold-200">VS</p>
          )}
          <p className="mt-1 text-[11px] uppercase tracking-widest text-stone-400">{scrim.games} juegos</p>
          {done && scrim.ratingDelta !== null && (
            <p className={cn("mt-1 text-xs font-bold", scrim.ratingDelta >= 0 ? "text-win" : "text-blood")}>
              {scrim.ratingDelta >= 0 ? "+" : ""}
              {scrim.ratingDelta} pts
            </p>
          )}
        </div>
        <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex flex-1 flex-col items-center gap-2 text-center">
          <TeamEmblem team={scrim.opponent} size={60} />
          <p className="text-sm font-semibold text-gold-50">{scrim.opponent.name}</p>
        </motion.div>
      </div>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 text-gold-200">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-stone-400">{label}</p>
        <div className="mt-0.5 text-sm text-gold-50">{children}</div>
      </div>
    </div>
  );
}

function DetailsTab({ scrim, onChanged }: { scrim: ScrimDTO; onChanged: () => void }) {
  const { openReschedule } = useShell();
  const st = scrimState(scrim);
  const a = useScrimActions(onChanged);

  return (
    <div className="space-y-5">
      {st.proposalForMe && scrim.proposal && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-md border border-hex-200/50 bg-hex-500/30 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-hex-100">
            <Repeat2 className="h-4 w-4" /> [{scrim.opponent.tag}] propone un nuevo horario
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-stone-300">
            <span className="line-through opacity-70">{fmtFull(scrim.startAt, scrim.endAt)}</span>
            <ArrowRight className="h-3.5 w-3.5" />
            <span className="font-semibold text-gold-50">{fmtFull(scrim.proposal.startAt, scrim.proposal.endAt)}</span>
            <span>· {scrim.proposal.games} juegos</span>
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="hex" loading={a.busy === "acceptProposal"} onClick={() => a.acceptProposal(scrim)}>
              <Check className="h-3.5 w-3.5" /> Aprobar
            </Button>
            <Button size="sm" variant="ghost" loading={a.busy === "rejectProposal"} onClick={() => a.rejectProposal(scrim)}>
              Rechazar
            </Button>
          </div>
        </motion.div>
      )}
      {st.proposalByMe && scrim.proposal && (
        <div className="rounded-md border border-gold-300/40 bg-gold-700/20 p-4 text-sm">
          <p className="font-semibold text-gold-100">Esperando que [{scrim.opponent.tag}] apruebe tu propuesta</p>
          <p className="mt-1 text-stone-300">{fmtFull(scrim.proposal.startAt, scrim.proposal.endAt)} · {scrim.proposal.games} juegos</p>
          <Button size="sm" variant="ghost" className="mt-2 -ml-3" loading={a.busy === "rejectProposal"} onClick={() => a.rejectProposal(scrim)}>
            Retirar propuesta
          </Button>
        </div>
      )}

      <div className="divide-y divide-void-500/50 rounded-md border border-void-500/60 bg-void-950/40 px-4">
        <Row icon={<CalendarClock className="h-4 w-4" />} label="Fecha y horario">
          {fmtFull(scrim.startAt, scrim.endAt)} <span className="text-stone-400">({durationLabel(scrim.startAt, scrim.endAt)})</span>
          <p className="text-xs text-stone-400">{fromNow(scrim.startAt)}</p>
        </Row>
        <Row icon={<Gamepad2 className="h-4 w-4" />} label="Juegos">{scrim.games} juegos</Row>
        <Row icon={<User className="h-4 w-4" />} label="Agendado por">
          {scrim.createdBy ?? "—"} <span className="text-stone-400">· [{scrim.isHost ? scrim.myTeam.tag : scrim.opponent.tag}]</span>
        </Row>
        {scrim.notes && (
          <Row icon={<Info className="h-4 w-4" />} label="Notas">
            <p className="whitespace-pre-wrap">{scrim.notes}</p>
          </Row>
        )}
      </div>

      {st.canReport && <ResultForm scrim={scrim} busy={a.busy === "report"} onSubmit={(m, o) => a.report(scrim, m, o)} />}

      <div className="flex flex-wrap gap-2">
        {st.awaitingMe && (
          <>
            <Button variant="hex" loading={a.busy === "accept"} onClick={() => a.accept(scrim)}>
              <ShieldCheck className="h-4 w-4" /> Aceptar scrim
            </Button>
            <Button variant="danger" loading={a.busy === "decline"} onClick={() => a.decline(scrim)}>
              <X className="h-4 w-4" /> Rechazar
            </Button>
          </>
        )}
        {st.canReschedule && (
          <Button variant="secondary" onClick={() => openReschedule(scrim)}>
            <Repeat2 className="h-4 w-4" /> {scrim.status === "PENDING" && scrim.isHost ? "Re-agendar" : "Proponer otro horario"}
          </Button>
        )}
        {st.canCancel && (
          <Button variant="ghost" className="text-blood hover:text-blood" loading={a.busy === "cancel"} onClick={() => a.cancel(scrim)}>
            Cancelar scrim
          </Button>
        )}
      </div>
    </div>
  );
}

function ResultForm({ scrim, busy, onSubmit }: { scrim: ScrimDTO; busy: boolean; onSubmit: (m: number, o: number) => void }) {
  const [mine, setMine] = useState(0);
  const [theirs, setTheirs] = useState(0);
  const total = mine + theirs;
  const Stepper = ({ value, set, label }: { value: number; set: (n: number) => void; label: string }) => (
    <div className="flex flex-col items-center gap-2">
      <p className="text-[11px] uppercase tracking-wider text-stone-400">{label}</p>
      <div className="flex items-center gap-2">
        <button type="button" className="h-8 w-8 rounded border border-void-500 text-gold-100 hover:border-gold-300 disabled:opacity-30" disabled={value === 0} onClick={() => set(value - 1)}>
          −
        </button>
        <motion.span key={value} initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-8 text-center font-display text-3xl font-bold text-gold-50">
          {value}
        </motion.span>
        <button type="button" className="h-8 w-8 rounded border border-void-500 text-gold-100 hover:border-gold-300 disabled:opacity-30" disabled={total >= scrim.games} onClick={() => set(value + 1)}>
          +
        </button>
      </div>
    </div>
  );
  return (
    <div className="rounded-md border border-gold-500/50 bg-gradient-to-b from-gold-700/20 to-transparent p-4">
      <p className="mb-4 flex items-center gap-2 font-display text-sm font-semibold tracking-wide text-gold-100">
        <Trophy className="h-4 w-4" /> Registrar resultado
      </p>
      <div className="flex items-center justify-around">
        <Stepper value={mine} set={setMine} label={`[${scrim.myTeam.tag}]`} />
        <span className="font-display text-stone-400">-</span>
        <Stepper value={theirs} set={setTheirs} label={`[${scrim.opponent.tag}]`} />
      </div>
      <p className="mt-3 text-center text-xs text-stone-400">
        {total}/{scrim.games} juegos registrados · actualiza el ranking de ambos equipos
      </p>
      <Button className="mt-3 w-full" disabled={total === 0} loading={busy} onClick={() => onSubmit(mine, theirs)}>
        Guardar resultado
      </Button>
    </div>
  );
}

function RoomTab({ scrim, onSaved }: { scrim: ScrimDTO; onSaved: () => void }) {
  const [link, setLink] = useState(scrim.roomLink ?? "");
  const [saving, setSaving] = useState(false);
  const editable = scrim.status === "PENDING" || scrim.status === "CONFIRMED";
  useEffect(() => setLink(scrim.roomLink ?? ""), [scrim.roomLink]);

  const invite = [
    `⚔️ SCRIM ${scrim.myTeam.tag} vs ${scrim.opponent.tag}`,
    `📅 ${fmtFull(scrim.startAt, scrim.endAt)}`,
    `🎮 ${scrim.games} juegos`,
    scrim.roomLink ? `🔗 Sala: ${scrim.roomLink}` : null,
    scrim.notes ? `📝 ${scrim.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  async function save() {
    setSaving(true);
    try {
      await api(`/api/scrims/${scrim.id}`, { method: "PATCH", body: { roomLink: link.trim() || null } });
      toast.success(link.trim() ? "Link de la sala guardado" : "Link eliminado");
      await refreshScrims();
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function copy(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(msg);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <div className="space-y-5">
      <div className={cn("rounded-md border p-4", scrim.roomLink ? "border-hex-200/50 bg-hex-500/20" : "border-dashed border-void-500")}>
        <p className="text-[11px] uppercase tracking-wider text-stone-400">Sala actual</p>
        {scrim.roomLink ? (
          <div className="mt-2 flex items-center gap-2">
            <a href={scrim.roomLink} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sm text-hex-100 underline-offset-4 hover:underline">
              {scrim.roomLink}
            </a>
            <Button size="icon" variant="ghost" onClick={() => copy(scrim.roomLink!, "Link copiado")} aria-label="Copiar link">
              <Copy className="h-4 w-4" />
            </Button>
            <a href={scrim.roomLink} target="_blank" rel="noopener noreferrer" className="rounded-md p-2 text-stone-300 hover:bg-void-700 hover:text-gold-50" aria-label="Abrir sala">
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        ) : (
          <p className="mt-1 text-sm text-stone-300">Aún no hay link. Agrégalo para que el staff pueda compartirlo con los jugadores.</p>
        )}
      </div>

      {editable && (
        <div>
          <label className="label">Link de la sala (Discord, lobby, etc.)</label>
          <div className="flex gap-2">
            <input type="url" className="field" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} />
            <Button onClick={save} loading={saving} disabled={link.trim() === (scrim.roomLink ?? "")}>
              Guardar
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-stone-400">Ambos equipos ven y pueden actualizar este link.</p>
        </div>
      )}

      <div>
        <label className="label">Mensaje para los jugadores</label>
        <pre className="whitespace-pre-wrap rounded-md border border-void-500 bg-void-950/70 p-4 font-sans text-sm text-gold-50">{invite}</pre>
        <Button className="mt-2" variant="secondary" size="sm" onClick={() => copy(invite, "Mensaje copiado, ¡pégalo en el chat del equipo!")}>
          <MessageSquareShare className="h-4 w-4" /> Copiar invitación
        </Button>
      </div>
    </div>
  );
}

function ActivityTab({ events }: { events: ScrimEventDTO[] }) {
  if (!events.length) return <p className="text-sm text-stone-400">Sin actividad.</p>;
  return (
    <ol className="relative ml-2 space-y-5 border-l border-gold-500/40 pl-6">
      {events.map((e, i) => (
        <motion.li key={e.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="relative">
          <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-gold-300 bg-void-950" />
          <p className="text-sm text-gold-50">{e.message}</p>
          <p className="text-xs text-stone-400">{fromNow(e.createdAt)}</p>
        </motion.li>
      ))}
    </ol>
  );
}
