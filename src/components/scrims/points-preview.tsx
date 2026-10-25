"use client";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/client";
import { eloDelta, expectedScore, pointsAtStake } from "@/lib/elo";

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}`;
const tone = (n: number) => (n > 0 ? "text-win" : n < 0 ? "text-blood" : "text-stone-300");

/**
 * Vista previa de los puntos de ranking en juego: cuánto gana o pierde mi equipo con cada marcador posible.
 * Es una estimación con los ratings de ahora; el valor final se calcula al registrar el resultado.
 */
export function PointsPreview({
  myRating,
  rivalRating,
  games,
  rivalTag,
  className,
}: {
  myRating: number;
  rivalRating: number;
  games: number;
  rivalTag: string;
  className?: string;
}) {
  const outcomes = pointsAtStake(myRating, rivalRating, games);
  const expected = Math.round(expectedScore(myRating, rivalRating) * 100);
  const diff = myRating - rivalRating;

  return (
    <div className={cn("rounded-md border border-gold-500/40 bg-void-950/50 p-3", className)}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-200">
          <TrendingUp className="h-3.5 w-3.5" /> Puntos en juego
        </p>
        <p className="text-[11px] text-stone-400">
          {diff === 0
            ? "Mismo rating"
            : `${Math.abs(diff).toLocaleString("es-MX")} pts ${diff > 0 ? "por encima" : "por debajo"} de [${rivalTag}]`}{" "}
          · se espera que ganes el {expected} % de los juegos
        </p>
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(outcomes.length, 4)}, minmax(0, 1fr))` }}>
        {outcomes.map((o) => (
          <div
            key={`${o.mine}-${o.theirs}`}
            className={cn(
              "rounded border px-2 py-1.5 text-center",
              // El color sigue a los puntos, no al resultado: perder 1-2 ante un rival muy superior también suma
              o.delta > 0 ? "border-win/25 bg-win/[0.06]" : o.delta < 0 ? "border-blood/25 bg-blood/[0.06]" : "border-void-500 bg-void-800/50",
            )}
          >
            <p className="text-[10px] text-stone-400">
              {o.mine}-{o.theirs}
            </p>
            <p className={cn("font-display text-sm font-bold tabular-nums", tone(o.delta))}>{signed(o.delta)}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-stone-400">
        Estimado con los ratings actuales. Rendir mejor de lo esperado suma aunque pierdas el scrim. Si el marcador no completa todos los juegos, se calcula con los
        jugados.
      </p>
    </div>
  );
}

/** Puntos exactos para un marcador concreto (registro de resultado). */
export function ResultPoints({ myRating, rivalRating, mine, theirs, myTag, rivalTag }: { myRating: number; rivalRating: number; mine: number; theirs: number; myTag: string; rivalTag: string }) {
  if (mine + theirs === 0) return <p className="text-center text-xs text-stone-400">Elige el marcador para ver cuántos puntos cambian.</p>;
  const d = eloDelta(myRating, rivalRating, mine, theirs);
  return (
    <p className="text-center text-xs text-stone-300">
      Con {mine}-{theirs}: <b className={tone(d)}>{signed(d)} pts</b> para [{myTag}] · <b className={tone(-d)}>{signed(-d)} pts</b> para [{rivalTag}]
    </p>
  );
}
