import { db } from "@/lib/db";
import { fail, withTeam } from "@/lib/api";
import { generateInviteCode } from "@/lib/team";

/** Regenera el código de invitación (solo Coach). */
export const POST = withTeam(async ({ user }) => {
  if (user.role !== "COACH") fail(403, "Solo el coach puede regenerar el código");
  const team = await db.team.update({ where: { id: user.teamId }, data: { inviteCode: generateInviteCode() } });
  return { inviteCode: team.inviteCode };
});
