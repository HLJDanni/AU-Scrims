import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { fail, parseBody, publicRoute } from "@/lib/api";
import { loginSchema } from "@/lib/validators";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Hash ficticio para que el tiempo de respuesta no revele si el usuario existe
let dummyHash: string | undefined;
const getDummyHash = async () => (dummyHash ??= await bcrypt.hash("not-a-real-password", 12));

export const POST = publicRoute(async (req) => {
  const body = await parseBody(req, loginSchema);
  if (!rateLimit(`login:${clientIp(req)}:${body.identifier.toLowerCase()}`, 8, 5 * 60_000))
    fail(429, "Demasiados intentos, espera unos minutos");

  const id = body.identifier.toLowerCase();
  const user = await db.user.findFirst({
    where: { OR: [{ email: id }, { username: { equals: body.identifier, mode: "insensitive" } }] },
  });
  const ok = await bcrypt.compare(body.password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !ok) fail(401, "Usuario o contraseña incorrectos");

  await createSession({ sub: user!.id, role: user!.role });
  return { ok: true, hasTeam: Boolean(user!.teamId) };
});
