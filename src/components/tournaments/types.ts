import type { Division, Eligibility } from "@/lib/tournament-rules";
import type { TeamLite } from "@/lib/constants";

export type TournamentStatus = "REGISTRATION" | "ACTIVE" | "FINISHED";
export type EntryStatus = "ALIVE" | "QUALIFIED" | "ELIMINATED";

export type TournamentSummary = {
  id: string;
  name: string;
  division: Division;
  status: TournamentStatus;
  round: number;
  organizer: TeamLite;
  teams: number;
  qualified: TeamLite[];
  createdAt: string;
  finishedAt: string | null;
};

export type TeamEligibility = Eligibility & { team: TeamLite; scrimWins: number };

export type MatchDTO = {
  id: string;
  teamA: TeamLite;
  teamB: TeamLite | null;
  bestOf: number;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  bye: boolean;
  recordA: string;
  recordB: string | null;
  canReport: boolean;
};

export type TournamentDetail = {
  tournament: {
    id: string;
    name: string;
    division: Division;
    status: TournamentStatus;
    round: number;
    organizer: TeamLite;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    winsToQualify: number;
    lossesToEliminate: number;
  };
  table: {
    team: TeamLite;
    seed: number | null;
    wins: number;
    losses: number;
    status: EntryStatus;
    ratingAtJoin: number;
    eloAtJoin: string;
    buchholz: number;
    position: number;
  }[];
  rounds: { round: number; matches: MatchDTO[] }[];
  me: {
    teamId: string;
    entered: boolean;
    isOrganizer: boolean;
    canJoin: boolean;
    joinBlocked: string | null;
    canLeave: boolean;
    canStart: boolean;
    canCancel: boolean;
  };
};

export const STATUS_LABEL: Record<TournamentStatus, { label: string; color: string }> = {
  REGISTRATION: { label: "Inscripciones abiertas", color: "#C89B3C" },
  ACTIVE: { label: "En curso", color: "#0AC8B9" },
  FINISHED: { label: "Finalizado", color: "#A09B8C" },
};

export const ENTRY_LABEL: Record<EntryStatus, { label: string; cls: string }> = {
  ALIVE: { label: "En juego", cls: "border-gold-300/50 bg-gold-700/20 text-gold-100" },
  QUALIFIED: { label: "Clasificado", cls: "border-win/50 bg-win/10 text-win" },
  ELIMINATED: { label: "Eliminado", cls: "border-blood/40 bg-blood/10 text-blood" },
};
