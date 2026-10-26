import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { fail, parseBody, publicRoute } from "@/lib/api";
import { registerSchema } from "@/lib/validators";
import { generateInviteCode } from "@/lib/team";
import { logoData } from "@/lib/logo";
import { preparePlayer } from "@/lib/players";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const POST = publicRoute(async (req) => {
  if (!rateLimit(`register:${clientIp(req)}`, 5, 10 * 60_000)) fail(429, "Demasiados intentos, espera unos minutos");
  const body = await parseBody(req, registerSchema);

  const exists = await db.user.findFirst({
    where: { OR: [{ email: body.email }, { username: { equals: body.username, mode: "insensitive" } }] },
    select: { email: true },
  });
  if (exists) fail(409, exists!.email === body.email ? "Ese correo ya está registrado" : "Ese usuario ya existe");

  // Unirse con código: el equipo se busca antes para validar (y consultar a Riot) fuera de la transacción
  const joinTeam = body.mode === "join" ? await db.team.findUnique({ where: { inviteCode: body.inviteCode! }, select: { id: true, region: true } }) : null;
  if (body.mode === "join" && !joinTeam) fail(404, "Código de invitación inválido");
  // La Leyenda que se une con código entra también como jugador del roster
  const player = body.role === "LEGEND" && joinTeam && body.player ? await preparePlayer(joinTeam, body.player) : null;

  const passwordHash = await bcrypt.hash(body.password, 12);

  const user = await db.$transaction(async (tx) => {
    let teamId: string | null = joinTeam?.id ?? null;
    if (body.mode === "create") {
      const { logo, ...t } = body.team!;
      const dup = await tx.team.findFirst({
        where: { OR: [{ name: { equals: t.name, mode: "insensitive" } }, { tag: t.tag }] },
      });
      if (dup) fail(409, "Ya existe un equipo con ese nombre o tag");
      const team = await tx.team.create({ data: { ...t, ...logoData(logo), inviteCode: generateInviteCode() }, select: { id: true } });
      teamId = team.id;
    }
    const created = await tx.user.create({
      data: { username: body.username, email: body.email, passwordHash, role: body.role, teamId },
    });
    if (player) await tx.player.create({ data: { ...player, userId: created.id } });
    return created;
  });

  await createSession({ sub: user.id, role: user.role });
  return { ok: true, joinedRoster: Boolean(player) };
});
