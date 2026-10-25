import { cn } from "@/lib/client";

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 64 64" className="h-9 w-9 drop-shadow-[0_0_10px_rgba(200,155,60,.45)]">
        <defs>
          <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F0E6D2" />
            <stop offset=".5" stopColor="#C89B3C" />
            <stop offset="1" stopColor="#785A28" />
          </linearGradient>
        </defs>
        <path d="M32 4 56 18v28L32 60 8 46V18z" fill="#010A13" stroke="url(#logo-g)" strokeWidth="3" />
        <path d="M22 17h8v23h12v7H22z" fill="url(#logo-g)" />
      </svg>
      {!compact && (
        <div className="leading-none">
          <p className="font-display text-lg font-bold tracking-[0.18em] text-gold-50">
            AU<span className="gold-text"> SCRIMS</span>
          </p>
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.35em] text-stone-400">Staff Hub</p>
        </div>
      )}
    </div>
  );
}
