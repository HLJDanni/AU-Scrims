import { withUser } from "@/lib/api";
import { getChampions } from "@/lib/champions";

export const GET = withUser(async () => {
  const { version, list } = await getChampions();
  return { version, champions: list };
});
