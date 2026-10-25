"use client";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Check, Clock, Gamepad2, Link2, Search, StickyNote } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { api, cn, refreshScrims } from "@/lib/client";
import type { ScrimDTO, TeamLite } from "@/lib/constants";
import type { LolTier } from "@/lib/lol";
import { combine, durationLabel, fmtFull, toDateInput, toTimeInput } from "@/lib/dates";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { TeamEmblem } from "../ui/misc";
import { RankIcon } from "../ui/rank-icon";
import { EloFilter, type EloFilterValue } from "./elo-filter";
import { PointsPreview } from "./points-preview";
import { useShell } from "../app-shell";

type RivalTeam = TeamLite & { elo: { tier: LolTier; label: string; color: string } | null };

export type ScrimFormPrefill = { startAt?: Date; endAt?: Date; opponentTeamId?: string };

const DURATIONS = [60, 90, 120, 180, 240];
const GAME_CHIPS = [1, 2, 3, 4, 5, 6, 7];

function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(19, 0, 0, 0);
  return d;
}

export function ScrimForm({
  open,
  onClose,
  prefill,
  scrim,
}: {
  open: boolean;
  onClose: () => void;
  prefill?: ScrimFormPrefill;
  scrim?: ScrimDTO;
}) {
  const reschedule = Boolean(scrim);
  const { user } = useShell();
  // Rating actual de mi equipo (el del menú puede estar desactualizado si se registró un resultado)
  const { data: mine } = useSWR<{ team: { rating: number } }>(open ? "/api/team" : null);
  const [opponentId, setOpponentId] = useState("");
  const [query, setQuery] = useState("");
  const [elo, setElo] = useState<EloFilterValue>("ANY");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [games, setGames] = useState(3);
  const [roomLink, setRoomLink] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Reinicia los campos cada vez que se abre
  useEffect(() => {
    if (!open) return;
    const s = scrim ? new Date(scrim.startAt) : (prefill?.startAt ?? defaultStart());
    const e = scrim ? new Date(scrim.endAt) : (prefill?.endAt ?? new Date(s.getTime() + 120 * 60000));
    setDate(toDateInput(s));
    setStart(toTimeInput(s));
    setEnd(toTimeInput(e));
    setGames(scrim?.games ?? 3);
    setOpponentId(scrim?.opponent.id ?? prefill?.opponentTeamId ?? "");
    setRoomLink("");
    setNotes("");
    setQuery("");
    setElo("ANY");
  }, [open, scrim, prefill]);

  const { data } = useSWR<{ teams: RivalTeam[] }>(open && !reschedule ? "/api/teams" : null);
  // Cantidad de rivales por liga (según el ELO promedio de sus titulares)
  const eloCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of data?.teams ?? []) {
      const k = t.elo?.tier ?? "NONE";
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [data]);
  const teams = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.teams ?? []).filter(
      (t) =>
        (!q || t.name.toLowerCase().includes(q) || t.tag.toLowerCase().includes(q)) &&
        (elo === "ANY" || (elo === "NONE" ? !t.elo : t.elo?.tier === elo)),
    );
  }, [data, query, elo]);

  const startAt = date && start ? combine(date, start) : null;
  let endAt = date && end ? combine(date, end) : null;
  // Si la hora final es menor, el bloque termina al día siguiente
  if (startAt && endAt && endAt <= startAt) endAt = new Date(endAt.getTime() + 24 * 3600 * 1000);
  const minutes = startAt && endAt ? (endAt.getTime() - startAt.getTime()) / 60000 : 0;

  function setDuration(mins: number) {
    if (!startAt) return;
    setEnd(toTimeInput(new Date(startAt.getTime() + mins * 60000)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!startAt || !endAt) return toast.error("Completa fecha y horario");
    if (!reschedule && !opponentId) return toast.error("Selecciona el equipo rival");
    setSaving(true);
    try {
      if (reschedule) {
        const res = await api<{ direct: boolean }>(`/api/scrims/${scrim!.id}/reschedule`, {
          body: { startAt: startAt.toISOString(), endAt: endAt.toISOString(), games },
        });
        toast.success(res.direct ? "Scrim re-agendado" : "Propuesta de re-agenda enviada", {
          description: res.direct ? fmtFull(startAt, endAt) : `[${scrim!.opponent.tag}] debe aprobar el nuevo horario`,
        });
      } else {
        await api("/api/scrims", {
          body: {
            opponentTeamId: opponentId,
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            games,
            roomLink: roomLink || null,
            notes: notes || null,
          },
        });
        const opp = data?.teams.find((t) => t.id === opponentId);
        toast.success("Solicitud de scrim enviada", { description: `${opp ? `[${opp.tag}] · ` : ""}${fmtFull(startAt, endAt)}` });
      }
      await refreshScrims();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const willPropose = scrim && !(scrim.status === "PENDING" && scrim.isHost);

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-w-2xl"
      title={reschedule ? "Re-agendar scrim" : "Agendar scrim"}
      subtitle={
        reschedule ? (
          <span>
            vs <b className="text-gold-100">{scrim!.opponent.name}</b>
            {willPropose && " · el rival deberá aprobar el cambio"}
          </span>
        ) : (
          "Elige rival, horario y número de juegos. El rival recibirá la solicitud."
        )
      }
    >
      <form onSubmit={submit} className="space-y-6">
        {!reschedule && (
          <section>
            <label className="label">Equipo rival</label>
            <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_210px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input className="field pl-9" placeholder="Buscar por nombre o tag…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <EloFilter value={elo} onChange={setElo} counts={eloCounts} />
            </div>
            <div className="grid max-h-52 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {!data &&
                Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-md bg-void-700/60" />)}
              {teams.map((t) => {
                const sel = t.id === opponentId;
                return (
                  <motion.button
                    type="button"
                    key={t.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setOpponentId(t.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-[border-color,background-color,box-shadow] duration-100",
                      sel ? "border-gold-200 bg-gold-200/10 shadow-gold" : "border-void-500 bg-void-950/50 hover:border-gold-500",
                    )}
                  >
                    <TeamEmblem team={t} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gold-50">{t.name}</p>
                      <p className="text-[11px] text-stone-400">
                        {t.region} · {t.rating.toLocaleString("es-MX")} pts
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold" style={{ color: t.elo?.color ?? "#7B7A72" }}>
                        <RankIcon tier={t.elo?.tier} size={16} /> {t.elo ? `Promedio ${t.elo.label}` : "Sin ELO registrado"}
                      </p>
                    </div>
                    <AnimatePresence>
                      {sel && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="rounded-full bg-gold-300 p-1 text-void-950">
                          <Check className="h-3 w-3" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
              {data && teams.length === 0 && (
                <p className="col-span-full py-4 text-center text-sm text-stone-400">
                  {elo !== "ANY" ? "Ningún equipo con ese ELO promedio" : "Sin resultados"}
                </p>
              )}
            </div>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" /> Fecha
            </label>
            <input type="date" className="field" value={date} min={toDateInput(new Date())} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Inicio
            </label>
            <input type="time" step={900} className="field" value={start} onChange={(e) => setStart(e.target.value)} required />
          </div>
          <div>
            <label className="label">Fin</label>
            <input type="time" step={900} className="field" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </div>
          <div className="sm:col-span-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-stone-400">Duración</span>
            {DURATIONS.map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setDuration(m)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition",
                  Math.round(minutes) === m ? "border-hex-200 bg-hex-200/15 text-hex-100" : "border-void-500 text-stone-300 hover:border-gold-500",
                )}
              >
                {m < 60 ? `${m}m` : `${m / 60}h`}
              </button>
            ))}
            {startAt && endAt && (
              <span className="ml-auto text-xs text-stone-300">
                {durationLabel(startAt, endAt)} · <span className="text-gold-100">{fmtFull(startAt, endAt)}</span>
              </span>
            )}
          </div>
        </section>

        <section>
          <label className="label flex items-center gap-1.5">
            <Gamepad2 className="h-3.5 w-3.5" /> Número de juegos
          </label>
          <div className="flex flex-wrap gap-2">
            {GAME_CHIPS.map((g) => (
              <motion.button
                type="button"
                key={g}
                whileTap={{ scale: 0.9 }}
                onClick={() => setGames(g)}
                className={cn(
                  "relative h-11 w-11 rounded-md border font-display text-base font-bold transition-colors",
                  games === g ? "border-gold-200 text-void-950" : "border-void-500 text-stone-300 hover:border-gold-500 hover:text-gold-50",
                )}
              >
                {games === g && <motion.span layoutId="games-chip" className="absolute inset-0 rounded-md bg-gold-gradient" />}
                <span className="relative">{g}</span>
              </motion.button>
            ))}
          </div>
        </section>

        {(() => {
          const rival = reschedule ? scrim!.opponent : data?.teams.find((t) => t.id === opponentId);
          const myRating = reschedule ? scrim!.myTeam.rating : (mine?.team.rating ?? user.team?.rating);
          return rival && myRating != null ? <PointsPreview myRating={myRating} rivalRating={rival.rating} games={games} rivalTag={rival.tag} /> : null;
        })()}

        {!reschedule && (
          <section className="grid gap-4">
            <div>
              <label className="label flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> Link de la sala <span className="normal-case tracking-normal text-stone-400">(opcional)</span>
              </label>
              <input
                type="url"
                className="field"
                placeholder="https://discord.gg/… o link de la sala personalizada"
                value={roomLink}
                onChange={(e) => setRoomLink(e.target.value)}
              />
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5" /> Notas <span className="normal-case tracking-normal text-stone-400">(opcional)</span>
              </label>
              <textarea
                className="field min-h-[72px] resize-y"
                maxLength={500}
                placeholder="Fearless draft, parche, side preferido…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </section>
        )}

        <div className="flex justify-end gap-2 border-t border-void-500/60 pt-5">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {reschedule ? (willPropose ? "Proponer horario" : "Guardar cambios") : "Enviar solicitud"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
