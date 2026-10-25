"use client";
import { motion } from "framer-motion";
import { Check, ChevronRight, Clock, Gamepad2, Link2, Repeat2, X } from "lucide-react";
import type { ScrimDTO } from "@/lib/constants";
import { durationLabel, fmtRange, fmtShortDay, fromNow } from "@/lib/dates";
import { cn } from "@/lib/client";
import { StatusBadge, TeamEmblem } from "../ui/misc";
import { Button } from "../ui/button";
import { useShell } from "../app-shell";
import { scrimState, useScrimActions } from "./use-scrim-actions";

export function ScrimCard({ scrim, index = 0, compact }: { scrim: ScrimDTO; index?: number; compact?: boolean }) {
  const { openDetail } = useShell();
  const st = scrimState(scrim);
  const a = useScrimActions();
  const done = scrim.status === "COMPLETED";
  const won = done && scrim.myScore! > scrim.opponentScore!;
  const lost = done && scrim.myScore! < scrim.opponentScore!;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: Math.min(index, 8) * 0.025, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ x: 3, transition: { duration: 0.1 } }}
      onClick={() => openDetail(scrim.id)}
      className={cn(
        "group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-md border bg-void-900/70 p-4 transition-colors duration-100 hover:border-gold-500 hover:bg-void-800/80",
        st.awaitingMe || st.proposalForMe ? "border-hex-200/50" : "border-void-500/70",
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-0 h-full w-1",
          won ? "bg-win" : lost ? "bg-blood" : scrim.status === "CONFIRMED" ? "bg-hex-200" : scrim.status === "PENDING" ? "bg-gold-300" : "bg-void-500",
        )}
      />
      <div className="hidden w-16 shrink-0 text-center sm:block">
        <p className="text-[11px] uppercase tracking-wider text-stone-400">{fmtShortDay(scrim.startAt).split(" ")[0]}</p>
        <p className="font-display text-2xl font-bold leading-none text-gold-50">{new Date(scrim.startAt).getDate()}</p>
        <p className="text-[11px] uppercase text-stone-400">{fmtShortDay(scrim.startAt).split(" ")[2]}</p>
      </div>
      <TeamEmblem team={scrim.opponent} size={compact ? 38 : 46} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold text-gold-50">{scrim.opponent.name}</p>
          <StatusBadge status={scrim.status} label={st.expired ? "Expirado" : undefined} />
          {scrim.proposal && (scrim.status === "PENDING" || scrim.status === "CONFIRMED") && (
            <span className="inline-flex items-center gap-1 rounded-full border border-hex-200/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-hex-100">
              <Repeat2 className="h-3 w-3" /> Re-agenda
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-300">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-gold-200" /> <span className="sm:hidden">{fmtShortDay(scrim.startAt)} · </span>
            {fmtRange(scrim.startAt, scrim.endAt)} <span className="text-stone-400">({durationLabel(scrim.startAt, scrim.endAt)})</span>
          </span>
          <span className="flex items-center gap-1">
            <Gamepad2 className="h-3.5 w-3.5 text-gold-200" /> {scrim.games} juegos
          </span>
          {scrim.roomLink && (
            <span className="flex items-center gap-1 text-hex-100">
              <Link2 className="h-3.5 w-3.5" /> Sala lista
            </span>
          )}
          {!compact && (scrim.status === "PENDING" || scrim.status === "CONFIRMED") && <span className="text-stone-400">{fromNow(scrim.startAt)}</span>}
        </div>
      </div>

      {done ? (
        <div className="text-right">
          <p className="font-display text-xl font-bold">
            <span className={won ? "text-win" : "text-gold-50"}>{scrim.myScore}</span>
            <span className="mx-1 text-stone-400">-</span>
            <span className={lost ? "text-blood" : "text-gold-50"}>{scrim.opponentScore}</span>
          </p>
          {scrim.ratingDelta !== null && (
            <p className={cn("text-xs font-semibold", scrim.ratingDelta >= 0 ? "text-win" : "text-blood")}>
              {scrim.ratingDelta >= 0 ? "+" : ""}
              {scrim.ratingDelta}
            </p>
          )}
        </div>
      ) : st.awaitingMe && !compact ? (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="hex" loading={a.busy === "accept"} onClick={() => a.accept(scrim)}>
            <Check className="h-3.5 w-3.5" /> Aceptar
          </Button>
          <Button size="icon" variant="danger" loading={a.busy === "decline"} onClick={() => a.decline(scrim)} aria-label="Rechazar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : st.proposalForMe && !compact ? (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="hex" loading={a.busy === "acceptProposal"} onClick={() => a.acceptProposal(scrim)}>
            Aprobar horario
          </Button>
        </div>
      ) : st.canReport ? (
        <span className="rounded-full border border-gold-300/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gold-200">
          Registrar resultado
        </span>
      ) : (
        <ChevronRight className="h-5 w-5 text-stone-400 transition-transform group-hover:translate-x-1 group-hover:text-gold-200" />
      )}
    </motion.div>
  );
}
