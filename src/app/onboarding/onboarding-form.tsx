"use client";
import { useRouter } from "next/navigation";
import { KeyRound, PlusCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api, cn } from "@/lib/client";
import { AuthFrame } from "@/components/auth/auth-frame";
import { TeamFields, emptyTeam } from "@/components/auth/team-fields";
import { LegendPlayerFields, emptyLegendPlayer, legendPlayerBody } from "@/components/auth/legend-player-fields";
import { Button } from "@/components/ui/button";

export function OnboardingForm({ username, legend = false }: { username: string; legend?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("join");
  // La Leyenda no crea equipos: solo se une con código o sigue como espectadora
  const [team, setTeam] = useState(emptyTeam);
  const [code, setCode] = useState("");
  const [player, setPlayer] = useState(emptyLegendPlayer);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = legend ? legendPlayerBody(player) : null;
    if (p && !p.ok) return toast.error(p.error);
    setLoading(true);
    try {
      if (mode === "create") await api("/api/team", { body: { ...team, logo: team.logo ?? undefined } });
      else await api("/api/team/join", { body: { inviteCode: code, player: p?.ok ? p.body : undefined } });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <AuthFrame
      wide
      title={`Hola, ${username}`}
      subtitle={legend ? "Únete a un equipo con su código para ver sus scrims, o sigue como espectador" : "Necesitas pertenecer a un equipo para agendar y ver scrims"}
      footer={
        <a href="/logout" className="text-stone-400 hover:text-gold-50">
          Cerrar sesión
        </a>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <div className={cn("grid gap-3", legend ? "grid-cols-1" : "grid-cols-2")}>
          {[
            { id: "join" as const, label: "Unirme con código", icon: <KeyRound className="h-5 w-5" /> },
            ...(legend ? [] : [{ id: "create" as const, label: "Crear equipo", icon: <PlusCircle className="h-5 w-5" /> }]),
          ].map((m) => (
            <button
              type="button"
              key={m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm font-semibold transition",
                mode === m.id ? "border-gold-200 bg-gold-200/10 text-gold-50" : "border-void-500 text-stone-300 hover:border-gold-500",
              )}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
        {mode === "create" ? (
          <TeamFields value={team} onChange={setTeam} />
        ) : (
          <input
            className="field text-center font-display text-xl uppercase tracking-[0.4em]"
            required
            placeholder="XXXXXXXX"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        )}
        {mode === "join" && legend && <LegendPlayerFields value={player} onChange={setPlayer} />}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Continuar
        </Button>
        {legend && (
          <a href="/leaderboard" className="block text-center text-sm text-stone-300 hover:text-gold-50">
            Seguir como espectador (sin equipo)
          </a>
        )}
      </form>
    </AuthFrame>
  );
}
