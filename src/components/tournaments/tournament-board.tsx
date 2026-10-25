"use client";
import { motion } from "framer-motion";
import { Ban, Crown, Flag, ListOrdered, LogIn, LogOut, Network, Play, Swords, Trophy, Users } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { api, cn } from "@/lib/client";
import { DIVISIONS, MIN_TEAMS } from "@/lib/tournament-rules";
import { fromNow } from "@/lib/dates";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { Skeleton, TeamEmblem } from "../ui/misc";
import { Tabs, TabPanel } from "../ui/tabs";
import { RankIcon } from "../ui/rank-icon";
import { ENTRY_LABEL, STATUS_LABEL, type MatchDTO, type TournamentDetail } from "./types";
import { SwissBracket } from "./swiss-bracket";

type View = "bracket" | "table";

export function TournamentBoard({ id, onChanged }: { id: string; onChanged?: () => void }) {
  const { data, mutate } = useSWR<TournamentDetail>(`/api/tournaments/${id}`, { refreshInterval: 15_000 });
  const [view, setView] = useState<View>("bracket");
  const [busy, setBusy] = useState<string | null>(null);
  const [reporting, setReporting] = useState<MatchDTO | null>(null);

  async function act(key: string, path: string, success: string, method = "POST") {
    setBusy(key);
    try {
      await api(path, { method, body: method === "POST" ? {} : undefined });
      toast.success(success);
      await mutate();
      onChanged?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <Skeleton className="h-96" />;
  const { tournament: t, me, table } = data;
  const div = DIVISIONS[t.division];
  const status = STATUS_LABEL[t.status];

  return (
    <div className="space-y-5">
      <div className="hex-panel overflow-hidden p-5">
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: `radial-gradient(520px 160px at 0% 0%, ${div.color}22, transparent)` }} />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <RankIcon tier={div.icon} size={56} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: div.color }}>
                {div.name} · {div.range}
              </p>
              <h2 className="font-display text-xl font-bold tracking-wide text-gold-50">{t.name}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-300">
                <span className="flex items-center gap-1.5 font-semibold" style={{ color: status.color }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
                  {status.label}
                  {t.status === "ACTIVE" && ` · Ronda ${t.round}`}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {table.length} equipos
                </span>
                <span className="flex items-center gap-1">
                  <Crown className="h-3.5 w-3.5" /> Organiza [{t.organizer.tag}]
                </span>
                <span>Suizo: {t.winsToQualify} victorias clasifican · {t.lossesToEliminate} derrotas eliminan</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {me.canJoin && (
              <Button loading={busy === "join"} onClick={() => act("join", `/api/tournaments/${t.id}/join`, "Equipo inscrito")}>
                <LogIn className="h-4 w-4" /> Inscribir a mi equipo
              </Button>
            )}
            {me.canLeave && (
              <Button variant="ghost" loading={busy === "leave"} onClick={() => act("leave", `/api/tournaments/${t.id}/leave`, "Inscripción retirada")}>
                <LogOut className="h-4 w-4" /> Retirarme
              </Button>
            )}
            {me.canStart && (
              <Button
                variant="hex"
                disabled={table.length < MIN_TEAMS}
                title={table.length < MIN_TEAMS ? `Se necesitan al menos ${MIN_TEAMS} equipos` : undefined}
                loading={busy === "start"}
                onClick={() => window.confirm("¿Cerrar inscripciones y generar la ronda 1?") && act("start", `/api/tournaments/${t.id}/start`, "¡Torneo iniciado!")}
              >
                <Play className="h-4 w-4" /> Iniciar torneo
              </Button>
            )}
            {me.canCancel && (
              <Button
                variant="danger"
                loading={busy === "cancel"}
                onClick={() => window.confirm("¿Cancelar el torneo? Se borran las inscripciones.") && act("cancel", `/api/tournaments/${t.id}`, "Torneo cancelado", "DELETE")}
              >
                <Ban className="h-4 w-4" /> Cancelar
              </Button>
            )}
          </div>
        </div>
        {!me.entered && me.joinBlocked && t.status === "REGISTRATION" && (
          <p className="relative mt-3 rounded-md border border-void-500 bg-void-950/60 px-3 py-2 text-xs text-stone-300">{me.joinBlocked}</p>
        )}
      </div>

      {t.status === "REGISTRATION" ? (
        <Registration data={data} />
      ) : (
        <>
          {t.status === "FINISHED" && <Podium data={data} />}
          <Tabs<View>
            value={view}
            onChange={setView}
            size="sm"
            tabs={[
              { id: "bracket", label: "Bracket", icon: <Network className="h-3.5 w-3.5" /> },
              { id: "table", label: "Clasificación", icon: <ListOrdered className="h-3.5 w-3.5" /> },
            ]}
          />
          <TabPanel id={view}>{view === "bracket" ? <SwissBracket data={data} onReport={setReporting} /> : <Standings data={data} />}</TabPanel>
        </>
      )}

      <ReportModal
        match={reporting}
        tournamentId={t.id}
        onClose={() => setReporting(null)}
        onSaved={async () => {
          setReporting(null);
          await mutate();
          onChanged?.();
        }}
      />
    </div>
  );
}

