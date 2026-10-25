import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession, type SessionPayload } from "./jwt";

export async function createSession(payload: SessionPayload) {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Usuario autenticado (o null) con su equipo. */
export async function getCurrentUser() {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return db.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      teamId: true,
      team: { select: { id: true, name: true, tag: true, color: true, region: true, rating: true } },
    },
  });
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Para páginas: exige sesión y equipo, si no redirige. */
export async function requirePageUser({ needsTeam = true } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/logout"); // limpia una cookie huérfana y manda a /login
  // Una Leyenda puede no tener equipo: va al ranking en lugar del onboarding
  if (needsTeam && !user.teamId) redirect(user.role === "LEGEND" ? "/leaderboard" : "/onboarding");
  return user;
}
