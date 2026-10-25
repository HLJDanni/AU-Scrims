"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LOL_TIERS, type LolTier } from "@/lib/lol";
import { cn } from "@/lib/client";
import { RankIcon } from "../ui/rank-icon";

export type EloFilterValue = LolTier | "ANY" | "NONE";

/** Dropdown con los emblemas de cada liga para filtrar rivales por su ELO promedio. */
export function EloFilter({ value, onChange, counts }: { value: EloFilterValue; onChange: (v: EloFilterValue) => void; counts: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), setOpen(false));
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc, true);
    };
  }, [open]);

  const options: { id: EloFilterValue; label: string; tier: LolTier | null }[] = [
    { id: "ANY", label: "Cualquier ELO", tier: null },
    ...[...LOL_TIERS].reverse().map((t) => ({ id: t.id as EloFilterValue, label: t.label, tier: t.id })),
    { id: "NONE", label: "Sin ELO registrado", tier: null },
  ];
  const current = options.find((o) => o.id === value)!;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filtrar rivales por ELO promedio"
        onClick={() => setOpen(!open)}
        className={cn("field flex h-[42px] items-center gap-2 pr-8 text-left", open && "border-gold-200")}
      >
        {current.tier ? <RankIcon tier={current.tier} size={22} /> : <span className="h-[22px] w-[22px] rounded-full border border-dashed border-stone-400" />}
        <span className="truncate">{current.label}</span>
        <ChevronDown className={cn("absolute right-3 h-4 w-4 text-stone-400 transition-transform duration-150", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 z-20 mt-1 max-h-72 w-60 overflow-y-auto rounded-md border border-gold-500/50 bg-void-900 py-1 shadow-gold"
          >
            {options.map((o) => {
              const n = o.id === "ANY" ? total : (counts[o.id] ?? 0);
              const selected = o.id === value;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={n === 0 && o.id !== "ANY"}
                    onClick={() => {
                      onChange(o.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-35",
                      selected ? "bg-gold-200/10 text-gold-50" : "text-stone-200 hover:bg-void-700",
                    )}
                  >
                    {o.tier ? <RankIcon tier={o.tier} size={22} /> : <span className="h-[22px] w-[22px] rounded-full border border-dashed border-stone-400" />}
                    <span className="flex-1">{o.label}</span>
                    <span className="text-[11px] text-stone-400">{n}</span>
                    {selected && <Check className="h-3.5 w-3.5 text-gold-200" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