function Registration({ data }: { data: TournamentDetail }) {
  return (
    <div>
      <p className="mb-3 text-sm text-stone-300">
        Equipos inscritos ({data.table.length}/16). Se necesitan al menos {MIN_TEAMS} para iniciar; la siembra se hace por puntos de ranking.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {[...data.table]
          .sort((a, b) => b.ratingAtJoin - a.ratingAtJoin)
          .map((e, i) => (
            <motion.div
              key={e.team.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.18 }}
              className={cn("flex items-center gap-3 rounded-md border bg-void-900/70 p-3", e.team.id === data.me.teamId ? "border-hex-200/60" : "border-void-500/70")}
            >
              <TeamEmblem team={e.team} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gold-50">{e.team.name}</p>
                <p className="text-[11px] text-stone-400">
                  {e.ratingAtJoin.toLocaleString("es-MX")} pts · ELO {e.eloAtJoin}
                </p>
              </div>
              {e.team.id === data.tournament.organizer.id && <Crown className="h-4 w-4 text-gold-300" />}
            </motion.div>
          ))}
      </div>
    </div>
  );
}

function Podium({ data }: { data: TournamentDetail }) {
  const qualified = data.table.filter((e) => e.status === "QUALIFIED");
  return (
    <div className="rounded-md border border-win/30 bg-win/5 p-4">
      <p className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-widest text-win">
        <Trophy className="h-4 w-4" /> Clasificados ({qualified.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {qualified.map((e) => (
          <span key={e.team.id} className="flex items-center gap-2 rounded-full border border-win/30 bg-void-900/80 py-1 pl-1 pr-3 text-sm text-gold-50">
            <TeamEmblem team={e.team} size={26} />
            {e.team.name}
            <span className="text-xs text-stone-400">
              {e.wins}-{e.losses}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Standings({ data }: { data: TournamentDetail }) {
  return (
    <div className="hex-panel overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-stone-400">
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Equipo</th>
            <th className="px-4 py-3 text-center">Récord</th>
            <th className="px-4 py-3 text-center" title="Suma de victorias de los rivales enfrentados">
              Buchholz
            </th>
            <th className="px-4 py-3 text-center">Siembra</th>
            <th className="px-4 py-3">ELO al inscribirse</th>
            <th className="px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody>
          {data.table.map((e) => (
            <tr key={e.team.id} className={cn("border-t border-void-500/40", e.team.id === data.me.teamId && "bg-hex-500/25")}>
              <td className="px-4 py-2.5 font-display font-bold text-gold-100">{e.position}</td>
              <td className="px-4 py-2.5">
                <span className="flex items-center gap-2">
                  <TeamEmblem team={e.team} size={28} />
                  <span className="font-semibold text-gold-50">{e.team.name}</span>
                </span>
              </td>
              <td className="px-4 py-2.5 text-center font-display font-bold">
                <span className="text-win">{e.wins}</span>
                <span className="text-stone-400"> - </span>
                <span className="text-blood">{e.losses}</span>
              </td>
              <td className="px-4 py-2.5 text-center text-stone-300">{e.buchholz}</td>
              <td className="px-4 py-2.5 text-center text-stone-300">{e.seed ?? "—"}</td>
              <td className="px-4 py-2.5 text-stone-300">{e.eloAtJoin}</td>
              <td className="px-4 py-2.5">
                <span className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", ENTRY_LABEL[e.status].cls)}>
                  {ENTRY_LABEL[e.status].label}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportModal({ match, tournamentId, onClose, onSaved }: { match: MatchDTO | null; tournamentId: string; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  if (!match) return <Modal open={false} onClose={onClose}>{null}</Modal>;
  const need = Math.ceil(match.bestOf / 2);
  const options: [number, number][] = match.bestOf === 1 ? [[1, 0], [0, 1]] : [[2, 0], [2, 1], [1, 2], [0, 2]];

  async function save(scoreA: number, scoreB: number) {
    setSaving(true);
    try {
      await api(`/api/tournaments/${tournamentId}/matches/${match!.id}`, { body: { scoreA, scoreB } });
      toast.success(`Resultado registrado: ${match!.teamA.tag} ${scoreA} - ${scoreB} ${match!.teamB!.tag}`);
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Registrar resultado" subtitle={`Bo${match.bestOf} · gana quien llegue a ${need}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-md border border-void-500 bg-void-950/50 p-4">
          <span className="flex min-w-0 items-center gap-2">
            <TeamEmblem team={match.teamA} size={34} />
            <span className="truncate font-semibold text-gold-50">{match.teamA.name}</span>
          </span>
          <Swords className="h-4 w-4 shrink-0 text-gold-200" />
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold text-gold-50">{match.teamB!.name}</span>
            <TeamEmblem team={match.teamB!} size={34} />
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {options.map(([a, b]) => (
            <Button key={`${a}-${b}`} variant="secondary" disabled={saving} onClick={() => save(a, b)} className="normal-case tracking-normal">
              <Flag className="h-3.5 w-3.5" />
              {a > b ? match.teamA.tag : match.teamB!.tag} gana {Math.max(a, b)}-{Math.min(a, b)}
            </Button>
          ))}
        </div>
        <p className="text-xs text-stone-400">Al completarse la ronda, la siguiente se empareja automáticamente por récord.</p>
      </div>
    </Modal>
  );
}

export function TournamentMeta({ createdAt }: { createdAt: string }) {
  return <span className="text-xs text-stone-400">Creado {fromNow(createdAt)}</span>;
}
