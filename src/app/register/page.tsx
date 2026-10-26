"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Crown, KeyRound, Megaphone, PlusCircle, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api, cn } from "@/lib/client";
import { ROLE_META, type Role } from "@/lib/constants";
import { AuthFrame } from "@/components/auth/auth-frame";
import { TeamFields, emptyTeam } from "@/components/auth/team-fields";
import { LegendPlayerFields, emptyLegendPlayer, legendPlayerBody } from "@/components/auth/legend-player-fields";
import { Button } from "@/components/ui/button";

const ROLE_ICONS: Record<Role, React.ReactNode> = {
  COACH: <Crown className="h-5 w-5" />,
  ANALYST: <BarChart3 className="h-5 w-5" />,
  CAPTAIN: <Megaphone className="h-5 w-5" />,
  LEGEND: <Sparkles className="h-5 w-5" />,
};

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [account, setAccount] = useState({ username: "", email: "", password: "" });
  const [role, setRole] = useState<Role>("COACH");
  const [mode, setMode] = useState<"create" | "join" | "none">("create");
  const legend = role === "LEGEND";
  const modes = legend
    ? [
        { id: "join" as const, label: "Unirme con código", icon: <KeyRound className="h-5 w-5" /> },
        { id: "none" as const, label: "Sin equipo", icon: <Sparkles className="h-5 w-5" /> },
      ]
    : [
        { id: "create" as const, label: "Crear equipo", icon: <PlusCircle className="h-5 w-5" /> },
        { id: "join" as const, label: "Unirme con código", icon: <KeyRound className="h-5 w-5" /> },
      ];
  const [team, setTeam] = useState(emptyTeam);
  const [inviteCode, setInviteCode] = useState("");
  const [legendPlayer, setLegendPlayer] = useState(emptyLegendPlayer);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) return setStep(2);
    const withPlayer = legend && mode === "join";
    const player = withPlayer ? legendPlayerBody(legendPlayer) : null;
    if (player && !player.ok) return toast.error(player.error);
    setLoading(true);
    try {
      const res = await api<{ joinedRoster: boolean }>("/api/auth/register", {
        body: {
          ...account,
          role,
          mode,
          team: mode === "create" ? { ...team, logo: team.logo ?? undefined } : undefined,
          inviteCode: mode === "join" ? inviteCode : undefined,
          player: player?.ok ? player.body : undefined,
        },
      });
      toast.success("¡Bienvenido a AU Scrims!", { description: res.joinedRoster ? "Ya formas parte del roster de tu equipo." : undefined });
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
      title="Crear cuenta de staff"
      subtitle={step === 1 ? "Paso 1 de 2 · Tu cuenta y tu rol" : "Paso 2 de 2 · Tu equipo"}
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-semibold text-gold-200 hover:text-gold-50">
            Inicia sesión
          </Link>
        </>
      }
    >
      <div className="mb-6 flex gap-2">
        {[1, 2].map((s) => (
          <div key={s} className="h-1 flex-1 overflow-hidden rounded-full bg-void-600">
            <motion.div className="h-full bg-gold-gradient" initial={false} animate={{ width: step >= s ? "100%" : "0%" }} transition={{ duration: 0.4 }} />
          </div>
        ))}
      </div>
      <form onSubmit={submit}>
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div key="s1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Usuario</label>
                  <input className="field" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_.]+" autoComplete="username" value={account.username} onChange={(e) => setAccount({ ...account, username: e.target.value })} />
                </div>
                <div>
                  <label className="label">Correo</label>
                  <input className="field" type="email" required autoComplete="email" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Contraseña</label>
                  <input className="field" type="password" required minLength={8} autoComplete="new-password" value={account.password} onChange={(e) => setAccount({ ...account, password: e.target.value })} />
                  <p className="mt-1 text-xs text-stone-400">Mínimo 8 caracteres, con letras y números.</p>
                </div>
              </div>
              <div>
                <label className="label">Rol en el equipo</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(ROLE_META) as Role[]).map((r) => (
                    <motion.button
                      type="button"
                      key={r}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setRole(r);
                        setMode(r === "LEGEND" ? "none" : "create");
                      }}
                      className={cn(
                        "relative rounded-md border p-4 text-left transition-colors",
                        role === r ? "border-gold-200 bg-gold-200/10 shadow-gold" : "border-void-500 bg-void-950/50 hover:border-gold-500",
                      )}
                    >
                      <span className={role === r ? "text-gold-200" : "text-stone-300"}>{ROLE_ICONS[r]}</span>
                      <p className="mt-2 font-display font-bold tracking-wide text-gold-50">{ROLE_META[r].label}</p>
                      <p className="mt-0.5 text-xs text-stone-400">{ROLE_META[r].description}</p>
                    </motion.button>
                  ))}
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full">
                Continuar
              </Button>
            </motion.div>
          ) : (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {modes.map((m) => (
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
              <AnimatePresence mode="wait">
                {mode === "none" ? (
                  <motion.div key="none" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                    <p className="rounded-md border border-[#B57BFF]/40 bg-[#B57BFF]/10 p-4 text-sm text-stone-300">
                      Como Leyenda sin equipo podrás ver el ranking de equipos, el ranking de jugadores y los torneos. Si luego te unes a un equipo, verás también
                      sus scrims y su roster, siempre en modo de solo lectura.
                    </p>
                  </motion.div>
                ) : mode === "create" ? (
                  <motion.div key="create" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                    <TeamFields value={team} onChange={setTeam} />
                  </motion.div>
                ) : (
                  <motion.div key="join" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                    <label className="label">Código de invitación</label>
                    <input
                      className="field text-center font-display text-xl tracking-[0.4em] uppercase"
                      required
                      maxLength={12}
                      placeholder="XXXXXXXX"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    />
                    <p className="mt-1.5 text-xs text-stone-400">Pídelo al coach de tu equipo (Mi equipo → Invitación).</p>
                    {legend && (
                      <div className="mt-4">
                        <LegendPlayerFields value={legendPlayer} onChange={setLegendPlayer} />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                  Atrás
                </Button>
                <Button type="submit" size="lg" className="flex-1" loading={loading}>
                  Crear cuenta
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </AuthFrame>
  );
}
