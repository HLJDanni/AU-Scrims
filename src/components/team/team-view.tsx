"use client";
import { motion } from "framer-motion";
import { AlertTriangle, BarChart3, Copy, KeyRound, LogOut, RefreshCw, Settings, ShieldCheck, Trash2, UserMinus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { api, cn } from "@/lib/client";
import { REGIONS, ROLE_META, TEAM_COLORS, type Role } from "@/lib/constants";
import { tierFor } from "@/lib/elo";
import { Tabs, TabPanel } from "../ui/tabs";
import { EmptyState, PageHeader, RoleBadge, Skeleton, StatCard, TeamEmblem } from "../ui/misc";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { useShell } from "../app-shell";

type TeamData = {
  team: { id: string; name: string; tag: string; color: string; region: string; rating: number; createdAt: string; inviteCode: string };
  members: { id: string; username: string; role: Role; createdAt: string }[];
  canManage: boolean;
  stats: {
    rank: number;
    scrimsPlayed: number;
    scrimWins: number;
    gamesWon: number;
    gamesLost: number;
    winRate: number;
    byOpponent: { team: { id: string; name: string; tag: string; color: string }; won: number; lost: number; scrims: number }[];
  };
};

type Tab = "roster" | "invite" | "stats" | "settings";

export function TeamView() {
  const { data, mutate } = useSWR<TeamData>("/api/team");
  const [tab, setTab] = useState<Tab>("roster");

  if (!data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-80" />
      </div>
    );

  const tier = tierFor(data.team.rating);
  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center gap-5">
        <TeamEmblem team={data.team} size={72} />
        <div className="flex-1">
          <PageHeader eyebrow={`${data.team.region} · Puesto #${data.stats.rank}`} title={data.team.name} />
          <p className="-mt-4 text-sm">
            <span style={{ color: tier.color }} className="font-semibold">
              {tier.name}
            </span>
            <span className="text-stone-400"> · {data.team.rating} pts · {data.members.length} miembros del staff</span>
          </p>
        </div>
      </motion.div>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        className="mb-6"
        tabs={[
          { id: "roster", label: "Staff", icon: <Users className="h-4 w-4" />, count: data.members.length },
          { id: "invite", label: "Invitación", icon: <KeyRound className="h-4 w-4" /> },
          { id: "stats", label: "Estadísticas", icon: <BarChart3 className="h-4 w-4" /> },
          ...(data.canManage ? [{ id: "settings" as const, label: "Ajustes", icon: <Settings className="h-4 w-4" /> }] : []),
        ]}
      />
      <TabPanel id={tab}>
        {tab === "roster" && <Roster data={data} onChange={() => mutate()} />}
        {tab === "invite" && <Invite data={data} onChange={() => mutate()} />}
        {tab === "stats" && <Stats data={data} />}
        {tab === "settings" && data.canManage && (
          <div className="space-y-6">
            <TeamSettings data={data} onChange={() => mutate()} />
            <DangerZone data={data} />
          </div>
        )}
      </TabPanel>
    </>
  );
}

