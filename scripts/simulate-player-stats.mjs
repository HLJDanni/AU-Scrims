// Datos de demostración para el ranking de jugadores y el rol Leyenda (sin RIOT_API_KEY no hay datos reales).
//  - A cada jugador con rango le da partidas de SoloQ (victorias/derrotas), 20 partidas recientes con K/D/A
//    coherentes con su rol y 8 fotos semanales de su win rate para ver la evolución.
//  - Crea usuarios Leyenda: uno sin equipo y uno en algunos equipos demo.
// Uso: node scripts/simulate-player-stats.mjs           (idempotente: no toca jugadores que ya tienen partidas)
//      node scripts/simulate-player-stats.mjs --reset   (borra solo los datos demo y los vuelve a generar)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

try {
  process.loadEnvFile(".env");
} catch {}
const db = new PrismaClient();
const PASSWORD = process.env.SEED_PASSWORD || "Scrims2026!";

let seed = 77;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const between = (a, b) => a + rand() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const TIER_SKILL = { IRON: 0, BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 4, EMERALD: 5, DIAMOND: 6, MASTER: 7, GRANDMASTER: 8, CHALLENGER: 9 };
// K/D/A promedio por rol (aprox. de partidas reales de SoloQ)
const ROLE_KDA = {
  TOP: [5.5, 5, 6],
  JUNGLE: [6, 5, 8.5],
  MID: [7, 5, 7],
  ADC: [7.5, 5, 6.5],
  SUPPORT: [1.8, 5.5, 13],
  SUB: [5, 5.5, 7],
};

async function main() {
  if (process.argv.includes("--reset")) {
    // Solo datos demo: las partidas reales de Riot no empiezan con DEMO_
    const demo = await db.playerMatch.findMany({ where: { matchId: { startsWith: "DEMO_" } }, select: { playerId: true }, distinct: ["playerId"] });
    const ids = demo.map((d) => d.playerId);
    await db.playerMatch.deleteMany({ where: { matchId: { startsWith: "DEMO_" } } });
    await db.playerSnapshot.deleteMany({ where: { playerId: { in: ids } } });
    console.log(`• Datos demo borrados de ${ids.length} jugadores.`);
  }
  const players = await db.player.findMany({ where: { tier: { not: null }, matches: { none: {} } } });
  console.log(`• Generando estadísticas para ${players.length} jugadores…`);
  const now = Date.now();

  for (const p of players) {
    const skill = TIER_SKILL[p.tier];
    // Win rate final entre ~44 % y ~66 %, algo mayor en ligas altas; partidas entre 40 y 420
    const finalWr = clamp(between(0.44, 0.6) + skill * 0.006 + (rand() < 0.12 ? 0.05 : 0), 0.4, 0.68);
    const games = Math.round(between(40, 160) + skill * between(8, 28));
    const wins = Math.round(games * finalWr);
    const losses = games - wins;

    // Evolución: 8 fotos semanales que convergen al win rate actual. La mayoría viene subiendo
    // (más quienes mejor rinden) y ~1 de cada 4 viene bajando
    const rising = rand() < 0.75;
    const startWr = clamp(rising ? finalWr - between(0.01, 0.06) - (finalWr - 0.5) * 0.15 : finalWr + between(0.01, 0.05), 0.35, 0.72);
    const snapshots = [];
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const g = Math.max(10, Math.round(games * (0.55 + 0.45 * t)));
      const w = Math.round(g * (startWr + (finalWr - startWr) * t + between(-0.006, 0.006)));
      snapshots.push({ playerId: p.id, takenAt: new Date(now - (7 - i) * 7 * 86400_000), tier: p.tier, division: p.division, lp: p.lp, wins: w, losses: g - w });
    }

    // 20 partidas recientes coherentes con el rol y el win rate
    const [k0, d0, a0] = ROLE_KDA[p.position];
    const boost = 1 + (skill - 4) * 0.035 + (finalWr - 0.5) * 0.9;
    const matches = Array.from({ length: 20 }, (_, i) => {
      const win = rand() < finalWr;
      const f = win ? 1.25 : 0.75;
      return {
        playerId: p.id,
        matchId: `DEMO_${p.id}_${i}`,
        kills: Math.max(0, Math.round(k0 * boost * f * between(0.4, 1.6))),
        deaths: Math.max(0, Math.round((d0 / boost) * (win ? 0.75 : 1.3) * between(0.4, 1.6))),
        assists: Math.max(0, Math.round(a0 * boost * f * between(0.5, 1.5))),
        win,
        playedAt: new Date(now - i * between(0.4, 1.5) * 86400_000),
      };
    });

    await db.player.update({ where: { id: p.id }, data: { wins, losses } });
    await db.playerSnapshot.createMany({ data: snapshots });
    await db.playerMatch.createMany({ data: matches, skipDuplicates: true });
  }

  // Usuarios Leyenda de prueba
  const hash = await bcrypt.hash(PASSWORD, 12);
  const legends = [
    { username: "leyenda", team: null },
    { username: "leyenda.hxw", team: "HXW" },
    { username: "leyenda.cld", team: "CLD" },
  ];
  for (const l of legends) {
    if (await db.user.findUnique({ where: { username: l.username } })) continue;
    const team = l.team ? await db.team.findUnique({ where: { tag: l.team } }) : null;
    if (l.team && !team) continue;
    await db.user.create({
      data: { username: l.username, email: `${l.username}@auscrims.dev`, passwordHash: hash, role: "LEGEND", teamId: team?.id ?? null },
    });
    console.log(`  Leyenda creada: ${l.username}${team ? ` (equipo ${team.tag})` : " (sin equipo)"}`);
  }
  console.log("• Listo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
