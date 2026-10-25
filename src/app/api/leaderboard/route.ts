import { withUser } from "@/lib/api";
import { getLeaderboard } from "@/lib/leaderboard";

export const GET = withUser(async () => ({ teams: await getLeaderboard() }));
