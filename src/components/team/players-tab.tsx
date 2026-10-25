"use client";
import { AlertCircle, CheckCircle2, ExternalLink, Info, Pencil, Plus, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { api, cn } from "@/lib/client";
import { OPGG_ERRORS, POSITIONS, formatRank, parseOpggUrl, type Position } from "@/lib/lol";
import { fromNow } from "@/lib/dates";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { EmptyState, Skeleton } from "../ui/misc";
import { EloAverageBadge, PlayerList, type PlayerDTO, type TeamProfile } from "./team-profile";

export function PlayersTab({ canEdit }: { canEdit: boolean }) {
  const { data, mutate } = useSWR<TeamProfile>("/api/team/players");
  const [editing, setEditing] = useState<PlayerDTO | null | undefined>(undefined); // undefined = cerrado, null = nuevo
  const [syncing, setSyncing] = useState(false);

  async function remove(p: PlayerDTO) {
    if (!window.confirm(`¿Quitar a ${p.riotId} del roster?`)) return;
    try {
      await api(`/api/team/players/${p.id}`, { method: "DELETE" });
      toast.success(`${p.riotId} fue quitado del roster`);
      mutate();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function sync() {
    setSyncing(true);
    try {
      const r = await api<{ updated: number; failed: { riotId: string; error: string }[] }>("/api/team/players/sync", { method: "POST" });
      if (r.failed.length) toast.warning(`${r.updated} actualizados · ${r.failed.length} con error`, { description: r.failed.map((f) => `${f.riotId}: ${f.error}`).join("\n") });
      else toast.success(`Rangos actualizados (${r.updated} jugadores)`);
      mutate();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  if (!data) return <Skeleton className="h-72" />;
  const starters = data.players.filter((p) => p.position !== "SUB");
  const subs = data.players.filter((p) => p.position === "SUB");
  const lastSync = data.players
    .map((p) => p.rankUpdatedAt)
    .filter(Boolean)
    .sort()
    .at(0);
  const actions = canEdit
    ? (p: PlayerDTO) => (
        <div className="flex opacity-60 transition-opacity duration-100 group-hover:opacity-100">
          <button onClick={() => setEditing(p)} className="rounded p-1.5 text-stone-400 hover:bg-void-700 hover:text-gold-50" aria-label={`Editar ${p.riotId}`}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => remove(p)} className="rounded p-1.5 text-stone-400 hover:bg-blood/10 hover:text-blood" aria-label={`Quitar ${p.riotId}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )
    : undefined;

  return (
    <div className="space-y-5">
      <div className="hex-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-base font-bold tracking-wide text-gold-50">Roster de League of Legends</p>
          <p className="mt-1 max-w-xl text-sm text-stone-300">
            Registra la <b className="text-gold-100">cuenta principal</b> de cada jugador con su <b className="text-gold-100">link de op.gg</b>. El rango,
            la división y los LP se traen solos desde Riot, la misma fuente que usa op.gg.
          </p>
          {data.rankSync && (
            <p className="mt-1 text-xs text-stone-400">{lastSync ? `Rangos actualizados ${fromNow(lastSync)}` : "Rangos aún sin sincronizar"}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <EloAverageBadge elo={data.eloAverage} />
          {data.rankSync && data.players.length > 0 && (
            <Button variant="secondary" onClick={sync} loading={syncing}>
              {!syncing && <RefreshCw className="h-4 w-4" />} Actualizar rangos
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => setEditing(null)} disabled={data.players.length >= 10}>
              <Plus className="h-4 w-4" /> Jugador
            </Button>
          )}
        </div>
      </div>

      {!data.rankSync && (
        <div className="flex items-start gap-3 rounded-md border border-gold-300/40 bg-gold-700/15 p-4 text-sm text-stone-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold-200" />
          <p>
            La sincronización automática de rangos está <b className="text-gold-100">desactivada</b>: falta configurar <code className="text-gold-100">RIOT_API_KEY</code> en
            el servidor. Los jugadores se registran igual, pero sin rango hasta que se configure la clave.
          </p>
        </div>
      )}

      {data.players.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-6 w-6" />}
          title="Sin jugadores registrados"
          text={canEdit ? "Agrega a los titulares pegando el link de op.gg de su cuenta principal." : "El coach o el capitán pueden registrar a los jugadores."}
          action={canEdit ? <Button onClick={() => setEditing(null)}>Agregar jugador</Button> : undefined}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-200">Titulares ({starters.length}/5)</h3>
            <PlayerList players={starters} actions={actions} showAccount />
          </section>
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-200">Suplentes ({subs.length})</h3>
            <PlayerList players={subs} actions={actions} showAccount />
          </section>
        </div>
      )}
      {!canEdit && <p className="text-xs text-stone-400">Solo el coach o el capitán pueden editar el roster.</p>}

      <PlayerForm
        open={editing !== undefined}
        player={editing ?? undefined}
        teamRegion={data.team.region}
        rankSync={data.rankSync}
        taken={starters.filter((p) => p.id !== editing?.id).map((p) => p.position)}
        onClose={() => setEditing(undefined)}
        onSaved={() => {
          setEditing(undefined);
          mutate();
        }}
      />
    </div>
  );
}

function PlayerForm({
  open,
  player,
  teamRegion,
  rankSync,
  taken,
  onClose,
  onSaved,
}: {
  open: boolean;
  player?: PlayerDTO;
  teamRegion: string;
  rankSync: boolean;
  taken: Position[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [opgg, setOpgg] = useState("");
  const [position, setPosition] = useState<Position>("TOP");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOpgg(player?.opgg ?? "");
    setPosition(player?.position ?? POSITIONS.find((p) => p.id !== "SUB" && !taken.includes(p.id))?.id ?? "SUB");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, player]);

  const parsed = opgg.trim() ? parseOpggUrl(opgg) : null;
  const wrongRegion = parsed?.ok && parsed.region !== teamRegion;
  const valid = Boolean(parsed?.ok) && !wrongRegion;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed?.ok) return toast.error(parsed ? OPGG_ERRORS[parsed.error] : "El link de op.gg es obligatorio");
    if (wrongRegion) return toast.error(`El perfil es del servidor ${parsed.region}, pero el equipo juega en ${teamRegion}`);
    setSaving(true);
    try {
      const res = await api<{ player: PlayerDTO }>(player ? `/api/team/players/${player.id}` : "/api/team/players", {
        method: player ? "PATCH" : "POST",
        body: { opgg: parsed.url, position },
      });
      const p = res.player;
      toast.success(player ? "Jugador actualizado" : `${p.riotId} agregado al roster`, {
        description: p.rankUpdatedAt ? `Rango traído de Riot: ${p.tier ? `${formatRank(p.tier, p.division, p.lp)}${p.division ? ` · ${p.lp} LP` : ""}` : "sin rango en SoloQ"}` : undefined,
      });
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={player ? "Editar jugador" : "Agregar jugador"} subtitle="Usa la cuenta principal del jugador, no una smurf">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="opgg" className="label">
            Link de op.gg <span className="text-blood">*</span>
          </label>
          <input
            id="opgg"
            type="url"
            inputMode="url"
            className={cn("field", parsed && !valid && "border-blood/70", valid && "border-win/60")}
            placeholder={`https://op.gg/lol/summoners/${teamRegion.toLowerCase()}/Nombre-TAG`}
            autoComplete="off"
            value={opgg}
            onChange={(e) => setOpgg(e.target.value)}
            required
          />
          {!parsed && (
            <p className="mt-1.5 text-xs text-stone-400">
              Obligatorio. Abre el perfil de la <b className="text-gold-100">cuenta principal</b> en op.gg y copia el link de la barra de direcciones.
            </p>
          )}
          {parsed && !parsed.ok && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-blood">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {OPGG_ERRORS[parsed.error]}
            </p>
          )}
          {parsed?.ok && (
            <div
              className={cn(
                "mt-2 flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                wrongRegion ? "border-blood/50 bg-blood/5 text-blood" : "border-win/40 bg-win/5 text-gold-50",
              )}
            >
              {wrongRegion ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-win" />}
              <span className="min-w-0 flex-1 truncate">
                {wrongRegion ? (
                  <>Servidor {parsed.region}: el equipo juega en {teamRegion}</>
                ) : (
                  <>
                    <b>{parsed.gameName}</b>
                    <span className="text-stone-400">#{parsed.tagLine}</span> · {parsed.region}
                  </>
                )}
              </span>
              <a href={parsed.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-hex-100 hover:underline">
                Verificar <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>

        <div>
          <span className="label">Posición</span>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {POSITIONS.map((p) => {
              const busy = p.id !== "SUB" && taken.includes(p.id);
              return (
                <button
                  type="button"
                  key={p.id}
                  disabled={busy}
                  title={busy ? "Ya hay un titular en esta posición" : undefined}
                  onClick={() => setPosition(p.id)}
                  className={cn(
                    "rounded-md border px-2 py-2 text-xs font-semibold transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-35",
                    position === p.id ? "border-gold-200 bg-gold-200/15 text-gold-50" : "border-void-500 text-stone-300 hover:border-gold-500",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <p
          className={cn(
            "flex items-start gap-2 rounded-md border px-3 py-2.5 text-xs",
            rankSync ? "border-hex-200/30 bg-hex-500/20 text-stone-300" : "border-gold-300/40 bg-gold-700/15 text-stone-300",
          )}
        >
          <Info className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", rankSync ? "text-hex-200" : "text-gold-200")} />
          {rankSync
            ? "El rango, la división, los LP, el nivel y las partidas de SoloQ se traen automáticamente de Riot al guardar. También se verifica que la cuenta exista."
            : "Sin RIOT_API_KEY configurada el jugador se guardará sin rango. Cuando se configure la clave, usa “Actualizar rangos”."}
        </p>

        <div className="flex justify-end gap-2 border-t border-void-500/60 pt-5">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} disabled={!valid}>
            {player ? "Guardar" : rankSync ? "Agregar y traer rango" : "Agregar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
