"use client";
// Avisos de inicio de scrim estilo Teams, con la estética del cliente de LoL.
// Aparecen abajo a la derecha a los 15, 10 y 5 minutos del inicio de cada scrim confirmado del equipo.
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellOff, Copy, ExternalLink, Gamepad2, Info, Swords, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { cn } from "@/lib/client";
import type { ScrimDTO } from "@/lib/constants";
import { fmtRange } from "@/lib/dates";
import { scrimInvite } from "@/lib/invite";
import { mmss, reminderKey, reminderStage, type ReminderStage } from "@/lib/reminders";
import { TeamEmblem } from "../ui/misc";
import { useShell } from "../app-shell";

const DISMISSED = "aus_reminders_dismissed";
const MUTED = "aus_reminders_muted";

// Estado guardado en el navegador: si no está disponible (modo privado), los avisos siguen funcionando
const load = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const save = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

const STAGE_STYLE: Record<ReminderStage, { color: string; label: string; ring: string }> = {
  15: { color: "#C89B3C", label: "Falta un cuarto de hora", ring: "border-gold-300/70" },
  10: { color: "#F0A23C", label: "Ve preparando al equipo", ring: "border-[#F0A23C]/70" },
  5: { color: "#E84057", label: "¡A la Grieta!", ring: "border-blood/80" },
};

