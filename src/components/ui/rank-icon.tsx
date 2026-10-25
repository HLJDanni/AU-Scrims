import type { LolTier } from "@/lib/lol";
import { cn } from "@/lib/client";

/** Emblema oficial de la liga (public/ranks). Sin rango muestra un hexágono neutro. */
export function RankIcon({ tier, size = 20, className, title }: { tier: LolTier | null | undefined; size?: number; className?: string; title?: string }) {
  if (!tier)
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className={cn("shrink-0 text-stone-400", className)} aria-label={title ?? "Sin rango"}>
        <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
      </svg>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/ranks/${tier.toLowerCase()}.png`}
      width={size}
      height={size}
      alt={title ?? tier}
      title={title}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn("shrink-0 select-none object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,.6)]", className)}
    />
  );
}
