export type Role = "COACH" | "ANALYST" | "CAPTAIN" | "LEGEND";

/** Coach, analista y capitán gestionan; la Leyenda solo consulta. */
export const STAFF_ROLES: Role[] = ["COACH", "ANALYST", "CAPTAIN"];
export const isStaff = (role: string) => (STAFF_ROLES as string[]).includes(role);
export type ScrimStatus = "PENDING" | "CONFIRMED" | "DECLINED" | "CANCELLED" | "COMPLETED";

export const ROLE_META: Record<Role, { label: string; short: string; description: string }> = {
  COACH: { label: "Coach", short: "COA", description: "Dirige al equipo y administra el roster" },
  ANALYST: { label: "Analista", short: "ANA", description: "Revisa partidas, drafts y estadísticas" },
  CAPTAIN: { label: "Capitán", short: "CAP", description: "Líder dentro del juego y voz del equipo" },
  LEGEND: { label: "Leyenda", short: "LEY", description: "Ve el ranking y los torneos; con equipo, solo los datos de su equipo" },
};

export const STATUS_META: Record<ScrimStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Pendiente", color: "#C89B3C", bg: "rgba(200,155,60,.14)" },
  CONFIRMED: { label: "Confirmado", color: "#0AC8B9", bg: "rgba(10,200,185,.14)" },
  DECLINED: { label: "Rechazado", color: "#E84057", bg: "rgba(232,64,87,.12)" },
  CANCELLED: { label: "Cancelado", color: "#7B7A72", bg: "rgba(123,122,114,.15)" },
  COMPLETED: { label: "Finalizado", color: "#F0E6D2", bg: "rgba(240,230,210,.10)" },
};

export const REGIONS = ["LAN", "LAS", "NA", "BR", "EUW", "EUNE", "KR", "OCE"] as const;

export const TEAM_COLORS = ["#C8AA6E", "#0AC8B9", "#E84057", "#9D48E0", "#576BCE", "#2DD4A8", "#F0E6D2", "#C86B3C"];

export type TeamLite = { id: string; name: string; tag: string; color: string; rating: number; region?: string };

export type ScrimDTO = {
  id: string;
  isHost: boolean;
  myTeam: TeamLite;
  opponent: TeamLite;
  startAt: string;
  endAt: string;
  games: number;
  status: ScrimStatus;
  roomLink: string | null;
  notes: string | null;
  createdBy: string | null;
  proposal: { startAt: string; endAt: string; games: number; byMe: boolean } | null;
  myScore: number | null;
  opponentScore: number | null;
  ratingDelta: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ScrimEventDTO = { id: string; type: string; message: string; actor: string | null; createdAt: string };
