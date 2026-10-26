"use client";
import { AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/client";
import { OPGG_ERRORS, POSITIONS, parseOpggUrl, type Position } from "@/lib/lol";

export type LegendPlayer = { opgg: string; position: Position };
export const emptyLegendPlayer: LegendPlayer = { opgg: "", position: "SUB" };

/** op.gg y posición de la Leyenda que entra al roster del equipo que le dio el código. */
export function LegendPlayerFields({ value, onChange }: { value: LegendPlayer; onChange: (v: LegendPlayer) => void }) {
  const parsed = value.opgg.trim() ? parseOpggUrl(value.opgg) : null;
  return (
    <div className="space-y-4 rounded-md border border-[#B57BFF]/40 bg-[#B57BFF]/10 p-4">
      <p className="text-sm text-stone-300">
        Como Leyenda entras al <b className="text-gold-50">roster del equipo</b> como jugador. El equipo verá tu rango de SoloQ (se trae de Riot); seguirás en modo de solo
        lectura.
      </p>
      <div>
        <label htmlFor="legend-opgg" className="label">
          Tu link de op.gg <span className="text-blood">*</span>
        </label>
        <input
          id="legend-opgg"
          type="url"
          inputMode="url"
          required
          autoComplete="off"
          placeholder="https://op.gg/lol/summoners/lan/Nombre-TAG"
          className={cn("field", parsed && !parsed.ok && "border-blood/70", parsed?.ok && "border-win/60")}
          value={value.opgg}
          onChange={(e) => onChange({ ...value, opgg: e.target.value })}
        />
        {!parsed && <p className="mt-1.5 text-xs text-stone-400">Abre el perfil de tu cuenta principal en op.gg y copia el link. Debe ser del servidor del equipo.</p>}
        {parsed && !parsed.ok && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-blood">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {OPGG_ERRORS[parsed.error]}
          </p>
        )}
        {parsed?.ok && (
          <p className="mt-1.5 flex items-center gap-2 text-xs text-gold-50">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-win" />
            <b>{parsed.gameName}</b>
            <span className="text-stone-400">
              #{parsed.tagLine} · {parsed.region}
            </span>
            <a href={parsed.url} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-hex-100 hover:underline">
              Verificar <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        )}
      </div>
      <div>
        <span className="label">Tu posición</span>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {POSITIONS.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => onChange({ ...value, position: p.id })}
              className={cn(
                "rounded-md border px-2 py-2 text-xs font-semibold transition-colors",
                value.position === p.id ? "border-gold-200 bg-gold-200/15 text-gold-50" : "border-void-500 text-stone-300 hover:border-gold-500",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-stone-400">Si el equipo ya tiene titular en esa posición, elige Suplente (máximo 3 por equipo).</p>
      </div>
    </div>
  );
}

/** Cuerpo para la API, o un mensaje de error si el link no es válido. */
export function legendPlayerBody(v: LegendPlayer): { ok: true; body: { opgg: string; position: Position } } | { ok: false; error: string } {
  const parsed = v.opgg.trim() ? parseOpggUrl(v.opgg) : null;
  if (!parsed) return { ok: false, error: "Agrega tu link de op.gg" };
  if (!parsed.ok) return { ok: false, error: OPGG_ERRORS[parsed.error] };
  return { ok: true, body: { opgg: parsed.url, position: v.position } };
}
