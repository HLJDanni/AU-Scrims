import { db } from "@/lib/db";
import { withTeam } from "@/lib/api";
import { scrimInclude, toDTO } from "@/lib/scrims";
import { chatWritable } from "@/lib/chat";
import type { ChatSummaryDTO } from "@/lib/constants";

/** Conversaciones de mi equipo (una por scrim aceptado), la más reciente primero, con no leídos. */
export const GET = withTeam(async ({ user }) => {
  const teamId = user.teamId;
  const scrims = await db.scrim.findMany({
    where: {
      AND: [
        { OR: [{ requesterTeamId: teamId }, { opponentTeamId: teamId }] },
        { OR: [{ status: { in: ["CONFIRMED", "COMPLETED"] } }, { status: "CANCELLED", messages: { some: {} } }] },
      ],
    },
    include: {
      ...scrimInclude,
      messages: { orderBy: { createdAt: "desc" }, take: 1, include: { author: { select: { username: true } } } },
      chatReads: { where: { userId: user.id }, select: { lastReadAt: true } },
    },
    orderBy: { startAt: "desc" },
    take: 60,
  });

  const unread = await Promise.all(
    scrims.map((s) =>
      db.scrimMessage.count({
        where: {
          scrimId: s.id,
          createdAt: { gt: s.chatReads[0]?.lastReadAt ?? new Date(0) },
          OR: [{ authorId: null }, { authorId: { not: user.id } }],
        },
      }),
    ),
  );

  const chats: ChatSummaryDTO[] = scrims.map((s, i) => {
    const last = s.messages[0];
    return {
      scrim: toDTO(s, teamId),
      lastMessage: last ? { body: last.body, author: last.author?.username ?? null, system: last.system, createdAt: last.createdAt.toISOString() } : null,
      unread: unread[i],
      writable: chatWritable(s),
    };
  });
  // Primero los que tienen actividad reciente
  const activity = (c: ChatSummaryDTO) => new Date(c.lastMessage?.createdAt ?? c.scrim.updatedAt).getTime();
  chats.sort((a, b) => activity(b) - activity(a));
  return { chats, unread: unread.reduce((a, b) => a + b, 0) };
});
