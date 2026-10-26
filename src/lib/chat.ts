import "server-only";
import type { Prisma, Scrim } from "@prisma/client";
import { db } from "./db";
import { fail } from "./api";
import { loadOwnScrim } from "./scrims";
import type { ChatMessageDTO } from "./constants";

// El chat existe desde que el rival acepta el scrim. Un scrim cancelado conserva su chat como historial (solo lectura).
export const chatWritable = (s: Pick<Scrim, "status">) => s.status === "CONFIRMED" || s.status === "COMPLETED";

/** Carga el scrim del chat verificando que el equipo del usuario participe y que el chat ya exista. */
export async function loadChatScrim(id: string, teamId: string) {
  const scrim = await loadOwnScrim(id, teamId);
  if (chatWritable(scrim)) return scrim;
  if (scrim.status === "CANCELLED" && (await db.scrimMessage.count({ where: { scrimId: scrim.id } })) > 0) return scrim;
  return fail(403, "El chat se abre cuando el rival acepta el scrim");
}

export const messageInclude = {
  author: { select: { username: true, role: true } },
  team: { select: { id: true, tag: true, color: true, logoUpdatedAt: true } },
} satisfies Prisma.ScrimMessageInclude;

type MessageRow = Prisma.ScrimMessageGetPayload<{ include: typeof messageInclude }>;

export function toMessageDTO(m: MessageRow, userId: string): ChatMessageDTO {
  return {
    id: m.id,
    body: m.body,
    system: m.system,
    author: m.author?.username ?? null,
    authorRole: m.author?.role ?? null,
    team: m.team,
    mine: m.authorId === userId,
    createdAt: m.createdAt.toISOString(),
  };
}

export function systemMessage(tx: Prisma.TransactionClient, scrimId: string, body: string) {
  return tx.scrimMessage.create({ data: { scrimId, system: true, body } });
}

export function markRead(userId: string, scrimId: string, at = new Date()) {
  return db.chatRead.upsert({
    where: { userId_scrimId: { userId, scrimId } },
    create: { userId, scrimId, lastReadAt: at },
    update: { lastReadAt: at },
  });
}
