"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useId } from "react";
import { cn } from "@/lib/client";

export type TabItem<T extends string> = { id: T; label: string; icon?: React.ReactNode; count?: number };

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  size = "md",
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const layoutId = useId();
  return (
    <div role="tablist" className={cn("relative flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-void-500/70", className)}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative flex shrink-0 items-center gap-2 font-display font-semibold uppercase tracking-[0.12em] transition-colors duration-100",
              size === "md" ? "px-4 py-3 text-xs" : "px-3 py-2 text-[11px]",
              active ? "text-gold-50" : "text-stone-400 hover:text-gold-100",
            )}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={cn("rounded-full px-1.5 py-0.5 font-sans text-[10px] leading-none", active ? "bg-gold-300 text-void-950" : "bg-void-600 text-stone-300")}>
                {t.count}
              </span>
            )}
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-gold-gradient shadow-[0_0_12px_rgba(200,155,60,.8)]"
                transition={{ type: "spring", stiffness: 700, damping: 45 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Contenedor que anima el cambio de pestaña. */
export function TabPanel({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        role="tabpanel"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
