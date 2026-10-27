"use client";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, MessagesSquare, Search, Swords, Trash2 } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { api } from "@/lib/client";
import type { ScrimStatus } from "@/lib/constants";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "../ui/button";
import { EmptyState, Skeleton, StatusBadge, TeamEmblem } from "../ui/misc";
import { Modal } from "../ui/modal";

type AdminTeam = { id: string; name: string; tag: string; color: string; logoUpdatedAt: string | null };
type AdminScrim = {
  id: string;
  startAt: string;
  games: number;
  status: ScrimStatus;
  home: AdminTeam;
  away: AdminTeam;
  score: [number, number] | null;
  ratingDelta: number | null;
  opponentRatingDelta: number | null;
  notes: string | null;
  messages: number;
  draftGames: number;
};

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}`;

export function AdminScrims() {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const { data, mutate, isLoading } = useSWR<{ scrims: AdminScrim[] }>(`/api/admin/scrims${term ? `?q=${encodeURIComponent(term)}` : ""}`);
  const [target, setTarget] = useState<AdminScrim | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!target) return;
    setBusy(true);
    try {
      const r = await api<{ pointsReverted: boolean }>(`/api/admin/scrims/${target.id}`, { method: "DELETE" });
      toast.success(`Scrim [${target.home.tag}] vs [${target.away.tag}] eliminado`, {
        description: r.pointsReverted ? "Los puntos del ranking volvieron a como estaban." : undefined,
      });
      setTarget(null);
      mutate();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(q.trim());
        }}
        className="flex max-w-md gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por equipo o tag…" className="field pl-9" aria-label="Buscar scrims" />
        </div>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      {isLoading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : !data?.scrims.length ? (
        <EmptyState icon={<Swords className="h-6 w-6" />} title="No hay scrims" text={term ? "Ningún scrim coincide con la búsqueda." : "Todavía no se ha agendado ningún scrim."} />
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {data.scrims.map((s) => (
              <motion.li
                key={s.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="hex-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <TeamEmblem team={s.home} size={36} />
                  <span className="font-display text-sm font-bold text-gold-50">
                    [{s.home.tag}] {s.score ? `${s.score[0]} - ${s.score[1]}` : "vs"} [{s.away.tag}]
                  </span>
                  <TeamEmblem team={s.away} size={36} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-xs text-stone-300">
                      <StatusBadge status={s.status} /> {format(new Date(s.startAt), "EEE d MMM yyyy · HH:mm", { locale: es })} · {s.games} juegos
                    </p>
                    <p className="mt-0.5 flex items-center gap-3 truncate text-[11px] text-stone-400">
                      <span className="flex items-center gap-1">
                        <MessagesSquare className="h-3 w-3" /> {s.messages}
                      </span>
                      <span className="flex items-center gap-1">
                        <Swords className="h-3 w-3" /> {s.draftGames} drafts
                      </span>
                      {s.notes && <span className="truncate">{s.notes}</span>}
                    </p>
                  </div>
                </div>
                <Button variant="danger" size="sm" onClick={() => setTarget(s)}>
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <Modal open={Boolean(target)} onClose={() => setTarget(null)} title="Eliminar scrim" subtitle={target ? `[${target.home.tag}] vs [${target.away.tag}]` : undefined}>
        {target && (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-blood">
              <AlertTriangle className="h-4 w-4" /> Esta acción no se puede deshacer
            </p>
            <ul className="space-y-1 text-sm text-stone-300">
              <li>• Desaparece para ambos equipos, con su chat ({target.messages} mensajes), su draft y su actividad.</li>
              {target.ratingDelta != null ? (
                <li>
                  • Tenía resultado: se revierten los puntos ({target.home.tag} {signed(-target.ratingDelta)}, {target.away.tag}{" "}
                  {signed(-(target.opponentRatingDelta ?? -target.ratingDelta))}).
                </li>
              ) : (
                <li>• No tenía resultado: el ranking no cambia.</li>
              )}
            </ul>
            <div className="flex gap-2">
              <Button variant="danger" loading={busy} onClick={remove}>
                <Trash2 className="h-4 w-4" /> Sí, eliminar
              </Button>
              <Button variant="ghost" onClick={() => setTarget(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
