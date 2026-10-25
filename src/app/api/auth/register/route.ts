import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { fail, parseBody, publicRoute } from "@/lib/api";
import { registerSchema } from "@/lib/validators";
import { generateInviteCode } from "@/lib/team";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const POST = publicRoute(async (req) => {
  if (!rateLimit(`register:${clientIp(req)}`, 5, 10 * 60_000)) fail(429, "Demasiados intentos, espera unos minutos");
  const body = await parseBody(req, registerSchema);

  const exists = await db.user.findFirst({
    where: { OR: [{ email: body.email }, { username: { equals: body.username, mode: "insensitive" } }] },
    select: { email: true },
  });
  if (exists) fail(409, exists!.email === body.email ? "Ese correo ya está registrado" : "Ese usuario ya existe");

  const passwordHash = await bcrypt.hash(body.password, 12);

  const user = await db.$transaction(async (tx) => {
    let teamId: string;
    if (body.mode === "create") {
      const t = body.team!;
      const dup = await tx.team.findFirst({
        where: { OR: [{ name: { equals: t.name, mode: "insensitive" } }, { tag: t.tag }] },
      });
      if (dup) fail(409, "Ya existe un equipo con ese nombre o tag");
      const team = await tx.team.create({ data: { ...t, inviteCode: generateInviteCode() } });
      teamId = team.id;
    } else {
      const team = await tx.team.findUnique({ where: { inviteCode: body.inviteCode! } });
      if (!team) fail(404, "Código de invitación inválido");
      teamId = team!.id;
    }
    return tx.user.create({
      data: { username: body.username, email: body.email, passwordHash, role: body.role, teamId },
    });
  });

  await createSession({ sub: user.id, role: user.role });
  return { ok: true };
});
