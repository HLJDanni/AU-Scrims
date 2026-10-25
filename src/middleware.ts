import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/jwt";

const APP_PAGES = ["/dashboard", "/calendar", "/scrims", "/leaderboard", "/players", "/tournaments", "/team", "/onboarding"];
const AUTH_PAGES = ["/login", "/register"];
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protección CSRF: las peticiones que modifican datos deben venir del mismo origen
  if (pathname.startsWith("/api/") && MUTATING.has(req.method)) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
    }
    return NextResponse.next();
  }

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (APP_PAGES.some((p) => pathname.startsWith(p)) && !session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (AUTH_PAGES.includes(pathname) && session) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|ranks/).*)"],
};