/** Campanita de dos tonos generada con Web Audio (sin archivos). */
function chime(stage: ReminderStage) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const notes = stage === 5 ? [784, 988, 1175] : [659, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

export function ScrimReminders() {
  const { openDetail } = useShell();
  const { data } = useSWR<{ scrims: ScrimDTO[] }>("/api/scrims?scope=upcoming", { refreshInterval: 60_000 });
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [muted, setMuted] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const announced = useRef<Set<string>>(new Set());

  useEffect(() => {
    setDismissed(new Set(JSON.parse(load(DISMISSED) ?? "[]")));
    setMuted(load(MUTED) === "1");
    if ("Notification" in window) setPermission(Notification.permission);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Un aviso por scrim: el del umbral actual (15, 10 o 5), mientras no se haya descartado
  const active = useMemo(() => {
    return (data?.scrims ?? [])
      .map((s) => {
        const msLeft = new Date(s.startAt).getTime() - now;
        const stage = reminderStage(msLeft);
        return stage ? { scrim: s, stage, msLeft, key: reminderKey(s, stage) } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null && !dismissed.has(x.key))
      .sort((a, b) => a.msLeft - b.msLeft);
  }, [data, now, dismissed]);

  // Sonido y notificación del sistema la primera vez que aparece cada aviso
  useEffect(() => {
    for (const r of active) {
      if (announced.current.has(r.key)) continue;
      announced.current.add(r.key);
      if (!muted) chime(r.stage);
      if (permission === "granted" && document.visibilityState !== "visible") {
        try {
          const n = new Notification(`Scrim en ${Math.max(1, Math.ceil(r.msLeft / 60_000))} min · vs ${r.scrim.opponent.name}`, {
            body: `${fmtRange(r.scrim.startAt, r.scrim.endAt)} · ${r.scrim.games} juegos${r.scrim.roomLink ? " · sala lista" : ""}`,
            icon: "/icon.svg",
            tag: r.key,
          });
          n.onclick = () => {
            window.focus();
            openDetail(r.scrim.id);
          };
        } catch {}
      }
    }
  }, [active, muted, permission, openDetail]);

  function dismiss(key: string) {
    const next = new Set(dismissed).add(key);
    setDismissed(next);
    // Solo se guardan las de las últimas horas para que la lista no crezca sin fin
    save(DISMISSED, JSON.stringify([...next].slice(-60)));
  }

  function toggleMute() {
    setMuted(!muted);
    save(MUTED, muted ? "0" : "1");
  }

  async function enableDesktop() {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") toast.success("Te avisaremos también con notificaciones del sistema");
  }

  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-3">
      <AnimatePresence initial={false}>
        {active.slice(0, 3).map((r) => (
          <ReminderCard
            key={r.key}
            scrim={r.scrim}
            stage={r.stage}
            msLeft={r.msLeft}
            muted={muted}
            canAskDesktop={permission === "default"}
            onMute={toggleMute}
            onDesktop={enableDesktop}
            onDismiss={() => dismiss(r.key)}
            onDetail={() => openDetail(r.scrim.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ReminderCard({
  scrim,
  stage,
  msLeft,
  muted,
  canAskDesktop,
  onMute,
  onDesktop,
  onDismiss,
  onDetail,
}: {
  scrim: ScrimDTO;
  stage: ReminderStage;
  msLeft: number;
  muted: boolean;
  canAskDesktop: boolean;
  onMute: () => void;
  onDesktop: () => void;
  onDismiss: () => void;
  onDetail: () => void;
}) {
  const st = STAGE_STYLE[stage];
  const progress = Math.max(0, Math.min(1, msLeft / (15 * 60_000)));

  async function copy() {
    try {
      await navigator.clipboard.writeText(scrimInvite(scrim));
      toast.success("Invitación copiada para tus jugadores");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <motion.div
      layout
      role="alert"
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={cn("hex-panel pointer-events-auto overflow-hidden border bg-void-900/95 shadow-[0_20px_50px_-20px_rgba(0,0,0,.9)]", st.ring)}
    >
      {/* Barra de tiempo restante */}
      <div className="h-1 w-full bg-void-700">
        <div className="h-full transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%`, background: st.color }} />
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inset-0 animate-ping rounded-full" style={{ background: `${st.color}99` }} />
              <span className="relative h-2.5 w-2.5 rounded-full" style={{ background: st.color }} />
            </span>
            <div className="leading-tight">
              <p className="font-display text-sm font-bold uppercase tracking-[0.18em]" style={{ color: st.color }}>
                Scrim en {Math.max(1, Math.ceil(msLeft / 60_000))} min
              </p>
              <p className="text-[11px] text-stone-400">{st.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onMute} className="rounded p-1 text-stone-400 hover:bg-void-700 hover:text-gold-50" aria-label={muted ? "Activar sonido de los avisos" : "Silenciar avisos"} title={muted ? "Activar sonido" : "Silenciar"}>
              {muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            </button>
            <button onClick={onDismiss} className="rounded p-1 text-stone-400 hover:bg-void-700 hover:text-gold-50" aria-label="Descartar aviso">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button onClick={onDetail} className="mt-3 flex w-full items-center gap-3 rounded-md border border-void-500/70 bg-void-950/60 p-3 text-left transition-colors duration-100 hover:border-gold-500">
          <TeamEmblem team={scrim.myTeam} size={36} />
          <Swords className="h-4 w-4 shrink-0 text-gold-200" />
          <TeamEmblem team={scrim.opponent} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gold-50">vs {scrim.opponent.name}</p>
            <p className="truncate whitespace-nowrap text-[11px] text-stone-400">{fmtRange(scrim.startAt, scrim.endAt)}</p>
            <p className="flex items-center gap-1 whitespace-nowrap text-[11px] text-stone-400">
              <Gamepad2 className="h-3 w-3" /> {scrim.games} juegos
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-bold tabular-nums" style={{ color: st.color }}>
              {mmss(msLeft)}
            </p>
            <p className="text-[9px] uppercase tracking-wider text-stone-400">para iniciar</p>
          </div>
        </button>

        <div className="mt-3 flex gap-2">
          {scrim.roomLink ? (
            <a
              href={scrim.roomLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-gold-100/40 bg-gold-gradient text-xs font-semibold uppercase tracking-wider text-void-950 transition-[filter] duration-100 hover:brightness-110"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Unirse a la sala
            </a>
          ) : (
            <button
              onClick={onDetail}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-blood/50 bg-blood/5 text-xs font-semibold uppercase tracking-wider text-blood transition-colors duration-100 hover:bg-blood/15"
            >
              <Info className="h-3.5 w-3.5" /> Falta el link de sala
            </button>
          )}
          <button
            onClick={copy}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-gold-200/60 px-3 text-xs font-semibold uppercase tracking-wider text-gold-100 transition-colors duration-100 hover:bg-gold-200/10"
            title="Copiar invitación para los jugadores"
          >
            <Copy className="h-3.5 w-3.5" /> Invitación
          </button>
        </div>

        {canAskDesktop && (
          <button onClick={onDesktop} className="mt-2 w-full text-center text-[11px] text-hex-100 hover:underline">
            Avisarme también con notificaciones del escritorio
          </button>
        )}
      </div>
    </motion.div>
  );
}
