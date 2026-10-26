import { db } from "@/lib/db";
import { fail, parseBody, withTeam } from "@/lib/api";
import { memberRoleSchema } from "@/lib/validators";
import { ROLE_META } from "@/lib/constants";

/** Cambiar el rol de un miembro (solo Coach): nombrar capitanes, analistas, otros coaches o Leyendas. */
export const PATCH = withTeam<{ id: string }>(async ({ req, user, params }) => {
  if (user.role !== "COACH") fail(403, "Solo el coach puede asignar roles");
  const { role } = await parseBody(req, memberRoleSchema);
  const member = await db.user.findUnique({ where: { id: params.id }, select: { id: true, teamId: true, role: true, username: true } });
  if (!member || member.teamId !== user.teamId) fail(404, "Miembro no encontrado");
  if (member!.role === role) return { member: { id: member!.id, role } };
  // El equipo nunca se queda sin coach: para dejar de serlo, debe haber otro
  if (member!.id === user.id) {
    const coaches = await db.user.count({ where: { teamId: user.teamId, role: "COACH" } });
    if (coaches < 2) fail(400, "Eres el único coach: nombra a otro coach antes de cambiar tu rol");
  }
  await db.user.update({ where: { id: member!.id }, data: { role } });
  return { member: { id: member!.id, role }, message: `${member!.username} ahora es ${ROLE_META[role].label}` };
});

/** Quitar a un miembro (Coach), o salir del equipo (uno mismo). Si era jugador del roster, también sale del roster. */
export const DELETE = withTeam<{ id: string }>(async ({ user, params }) => {
  const self = params.id === user.id;
  if (!self && user.role !== "COACH") fail(403, "Solo el coach puede quitar miembros");
  const member = await db.user.findUnique({ where: { id: params.id } });
  if (!member || member.teamId !== user.teamId) fail(404, "Miembro no encontrado");
  await db.$transaction([
    db.player.deleteMany({ where: { userId: params.id, teamId: user.teamId } }),
    db.user.update({ where: { id: params.id }, data: { teamId: null } }),
  ]);
  return { ok: true, left: self };
});
