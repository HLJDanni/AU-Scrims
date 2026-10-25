"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api, refreshScrims } from "@/lib/client";
import type { ScrimDTO } from "@/lib/constants";

/** Estado derivado: qué puede hacer mi equipo con este scrim. */
export function scrimState(s: ScrimDTO) {
  const now = Date.now();
  const started = new Date(s.startAt).getTime() <= now;
  const ended = new Date(s.endAt).getTime() < now;
  const active = s.status === "PENDING" || s.status === "CONFIRMED";
  return {
    started,
    ended,
    expired: s.status === "PENDING" && ended,
    awaitingMe: s.status === "PENDING" && !s.isHost && !started,
    proposalForMe: Boolean(s.proposal && !s.proposal.byMe && active),
    proposalByMe: Boolean(s.proposal?.byMe && active),
    canReschedule: active && !started,
    canCancel: active && !ended,
    canReport: s.status === "CONFIRMED" && started,
  };
}

export function useScrimActions(onDone?: (s: ScrimDTO) => void) {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, path: string, body: unknown, success: string) {
    setBusy(key);
    try {
      const res = await api<{ scrim: ScrimDTO }>(path, { body });
      toast.success(success);
      await refreshScrims();
      onDone?.(res.scrim);
      return res.scrim;
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return {
    busy,
    accept: (s: ScrimDTO) => run("accept", `/api/scrims/${s.id}/respond`, { action: "accept" }, `Scrim vs [${s.opponent.tag}] confirmado`),
    decline: (s: ScrimDTO) => run("decline", `/api/scrims/${s.id}/respond`, { action: "decline" }, "Solicitud rechazada"),
    acceptProposal: (s: ScrimDTO) => run("acceptProposal", `/api/scrims/${s.id}/proposal`, { action: "accept" }, "Nuevo horario aprobado"),
    rejectProposal: (s: ScrimDTO) =>
      run("rejectProposal", `/api/scrims/${s.id}/proposal`, { action: "reject" }, s.proposal?.byMe ? "Propuesta retirada" : "Propuesta rechazada"),
    cancel: (s: ScrimDTO) => {
      if (!window.confirm(`¿Cancelar el scrim contra ${s.opponent.name}?`)) return;
      return run("cancel", `/api/scrims/${s.id}/cancel`, {}, "Scrim cancelado");
    },
    report: (s: ScrimDTO, myScore: number, opponentScore: number) =>
      run("report", `/api/scrims/${s.id}/result`, { myScore, opponentScore }, "Resultado registrado · ranking actualizado"),
  };
}
