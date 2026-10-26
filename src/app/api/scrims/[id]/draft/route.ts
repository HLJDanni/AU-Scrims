import { fail, parseBody, withStaff, withTeam } from "@/lib/api";
import { draftActionSchema } from "@/lib/validators";
import { chatWritable, loadChatScrim } from "@/lib/chat";
import { draftState, loadGames, resolveTimeouts, runCommand } from "@/lib/draft-server";
import { rateLimit } from "@/lib/rate-limit";

/** Estado del draft de la serie. Cada consulta también resuelve un turno cuyo tiempo se agotó. */
export const GET = withTeam<{ id: string }>(async ({ user, params }) => {
  const scrim = await loadChatScrim(params.id, user.teamId);
  let games = await loadGames(scrim.id);
  if (await resolveTimeouts(scrim, games)) games = await loadGames(scrim.id);
  return draftState(scrim, games, user);
});

export const POST = withStaff<{ id: string }>(async ({ req, user, params }) => {
  if (!rateLimit(`draft:${user.id}`, 40, 10_000)) fail(429, "Demasiadas acciones seguidas: espera un momento");
  const cmd = await parseBody(req, draftActionSchema);
  const scrim = await loadChatScrim(params.id, user.teamId);
  if (!chatWritable(scrim)) fail(400, "Este scrim fue cancelado: el draft es solo de lectura");
  await runCommand(scrim, await loadGames(scrim.id), user, cmd);
  // Se vuelve a leer: la acción pudo cambiar el modo de la serie o el juego
  return draftState(await loadChatScrim(params.id, user.teamId), await loadGames(scrim.id), user);
});
