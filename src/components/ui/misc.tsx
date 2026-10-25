"use client";
import { motion } from "framer-motion";
import { ROLE_META, STATUS_META, type Role, type ScrimStatus, type TeamLite } from "@/lib/constants";
import { cn } from "@/lib/client";

export function StatusBadge({ status, label }: { status: ScrimStatus; label?: string }) {
  const m = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ color: m.color, background: m.bg, borderColor: `${m.color}55` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {label ?? m.label}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const colors: Record<Role, string> = {
    COACH: "text-gold-200 border-gold-200/50 bg-gold-200/10",
    ANALYST: "text-hex-200 border-hex-200/50 bg-hex-200/10",
    CAPTAIN: "text-gold-50 border-gold-50/40 bg-gold-50/10",
  };
  return (
    <span className={cn("inline-flex rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest", colors[role])}>
      {ROLE_META[role].label}
    </span>
  );
}

/** Emblema hexagonal con el tag del equipo. */
export function TeamEmblem({ team, size = 44, className }: { team: Pick<TeamLite, "tag" | "color">; size?: number; className?: string }) {
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id={`em-${team.tag}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={team.color} stopOpacity=".45" />
            <stop offset="1" stopColor="#010A13" stopOpacity=".95" />
          </linearGradient>
        </defs>
        <polygon points="50,3 93,27 93,73 50,97 7,73 7,27" fill={`url(#em-${team.tag})`} stroke={team.color} strokeWidth="4" />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-display font-bold text-gold-50"
        style={{ fontSize: size * (team.tag.length > 3 ? 0.22 : 0.28) }}
      >
        {team.tag}
      </span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-md bg-[linear-gradient(90deg,#111418_0%,#1E2328_50%,#111418_100%)] bg-[length:200%_100%]",
        className,
      )}
    />
  );
}

export function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-md border border-dashed border-void-500 px-6 py-14 text-center"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-gold-500/50 bg-void-800 text-gold-200">
        {icon}
      </div>
      <h3 className="font-display text-base font-semibold tracking-wide text-gold-50">{title}</h3>
      {text && <p className="mt-1.5 max-w-sm text-sm text-stone-300">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-hex-200">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-bold tracking-wide text-gold-50 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-stone-300">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}

export function StatCard({ label, value, hint, icon, accent = "gold", delay = 0 }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; accent?: "gold" | "hex"; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3, transition: { duration: 0.12 } }}
      className="hex-panel group overflow-hidden p-5"
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-25 transition-opacity duration-150 group-hover:opacity-50",
          accent === "gold" ? "bg-[radial-gradient(closest-side,#C89B3C,transparent)]" : "bg-[radial-gradient(closest-side,#0AC8B9,transparent)]",
        )}
      />
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-300">{label}</p>
        <span className={accent === "gold" ? "text-gold-200" : "text-hex-200"}>{icon}</span>
      </div>
      <div className="mt-3 font-display text-3xl font-bold text-gold-50">{value}</div>
      {hint && <div className="mt-1 text-xs text-stone-400">{hint}</div>}
    </motion.div>
  );
}
