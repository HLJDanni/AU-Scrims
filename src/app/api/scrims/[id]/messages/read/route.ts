import { withTeam } from "@/lib/api";
import { loadChatScrim, markRead } from "@/lib/chat";

/** Marca el chat como leído hasta ahora. */
export const POST = withTeam<{ id: string }>(async ({ user, params }) => {
  const scrim = await loadChatScrim(params.id, user.teamId);
  await markRead(user.id, scrim.id);
  return { ok: true };
});
