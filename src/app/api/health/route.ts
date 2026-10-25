import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Sin parámetros solo confirma que el servidor responde, sin tocar la base de datos:
// así el health check de Render no mantiene despierta la base de Neon (que se suspende sola y cobra por horas activas).
// Con ?db=1 también comprueba la conexión a PostgreSQL.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("db") !== "1") return NextResponse.json({ ok: true });
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: true });
  } catch {
    return NextResponse.json({ ok: false, db: false }, { status: 503 });
  }
}
