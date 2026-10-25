"use client";
import { AlertCircle, CheckCircle2, ExternalLink, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { api, cn } from "@/lib/client";
import { LOL_TIERS, OPGG_ERRORS, POSITIONS, parseOpggUrl, type LolTier, type Position } from "@/lib/lol";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { EmptyState, Skeleton } from "../ui/misc";
import { EloAverageBadge, PlayerList, type PlayerDTO, type TeamProfile } from "./team-profile";

export function PlayersTab({ canEdit }: { canEdit: boolean }) {
  const { data, mutate } = useSWR<TeamProfile>("/api/team/players");
  const [editing, setEditing] = useState<PlayerDTO | null | undefined>(undefined); // undefined = cerrado, null = nuevo

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

  if (!data) return <Skeleton className="h-72" />;
  const starters = data.players.filter((p) => p.position !== "SUB");
  const subs = data.players.filter((p) => p.position === "SUB");
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
            Registra la <b className="text-gold-100">cuenta principal</b> de cada jugador (no smurfs) con su <b className="text-gold-100">link de op.gg</b>, que es obligatorio. El ELO promedio se calcula con los 5 titulares y lo ven los rivales en el detalle del scrim.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <EloAverageBadge elo={data.eloAverage} />
          {canEdit && (
            <Button onClick={() => setEditing(null)} disabled={data.players.length >= 10}>
              <Plus className="h-4 w-4" /> Jugador
            </Button>
          )}
        </div>
      </div>

      {data.players.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-6 w-6" />}
          title="Sin jugadores registrados"
          text={canEdit ? "Agrega a los titulares con su Riot ID principal y su rango actual de SoloQ." : "El coach o el capitán pueden registrar a los jugadores."}
          action={canEdit ? <Button onClick={() => setEditing(null)}>Agregar jugador</Button> : undefined}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-200">Titulares ({starters.length}/5)</h3>
            <PlayerList players={starters} actions={actions} />
          </section>
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-200">Suplentes ({subs.length})</h3>
            <PlayerList players={subs} actions={actions} />
          </section>
        </div>
      )}
      {!canEdit && <p className="text-xs text-stone-400">Solo el coach o el capitán pueden editar el roster.</p>}

      <PlayerForm
        open={editing !== undefined}
        player={editing ?? undefined}
        teamRegion={data.team.region}
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
  taken,
  onClose,
  onSaved,
}: {
  open: boolean;
  player?: PlayerDTO;
  teamRegion: string;
  taken: Position[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [opgg, setOpgg] = useState("");
  const [position, setPosition] = useState<Position>("TOP");
  const [tier, setTier] = useState<LolTier | "">("");
  const [division, setDivision] = useState(4);
  const [lp, setLp] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOpgg(player?.opgg ?? "");
    setPosition(player?.position ?? POSITIONS.find((p) => p.id !== "SUB" && !taken.includes(p.id))?.id ?? "SUB");
    setTier(player?.tier ?? "");
    setDivision(player?.division ?? 4);
    setLp(player?.lp ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, player]);

  const parsed = opgg.trim() ? parseOpggUrl(opgg) : null;
  const wrongRegion = parsed?.ok && parsed.region !== teamRegion;
  const valid = Boolean(parsed?.ok) && !wrongRegion;
  const apex = tier && !LOL_TIERS.find((t) => t.id === tier)!.divisions;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed?.ok) return toast.error(parsed ? OPGG_ERRORS[parsed.error] : "El link de op.gg es obligatorio");
    if (wrongRegion) return toast.error(`El perfil es del servidor ${parsed.region}, pero el equipo juega en ${teamRegion}`);
    setSaving(true);
    try {
      const body = { opgg: parsed.url, position, tier: tier || null, division: tier && !apex ? division : null, lp: tier ? lp : 0 };
      await api(player ? `/api/team/players/${player.id}` : "/api/team/players", { method: player ? "PATCH" : "POST", body });
      toast.success(player ? "Jugador actualizado" : `${parsed.gameName}#${parsed.tagLine} agregado al roster`);
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

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label htmlFor="tier" className="label">
              Rango SoloQ
            </label>
            <select id="tier" className="field" value={tier} onChange={(e) => setTier(e.target.value as LolTier | "")}>
              <option value="">Sin rango</option>
              {LOL_TIERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="division" className="label">
              División
            </label>
            <select id="division" className="field" value={division} disabled={!tier || Boolean(apex)} onChange={(e) => setDivision(Number(e.target.value))}>
              {[1, 2, 3, 4].map((d) => (
                <option key={d} value={d}>
                  {["I", "II", "III", "IV"][d - 1]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="lp" className="label">
              LP
            </label>
            <input id="lp" type="number" min={0} max={apex ? 3000 : 99} className="field" value={lp} disabled={!tier} onChange={(e) => setLp(Number(e.target.value))} />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-void-500/60 pt-5">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} disabled={!valid}>
            {player ? "Guardar" : "Agregar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
