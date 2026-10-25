import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { Prisma } from "@prisma/client";
import { getCurrentUser, type CurrentUser } from "./auth";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const fail = (status: number, message: string): never => {
  throw new ApiError(status, message);
};

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    fail(400, "Cuerpo de la petición inválido");
  }
  return schema.parse(raw);
}

type Handler<C> = (ctx: { req: Request; user: CurrentUser; params: C }) => Promise<unknown>;
type TeamUser = CurrentUser & { teamId: string; team: NonNullable<CurrentUser["team"]> };

function toResponse(err: unknown) {
  if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof ZodError)
    return NextResponse.json({ error: err.issues[0]?.message ?? "Datos inválidos", issues: err.issues }, { status: 422 });
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
    return NextResponse.json({ error: "Ya existe un registro con esos datos" }, { status: 409 });
  console.error(err);
  return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
}

/** Envuelve un handler: exige sesión y traduce errores a JSON. */
export function withUser<C = Record<string, string>>(handler: Handler<C>) {
  return async (req: Request, ctx: { params: Promise<C> }) => {
    try {
      const user = await getCurrentUser();
      if (!user) fail(401, "No autenticado");
      const params = ctx?.params ? await ctx.params : ({} as C);
      const data = await handler({ req, user: user!, params });
      return data instanceof Response ? data : NextResponse.json(data ?? { ok: true });
    } catch (err) {
      return toResponse(err);
    }
  };
}

/** Igual que withUser pero además exige pertenecer a un equipo. */
export function withTeam<C = Record<string, string>>(handler: (ctx: { req: Request; user: TeamUser; params: C }) => Promise<unknown>) {
  return withUser<C>(async (ctx) => {
    if (!ctx.user.teamId || !ctx.user.team) fail(403, "Necesitas pertenecer a un equipo");
    return handler(ctx as { req: Request; user: TeamUser; params: C });
  });
}

/** Handler público (sin sesión) con el mismo manejo de errores. */
export function publicRoute(handler: (req: Request) => Promise<unknown>) {
  return async (req: Request) => {
    try {
      const data = await handler(req);
      return data instanceof Response ? data : NextResponse.json(data ?? { ok: true });
    } catch (err) {
      return toResponse(err);
    }
  };
}
