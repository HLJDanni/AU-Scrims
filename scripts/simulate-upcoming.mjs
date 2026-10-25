// Scrims de prueba para ver los avisos de inicio (15, 10 y 5 min) y una agenda con próximos scrims.
//  - Un scrim confirmado por empezar para cada aviso: HXW (~16 min), CLD (~11 min) y JDS (~6 min, sin link de sala).
//  - Próximos scrims (hoy más tarde y los siguientes días) y algunos resultados recientes para esos equipos.
// Los horarios son relativos al momento en que se corre: vuelve a ejecutarlo para "reiniciar" los avisos.
// Uso: node scripts/simulate-upcoming.mjs [--in 16]   (minutos para el primer scrim; los demás se escalonan)
import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile(".env");
} catch {}
const db = new PrismaClient();
const TAG = "[demo-aviso]"; // marca para poder borrar lo de una corrida anterior

const arg = process.argv.indexOf("--in");
const first = arg > -1 ? Number(process.argv[arg + 1]) || 16 : 16;
const MIN = 60_000;
const now = Date.now();

// Equipo, rival, minutos para iniciar, juegos y si tiene link de sala
const SOON = [
  { team: "HXW", rival: "ION", inMin: first, games: 3, room: "https://discord.gg/auscrims-hxw" },
  { team: "CLD", rival: "ABK", inMin: first - 5, games: 2, room: "https://discord.gg/auscrims-cld" },
  { team: "JDS", rival: "STR", inMin: first - 10, games: 3, room: null },
];
// Agenda de los próximos días (horas desde ahora)
const LATER = [
  { team: "HXW", rival: "NXV", inHours: 5, games: 3, status: "CONFIRMED" },
  { team: "HXW", rival: "VOID", inHours: 26, games: 5, status: "CONFIRMED" },
  { team: "FRF", rival: "HXW", inHours: 50, games: 3, status: "PENDING" },
  { team: "CLD", rival: "IPX", inHours: 28, games: 3, status: "CONFIRMED" },
  { team: "JDS", rival: "OBW", inHours: 30, games: 4, status: "CONFIRMED" },
];
// Resultados recientes (horas hacia atrás)
const PAST = [
  { team: "HXW", rival: "DMC", agoHours: 20, games: 3, score: [2, 1] },
  { team: "SHR", rival: "HXW", agoHours: 44, games: 3, score: [1, 2] },
  { team: "CLD", rival: "SFL", agoHours: 22, games: 3, score: [3, 0] },
  { team: "JDS", rival: "SVA", agoHours: 24, games: 2, score: [1, 1] },
];

async function team(tag) {
  const t = await db.team.findUnique({ where: { tag }, include: { members: { where: { role: "COACH" }, take: 1 } } });
  if (!t) throw new Error(`No existe el equipo ${tag}. Corre antes npm run simulate:tournaments`);
  return t;
}

async function create({ team: tagA, rival: tagB, start, games, status, room, score }) {
  const [a, b] = await Promise.all([team(tagA), team(tagB)]);
  const startAt = new Date(start);
  const endAt = new Date(start + games * 45 * MIN);
  const clash = await db.scrim.findFirst({
    where: {
      status: { in: ["PENDING", "CONFIRMED"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      OR: [{ requesterTeamId: { in: [a.id, b.id] } }, { opponentTeamId: { in: [a.id, b.id] } }],
    },
  });
  if (clash && !score) {
    console.log(`  ⚠ ${tagA} vs ${tagB}: choca con otro scrim activo, se omite`);
    return;
  }
  const coach = a.members[0];
  const s = await db.scrim.create({
    data: {
      requesterTeamId: a.id,
      opponentTeamId: b.id,
      createdById: coach?.id,
      startAt,
      endAt,
      games,
      status: score ? "COMPLETED" : status,
      roomLink: room ?? null,
      notes: `${TAG} Scrim de prueba`,
      requesterScore: score?.[0] ?? null,
      opponentScore: score?.[1] ?? null,
      ratingDelta: score ? 0 : null,
    },
  });
  await db.scrimEvent.create({ data: { scrimId: s.id, actorId: coach?.id, type: "CREATED", message: `${coach?.username ?? tagA} envió la solicitud de scrim (${games} juegos)` } });
  if (status === "CONFIRMED" || score) await db.scrimEvent.create({ data: { scrimId: s.id, type: "ACCEPTED", message: `[${tagB}] aceptó el scrim` } });
  const when = startAt.toLocaleString("es-GT", { weekday: "short", hour: "2-digit", minute: "2-digit" });
  console.log(`  ${score ? "✔" : status === "PENDING" ? "…" : "•"} [${tagA}] vs [${tagB}] ${when}${score ? ` ${score[0]}-${score[1]}` : ""}${room ? " · sala lista" : ""}`);
}

async function main() {
  const old = await db.scrim.deleteMany({ where: { notes: { startsWith: TAG } } });
  if (old.count) console.log(`• Se borraron ${old.count} scrims de prueba anteriores.`);

  console.log("• Por empezar (avisos de 15, 10 y 5 min):");
  for (const s of SOON) await create({ ...s, start: now + s.inMin * MIN, status: "CONFIRMED" });
  console.log("• Próximos:");
  for (const s of LATER) await create({ ...s, start: Math.round((now + s.inHours * 3600_000) / (15 * MIN)) * 15 * MIN });
  console.log("• Resultados recientes:");
  for (const s of PAST) await create({ ...s, start: now - s.agoHours * 3600_000, status: "COMPLETED" });

  console.log("\nEntra con coach.hxw, coach.cld o coach.jds (o leyenda.hxw / leyenda.cld) para ver los avisos.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
