"use client";
import { REGIONS, TEAM_COLORS } from "@/lib/constants";
import { cn } from "@/lib/client";
import { TeamEmblem } from "../ui/misc";

export type TeamDraft = { name: string; tag: string; region: string; color: string };
export const emptyTeam: TeamDraft = { name: "", tag: "", region: "LAN", color: TEAM_COLORS[0] };

export function TeamFields({ value, onChange }: { value: TeamDraft; onChange: (v: TeamDraft) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Nombre del equipo</label>
          <input className="field" required minLength={3} maxLength={40} placeholder="Ej. Arcane Union" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Tag</label>
          <input className="field uppercase" required minLength={2} maxLength={5} placeholder="AU" value={value.tag} onChange={(e) => onChange({ ...value, tag: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} />
        </div>
        <div>
          <label className="label">Región</label>
          <select className="field" value={value.region} onChange={(e) => onChange({ ...value, region: e.target.value })}>
            {REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Color</label>
          <div className="flex flex-wrap gap-2">
            {TEAM_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => onChange({ ...value, color: c })}
                className={cn("h-7 w-7 rounded-full border-2 transition-transform hover:scale-110", value.color === c ? "scale-110 border-gold-50" : "border-transparent")}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="hidden flex-col items-center justify-center gap-2 rounded-md border border-void-500 bg-void-950/50 px-6 sm:flex">
        <TeamEmblem team={{ tag: value.tag || "TAG", color: value.color }} size={80} />
        <p className="max-w-[120px] truncate text-center text-xs text-stone-300">{value.name || "Tu equipo"}</p>
      </div>
    </div>
  );
}
