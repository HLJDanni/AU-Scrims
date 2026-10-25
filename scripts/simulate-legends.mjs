// Crea usuarios Leyenda de prueba: uno sin equipo y uno en algunos equipos demo.
// Uso: node scripts/simulate-legends.mjs   (idempotente)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

try {
  process.loadEnvFile(".env");
} catch {}
const db = new PrismaClient();
const PASSWORD = process.env.SEED_PASSWORD || "Scrims2026!";

const LEGENDS = [
  { username: "leyenda", team: null },
  { username: "leyenda.hxw", team: "HXW" },
  { username: "leyenda.cld", team: "CLD" },
];

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 12);
  for (const l of LEGENDS) {
    if (await db.user.findUnique({ where: { username: l.username } })) continue;
    const team = l.team ? await db.team.findUnique({ where: { tag: l.team } }) : null;
    if (l.team && !team) continue;
    await db.user.create({ data: { username: l.username, email: `${l.username}@auscrims.dev`, passwordHash: hash, role: "LEGEND", teamId: team?.id ?? null } });
    console.log(`Leyenda creada: ${l.username}${team ? ` (equipo ${team.tag})` : " (sin equipo)"}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
