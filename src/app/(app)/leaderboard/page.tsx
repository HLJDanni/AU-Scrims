import type { Metadata } from "next";
import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";

export const metadata: Metadata = { title: "Ranking" };

export default function LeaderboardPage() {
  return <LeaderboardView />;
}
