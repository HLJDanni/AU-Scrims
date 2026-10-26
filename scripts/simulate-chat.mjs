// Scrim de prueba para el chat y el draft: HXW (coach.hxw) invita a NXV (coach.nxv), NXV acepta y se abre el chat.
// Borra el scrim de prueba de una corrida anterior, así el draft siempre empieza limpio.
// Uso: node scripts/simulate-chat.mjs   (con el stack levantado y los datos demo)
import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile(".env");
} catch {}
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const PASSWORD = process.env.SEED_PASSWORD || "Scrims2026!";
const TAG = "[demo-chat]"; // marca para encontrar el scrim de la corrida anterior
const db = new PrismaClient();

async function login(username) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { Origin: BASE, "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: username, password: PASSWORD }),
  });
  if (!r.ok) throw new Error(`No se pudo iniciar sesión como ${username} (${r.status}). ¿Están los datos demo?`);
  const cookie = r.headers.get("set-cookie").split(";")[0];
  return async (method, path, body) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { Origin: BASE, Cookie: cookie, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
}

try {
  const old = await db.scrim.deleteMany({ where: { notes: { startsWith: TAG } } });
  if (old.count) console.log(`• Se borró el scrim de prueba anterior (${old.count}).`);

  const hxw = await login("coach.hxw");
  const nxv = await login("coach.nxv");
  const rival = (await hxw("GET", "/api/teams")).body.teams.find((t) => t.tag === "NXV");
  if (!rival) throw new Error("No existe el equipo NXV en los datos demo");

  // Primer horario libre para ambos equipos desde dentro de 2 horas
  let scrim = null;
  for (let h = 2; h < 72 && !scrim; h++) {
    const start = new Date(Date.now() + h * 3600_000);
    start.setMinutes(0, 0, 0);
    const r = await hxw("POST", "/api/scrims", {
      opponentTeamId: rival.id,
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + 3 * 45 * 60_000).toISOString(),
      games: 3,
      roomLink: "https://discord.gg/auscrims",
      notes: `${TAG} Scrim de prueba para el chat y el draft`,
    });
    if (r.status === 200) scrim = r.body.scrim;
    else if (r.status !== 409) throw new Error(`No se pudo crear el scrim: ${r.body.error}`);
  }
  if (!scrim) throw new Error("No hay horario libre en los próximos 3 días");

  const accepted = await nxv("POST", `/api/scrims/${scrim.id}/respond`, { action: "accept" });
  if (accepted.status !== 200) throw new Error(`NXV no pudo aceptar: ${accepted.body.error}`);
  await nxv("POST", `/api/scrims/${scrim.id}/messages`, { body: "¡Buenas! Aceptado. ¿Lo jugamos con draft fearless?" });
  await hxw("POST", `/api/scrims/${scrim.id}/messages`, { body: "Hecho. Abran el botón Draft: como invitados, ustedes eligen lado del juego 1." });

  console.log(`• Scrim HXW vs NXV confirmado (${new Date(scrim.startAt).toLocaleString("es-MX")}, Bo3) con chat abierto.`);
  console.log(`\n  Chat:  ${BASE}/chat?scrim=${scrim.id}`);
  console.log(`  Draft: ${BASE}/draft/${scrim.id}`);
  console.log("\n  Entra con coach.hxw en una ventana y con coach.nxv en otra (incógnito u otro navegador).");
} finally {
  await db.$disconnect();
}
