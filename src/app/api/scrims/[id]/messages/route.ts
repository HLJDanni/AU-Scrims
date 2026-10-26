import { db } from "@/lib/db";
import { fail, parseBody, withStaff, withTeam } from "@/lib/api";
import { messageSchema } from "@/lib/validators";
import { chatWritable, loadChatScrim, markRead, messageInclude, toMessageDTO } from "@/lib/chat";
import { rateLimit } from "@/lib/rate-limit";

/** Mensajes del chat. Con ?after=ISO solo los nuevos (la interfaz consulta cada pocos segundos). */
export const GET = withTeam<{ id: string }>(async ({ req, user, params }) => {
  const scrim = await loadChatScrim(params.id, user.teamId);
  const after = new URL(req.url).searchParams.get("after");
  const since = after ? new Date(after) : null;
  if (since && Number.isNaN(since.getTime())) fail(400, "Fecha inválida");

  const rows = since
    ? await db.scrimMessage.findMany({ where: { scrimId: scrim.id, createdAt: { gt: since } }, include: messageInclude, orderBy: { createdAt: "asc" }, take: 200 })
    : (await db.scrimMessage.findMany({ where: { scrimId: scrim.id }, include: messageInclude, orderBy: { createdAt: "desc" }, take: 200 })).reverse();
  return { messages: rows.map((m) => toMessageDTO(m, user.id)), writable: chatWritable(scrim) && user.role !== "LEGEND" };
});

export const POST = withStaff<{ id: string }>(async ({ req, user, params }) => {
  if (!rateLimit(`chat:${user.id}`, 20, 10_000)) fail(429, "Vas muy rápido: espera unos segundos");
  const { body } = await parseBody(req, messageSchema);
  const scrim = await loadChatScrim(params.id, user.teamId);
  if (!chatWritable(scrim)) fail(400, "Este scrim fue cancelado: el chat es solo de lectura");

  const message = await db.scrimMessage.create({ data: { scrimId: scrim.id, authorId: user.id, teamId: user.teamId, body }, include: messageInclude });
  await markRead(user.id, scrim.id, message.createdAt);
  return { message: toMessageDTO(message, user.id) };
});