function Roster({ data, onChange }: { data: TeamData; onChange: () => void }) {
  const { user } = useShell();
  const router = useRouter();
  const roles: Role[] = ["COACH", "ANALYST", "CAPTAIN"];

  async function remove(id: string, name: string) {
    const self = id === user.id;
    if (!window.confirm(self ? "¿Salir del equipo? Perderás acceso a sus scrims." : `¿Quitar a ${name} del staff?`)) return;
    try {
      await api(`/api/team/members/${id}`, { method: "DELETE" });
      if (self) {
        router.replace("/onboarding");
        router.refresh();
      } else {
        toast.success(`${name} ya no forma parte del staff`);
        onChange();
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {roles.map((role, ri) => {
        const members = data.members.filter((m) => m.role === role);
        return (
          <motion.div key={role} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ri * 0.07 }} className="hex-panel p-5">
            <div className="mb-4">
              <p className="font-display text-base font-bold tracking-wider text-gold-50">{ROLE_META[role].label}es</p>
              <p className="text-xs text-stone-400">{ROLE_META[role].description}</p>
            </div>
            <div className="space-y-2">
              {members.length === 0 && <p className="rounded-md border border-dashed border-void-500 p-4 text-center text-xs text-stone-400">Sin miembros</p>}
              {members.map((m) => (
                <div key={m.id} className="group flex items-center gap-3 rounded-md bg-void-950/50 px-3 py-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-500/60 bg-void-700 font-display text-xs font-bold text-gold-100">
                    {m.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gold-50">
                      {m.username} {m.id === user.id && <span className="text-xs font-normal text-hex-200">(tú)</span>}
                    </p>
                    <RoleBadge role={m.role} />
                  </div>
                  {(data.canManage || m.id === user.id) && (
                    <button
                      onClick={() => remove(m.id, m.username)}
                      className="rounded-md p-2 text-stone-400 opacity-0 transition hover:bg-blood/10 hover:text-blood group-hover:opacity-100"
                      title={m.id === user.id ? "Salir del equipo" : "Quitar del staff"}
                    >
                      {m.id === user.id ? <LogOut className="h-4 w-4" /> : <UserMinus className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function Invite({ data, onChange }: { data: TeamData; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  async function regenerate() {
    if (!window.confirm("El código anterior dejará de funcionar. ¿Continuar?")) return;
    setBusy(true);
    try {
      await api("/api/team/invite", { method: "POST" });
      toast.success("Nuevo código generado");
      onChange();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="hex-panel mx-auto max-w-xl p-8 text-center">
      <ShieldCheck className="mx-auto h-10 w-10 text-gold-200" />
      <h3 className="mt-3 font-display text-xl font-bold tracking-wide text-gold-50">Código de invitación</h3>
      <p className="mt-1 text-sm text-stone-300">Compártelo solo con el coach, analistas y capitán. Al registrarse elegirán “Unirme a un equipo”.</p>
      <motion.div key={data.team.inviteCode} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto mt-6 inline-flex items-center gap-1">
        {data.team.inviteCode.split("").map((c, i) => (
          <motion.span
            key={i}
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.04 }}
            className="flex h-12 w-10 items-center justify-center rounded-md border border-gold-300/60 bg-void-950 font-display text-xl font-bold text-gold-100"
          >
            {c}
          </motion.span>
        ))}
      </motion.div>
      <div className="mt-6 flex justify-center gap-2">
        <Button
          variant="secondary"
          onClick={() => navigator.clipboard.writeText(data.team.inviteCode).then(() => toast.success("Código copiado"))}
        >
          <Copy className="h-4 w-4" /> Copiar
        </Button>
        {data.canManage && (
          <Button variant="ghost" loading={busy} onClick={regenerate}>
            <RefreshCw className="h-4 w-4" /> Regenerar
          </Button>
        )}
      </div>
    </div>
  );
}

function Stats({ data }: { data: TeamData }) {
  const s = data.stats;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Puesto" value={`#${s.rank}`} hint={`${data.team.rating} pts`} />
        <StatCard label="Scrims" value={s.scrimsPlayed} hint={`${s.scrimWins} ganados`} accent="hex" delay={0.05} />
        <StatCard label="Juegos" value={`${s.gamesWon}-${s.gamesLost}`} hint="Ganados - perdidos" delay={0.1} />
        <StatCard label="Win rate" value={`${s.winRate}%`} hint="Por juegos" accent="hex" delay={0.15} />
      </div>
      <div className="hex-panel p-5">
        <p className="mb-4 font-display text-sm font-semibold uppercase tracking-widest text-gold-200">Récord contra rivales</p>
        {s.byOpponent.length === 0 ? (
          <EmptyState icon={<BarChart3 className="h-6 w-6" />} title="Sin datos aún" text="Registra resultados para ver tu récord por rival." />
        ) : (
          <div className="space-y-3">
            {s.byOpponent.map((o, i) => {
              const total = o.won + o.lost || 1;
              return (
                <div key={o.team.id} className="flex items-center gap-3">
                  <TeamEmblem team={o.team} size={32} />
                  <div className="w-36 truncate text-sm text-gold-50">{o.team.name}</div>
                  <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-void-600">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(o.won / total) * 100}%` }} transition={{ delay: i * 0.05, duration: 0.6 }} className="bg-win" />
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(o.lost / total) * 100}%` }} transition={{ delay: i * 0.05, duration: 0.6 }} className="bg-blood/80" />
                  </div>
                  <span className="w-24 text-right text-xs text-stone-300">
                    {o.won}-{o.lost} · {o.scrims} scrim{o.scrims > 1 ? "s" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamSettings({ data, onChange }: { data: TeamData; onChange: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: data.team.name, tag: data.team.tag, region: data.team.region, color: data.team.color });
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm({ name: data.team.name, tag: data.team.tag, region: data.team.region, color: data.team.color }), [data.team]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/team", { method: "PATCH", body: form });
      toast.success("Equipo actualizado");
      onChange();
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="hex-panel grid max-w-3xl gap-5 p-6 md:grid-cols-[1fr_auto]">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Nombre</label>
          <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Tag</label>
          <input className="field uppercase" maxLength={5} value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value.toUpperCase() })} />
        </div>
        <div>
          <label className="label">Región</label>
          <select className="field" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
            {REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Color del emblema</label>
          <div className="flex flex-wrap gap-2">
            {TEAM_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setForm({ ...form, color: c })}
                className={cn("h-8 w-8 rounded-full border-2 transition-transform hover:scale-110", form.color === c ? "scale-110 border-gold-50" : "border-transparent")}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" loading={saving}>
            Guardar cambios
          </Button>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-md border border-void-500 bg-void-950/50 p-6">
        <p className="label">Vista previa</p>
        <TeamEmblem team={{ tag: form.tag || "??", color: form.color }} size={96} />
        <p className="mt-2 font-display font-bold text-gold-50">{form.name}</p>
      </div>
    </form>
  );
}

function DangerZone({ data }: { data: TeamData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = confirm.trim() === data.team.name;

  async function remove() {
    setBusy(true);
    try {
      await api("/api/team", { method: "DELETE", body: { confirmName: confirm.trim() } });
      toast.success(`${data.team.name} fue eliminado`);
      router.replace("/onboarding");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl rounded-md border border-blood/40 bg-blood/5 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-display text-base font-bold tracking-wide text-blood">
            <AlertTriangle className="h-4 w-4" /> Zona de peligro
          </p>
          <p className="mt-1 text-sm text-stone-300">
            Eliminar el equipo borra sus scrims (también del historial de los rivales) y deja a todo el staff sin equipo. No se puede deshacer.
          </p>
        </div>
        <Button
          variant="danger"
          className="shrink-0 whitespace-nowrap"
          onClick={() => {
            setConfirm("");
            setOpen(true);
          }}
        >
          <Trash2 className="h-4 w-4" /> Eliminar equipo
        </Button>
      </div>

      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Eliminar equipo" subtitle="Esta acción es permanente">
        <div className="space-y-5">
          <ul className="space-y-1.5 rounded-md border border-blood/30 bg-blood/5 p-4 text-sm text-stone-300">
            <li>• Se eliminarán todos los scrims de <b className="text-gold-50">{data.team.name}</b>, incluidos los finalizados.</li>
            <li>• Los {data.members.length} miembros del staff quedarán sin equipo.</li>
            <li>• El equipo desaparecerá del ranking.</li>
          </ul>
          <div>
            <label htmlFor="confirm-team" className="label normal-case tracking-normal">
              Escribe <span className="font-bold text-gold-50">{data.team.name}</span> para confirmar
            </label>
            <input id="confirm-team" className="field" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="danger" disabled={!matches} loading={busy} onClick={remove}>
              Eliminar definitivamente
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
