"use client";
import { motion } from "framer-motion";
import { AlertTriangle, ExternalLink, Lock, Users } from "lucide-react";
import useSWR from "swr";
import { POSITIONS, formatRank, tierMeta, type LolTier, type Position } from "@/lib/lol";
import { cn } from "@/lib/client";
import { Skeleton, TeamEmblem } from "../ui/misc";
import { RankIcon } from "../ui/rank-icon";

export type PlayerDTO = {
  id: string;
  gameName: string;
  tagLine: string;
  riotId: string;
  position: Position;
  tier: LolTier | null;
  division: number | null;
  lp: number;
  opgg: string;
  level: number | null;
  wins: number | null;
  losses: number | null;
  rankUpdatedAt: string | null;
  account?: string | null;
};

export type TeamProfile = {
  team: { id: string; name: string; tag: string; color: string; region: string; rating: number; description: string | null };
  players: PlayerDTO[];
  eloAverage: { tier: LolTier; label: string; color: string; count: number } | null;
  rankSync: boolean;
  /** Motivo por el que no se envían los jugadores (privacidad mutua), o null si se pueden ver */
  rosterHidden?: string | null;
};

/** Pista de posible smurf: cuenta de nivel bajo o con muy pocas partidas clasificatorias. */
export function lowAccount(p: PlayerDTO) {
  if (p.level == null && p.wins == null) return false;
  return (p.level ?? 999) < 50 || (p.tier != null && (p.wins ?? 0) + (p.losses ?? 0) < 40);
}

function AccountInfo({ p }: { p: PlayerDTO }) {
  if (!p.rankUpdatedAt) return <span className="text-[10px] text-stone-400">Sin sincronizar</span>;
  const games = (p.wins ?? 0) + (p.losses ?? 0);
  return (
    <span className="flex flex-wrap items-center gap-x-2 text-[10px] text-stone-400">
      {p.level != null && <span>Nv. {p.level}</span>}
      {games > 0 && (
        <span>
          {games} partidas · {Math.round(((p.wins ?? 0) / games) * 100)}% WR
        </span>
      )}
      {lowAccount(p) && (
        <span className="flex items-center gap-1 text-gold-300" title="Nivel bajo o pocas partidas: podría no ser la cuenta principal">
          <AlertTriangle className="h-3 w-3" /> Pocas partidas
        </span>
      )}
    </span>
  );
}

export function RankLabel({ tier, division, lp, className }: { tier: LolTier | null; division: number | null; lp: number; className?: string }) {
  const color = tier ? tierMeta(tier).color : "#7B7A72";
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold", className)} style={{ color }}>
      <RankIcon tier={tier} size={20} />
      {formatRank(tier, division, lp)}
      {tier && tierMeta(tier).divisions && <span className="font-normal text-stone-400">{lp} LP</span>}
    </span>
  );
}

export function PositionBadge({ position }: { position: Position }) {
  const p = POSITIONS.find((x) => x.id === position)!;
  return (
    <span
      className={cn(
        "inline-flex w-10 justify-center rounded border py-0.5 text-[10px] font-bold tracking-wider",
        position === "SUB" ? "border-void-500 text-stone-400" : "border-gold-500/60 bg-gold-700/20 text-gold-100",
      )}
    >
      {p.short}
    </span>
  );
}

export function EloAverageBadge({ elo }: { elo: TeamProfile["eloAverage"] }) {
  return (
    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-void-500 bg-void-950/60 py-2 pl-2 pr-3">
      <RankIcon tier={elo?.tier} size={40} title={elo?.label} />
      <div className="text-right">
        <p className="text-[10px] uppercase tracking-wider text-stone-400">ELO promedio</p>
        {elo ? (
          <>
            <p className="font-display text-sm font-bold" style={{ color: elo.color }}>
              {elo.label}
            </p>
            <p className="text-[10px] text-stone-400">{elo.count} jugadores con rango</p>
          </>
        ) : (
          <p className="text-sm text-stone-400">Sin datos</p>
        )}
      </div>
    </div>
  );
}

/** Lista de jugadores: Riot ID principal, posición, rango y link a op.gg. */
export function PlayerList({ players, actions, showAccount }: { players: PlayerDTO[]; actions?: (p: PlayerDTO) => React.ReactNode; showAccount?: boolean }) {
  if (!players.length)
    return (
      <p className="flex items-center gap-2 rounded-md border border-dashed border-void-500 p-4 text-sm text-stone-400">
        <Users className="h-4 w-4" /> Aún no hay jugadores registrados.
      </p>
    );
  return (
    <ul className="divide-y divide-void-500/40 overflow-hidden rounded-md border border-void-500/60 bg-void-950/40">
      {players.map((p, i) => (
        <motion.li
          key={p.id}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.18 }}
          className="group flex items-center gap-3 px-3 py-2.5"
        >
          <PositionBadge position={p.position} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gold-50">
              {p.gameName}
              <span className="font-normal text-stone-400">#{p.tagLine}</span>
              {p.account && (
                <span title={`Cuenta de AU Scrims: ${p.account}`} className="ml-2 rounded border border-[#B57BFF]/50 bg-[#B57BFF]/10 px-1.5 py-px align-middle text-[9px] font-bold uppercase tracking-widest text-[#B57BFF]">
                  Leyenda · {p.account}
                </span>
              )}
            </p>
            <RankLabel tier={p.tier} division={p.division} lp={p.lp} />
            {showAccount ? <AccountInfo p={p} /> : lowAccount(p) && <AccountInfo p={p} />}
          </div>
          <a
            href={p.opgg}
            target="_blank"
            rel="noopener noreferrer"
            title="Ver en op.gg"
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-stone-400 transition-colors duration-100 hover:bg-void-700 hover:text-hex-100"
          >
            op.gg <ExternalLink className="h-3 w-3" />
          </a>
          {actions?.(p)}
        </motion.li>
      ))}
    </ul>
  );
}

/** Tarjeta compacta del equipo para el detalle del scrim. */
export function TeamProfileCard({ teamId, label }: { teamId: string; label: string }) {
  const { data } = useSWR<TeamProfile>(`/api/teams/${teamId}/profile`);
  if (!data) return <Skeleton className="h-48" />;
  const starters = data.players.filter((p) => p.position !== "SUB");
  const subs = data.players.filter((p) => p.position === "SUB");
  return (
    <div className="rounded-md border border-void-500/60 bg-void-950/40 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <TeamEmblem team={data.team} size={38} />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-hex-200">{label}</p>
            <p className="truncate font-semibold text-gold-50">{data.team.name}</p>
          </div>
        </div>
        <EloAverageBadge elo={data.eloAverage} />
      </div>
      <p className={cn("mb-3 whitespace-pre-wrap text-sm", data.team.description ? "text-stone-300" : "italic text-stone-400")}>
        {data.team.description || "Este equipo aún no tiene descripción."}
      </p>
      {data.rosterHidden ? (
        <p className="flex items-center gap-2 rounded-md border border-dashed border-void-500 p-3 text-xs text-stone-400">
          <Lock className="h-3.5 w-3.5 shrink-0" /> Roster privado · {data.rosterHidden}
        </p>
      ) : (
        <PlayerList players={starters} />
      )}
      {subs.length > 0 && (
        <details className="mt-2 group">
          <summary className="cursor-pointer select-none text-xs text-stone-400 hover:text-gold-100">Suplentes ({subs.length})</summary>
          <div className="mt-2">
            <PlayerList players={subs} />
          </div>
        </details>
      )}
    </div>
  );
}
