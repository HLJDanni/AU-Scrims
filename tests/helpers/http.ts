// Cliente HTTP mínimo con cookie de sesión, para probar la API "desde fuera" (caja negra).
export const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
export const PASSWORD = process.env.SEED_PASSWORD ?? "Scrims2026!";

export type Res<T = any> = { status: number; body: T; headers: Headers };

export class ApiClient {
  cookie = "";

  async req<T = any>(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<Res<T>> {
    const res = await fetch(BASE_URL + path, {
      method,
      redirect: "manual",
      headers: {
        Origin: BASE_URL,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...extraHeaders,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    const text = await res.text();
    let parsed: any = text;
    try {
      parsed = JSON.parse(text);
    } catch {}
    return { status: res.status, body: parsed, headers: res.headers };
  }

  get = <T = any>(p: string) => this.req<T>("GET", p);
  post = <T = any>(p: string, b: unknown = {}) => this.req<T>("POST", p, b);
  patch = <T = any>(p: string, b: unknown) => this.req<T>("PATCH", p, b);

  async login(identifier: string, password = PASSWORD) {
    const r = await this.post("/api/auth/login", { identifier, password });
    if (r.status !== 200) throw new Error(`Login falló para ${identifier}: ${r.status} ${JSON.stringify(r.body)}`);
    return this;
  }
}

export async function loggedIn(identifier: string) {
  return new ApiClient().login(identifier);
}

/** Bloque horario lejano y aleatorio para no chocar con datos existentes ni entre corridas. */
export function farSlot(hours = 2, games = 3) {
  const start = new Date();
  start.setDate(start.getDate() + 120 + Math.floor(Math.random() * 600));
  start.setHours(8 + Math.floor(Math.random() * 10), [0, 15, 30, 45][Math.floor(Math.random() * 4)], 0, 0);
  const end = new Date(start.getTime() + hours * 3600_000);
  return { startAt: start.toISOString(), endAt: end.toISOString(), games };
}

export async function teamId(client: ApiClient, tag: string): Promise<string> {
  const r = await client.get(`/api/teams?q=${tag}`);
  // /api/teams excluye al propio equipo, así que se revisa también /me
  const own = (await client.get("/api/auth/me")).body.user.team;
  const t = own?.tag === tag ? own : r.body.teams.find((x: { tag: string }) => x.tag === tag);
  if (!t) throw new Error(`Equipo ${tag} no encontrado`);
  return t.id;
}
