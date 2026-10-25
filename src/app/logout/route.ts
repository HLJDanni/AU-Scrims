import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/jwt";

export function GET() {
  // Redirección relativa: dentro del contenedor req.url es http://0.0.0.0:3000 y el navegador no podría abrirla
  const res = new NextResponse(null, { status: 307, headers: { Location: "/login" } });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
