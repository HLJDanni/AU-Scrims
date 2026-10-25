// Firma y verificación de sesiones. Sin dependencias de Node para poder usarse en el middleware (Edge).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "aus_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 días

export type SessionPayload = { sub: string; role: "COACH" | "ANALYST" | "CAPTAIN" };

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error("JWT_SECRET debe tener al menos 32 caracteres");
  return new TextEncoder().encode(value);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { sub: payload.sub, role: payload.role as SessionPayload["role"] };
  } catch {
    return null;
  }
}
