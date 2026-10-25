import type { Metadata } from "next";
import { PlayersRanking } from "@/components/players/players-ranking";

export const metadata: Metadata = { title: "Jugadores" };

export default function PlayersPage() {
  return <PlayersRanking />;
}
