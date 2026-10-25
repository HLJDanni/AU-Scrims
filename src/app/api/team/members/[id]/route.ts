import { db } from "@/lib/db";
import { fail, withTeam } from "@/lib/api";

/** Quitar a un miembro del staff (Coach), o salir del equipo (uno mismo). */
export const DELETE = withTeam<{ id: string }>(async ({ user, params }) => {
  const self = params.id === user.id;
  if (!self && user.role !== "COACH") fail(403, "Solo el coach puede quitar miembros");
  const member = await db.user.findUnique({ where: { id: params.id } });
  if (!member || member.teamId !== user.teamId) fail(404, "Miembro no encontrado");
  await db.user.update({ where: { id: params.id }, data: { teamId: null } });
  return { ok: true, left: self };
});
