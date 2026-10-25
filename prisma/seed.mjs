// Datos de demostración. Solo se ejecuta si la base de datos no tiene equipos.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const PASSWORD = process.env.SEED_PASSWORD || "Scrims2026!";

const TEAMS = [
  { name: "Arcane Union", tag: "AU", color: "#C8AA6E", region: "LAN" },
  { name: "Hextech Wolves", tag: "HXW", color: "#0AC8B9", region: "LAN" },
  { name: "Noxus Vanguard", tag: "NXV", color: "#E84057", region: "LAN" },
  { name: "Void Seekers", tag: "VOID", color: "#9D48E0", region: "LAS" },
  { name: "Freljord Frost", tag: "FRF", color: "#576BCE", region: "LAN" },
  { name: "Ionia Spirits", tag: "ION", color: "#2DD4A8", region: "NA" },
  { name: "Demacia Crown", tag: "DMC", color: "#F0E6D2", region: "LAN" },
  { name: "Shurima Sands", tag: "SHR", color: "#C86B3C", region: "LAS" },
];

const ROLES = [
  ["COACH", "coach"],
  ["ANALYST", "analyst"],
  ["CAPTAIN", "cap"],
];

function code() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => a[Math.floor(Math.random() * a.length)]).join("");
}

function elo(ra, rb, wa, wb) {
  const played = wa + wb;
  const expected = 1 / (1 + 10 ** ((rb - ra) / 400));
  const weight = Math.min(1.5, 0.75 + played * 0.15);
  return Math.round(32 * weight * (wa / played - expected));
}

function at(dayOffset, hour, minutes = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minutes, 0, 0);
  return d;
}

async function main() {
  if ((await db.team.count()) > 0) {
    console.log("[seed] La base ya tiene datos, se omite.");
    return;
  }
  console.log("[seed] Creando datos de demostración…");
  const hash = await bcrypt.hash(PASSWORD, 12);

  const teams = [];
  for (const t of TEAMS) {
    const team = await db.team.create({ data: { ...t, inviteCode: code() } });
    for (const [role, prefix] of ROLES) {
      await db.user.create({
        data: {
          username: `${prefix}.${t.tag.toLowerCase()}`,
          email: `${prefix}.${t.tag.toLowerCase()}@auscrims.dev`,
          passwordHash: hash,
          role,
          teamId: team.id,
        },
      });
    }
    teams.push(team);
  }
  const users = await db.user.findMany();
  const coachOf = (teamId) => users.find((u) => u.teamId === teamId && u.role === "COACH");
  const ratings = Object.fromEntries(teams.map((t) => [t.id, 1200]));

  // Historial: ~30 scrims jugados en las últimas 5 semanas
  const strength = { AU: 0.62, HXW: 0.7, NXV: 0.55, VOID: 0.45, FRF: 0.5, ION: 0.6, DMC: 0.4, SHR: 0.35 };
  let seedRand = 7;
  const rand = () => ((seedRand = (seedRand * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 32; i++) {
    const a = teams[Math.floor(rand() * teams.length)];
    let b = teams[Math.floor(rand() * teams.length)];
    if (a.id === b.id) b = teams[(teams.indexOf(a) + 1) % teams.length];
    const games = [3, 3, 4, 5, 2][i % 5];
    let wa = 0;
    for (let g = 0; g < games; g++) if (rand() < strength[a.tag] / (strength[a.tag] + strength[b.tag])) wa++;
    const wb = games - wa;
    const startAt = at(-35 + i, 18 + (i % 4));
    const delta = elo(ratings[a.id], ratings[b.id], wa, wb);
    ratings[a.id] += delta;
    ratings[b.id] -= delta;
    const scrim = await db.scrim.create({
      data: {
        requesterTeamId: a.id,
        opponentTeamId: b.id,
        createdById: coachOf(a.id).id,
        startAt,
        endAt: new Date(startAt.getTime() + games * 45 * 60000),
        games,
        status: "COMPLETED",
        requesterScore: wa,
        opponentScore: wb,
        ratingDelta: delta,
        roomLink: "https://discord.gg/auscrims",
      },
    });
    await db.scrimEvent.createMany({
      data: [
        { scrimId: scrim.id, actorId: coachOf(a.id).id, type: "CREATED", message: `${coachOf(a.id).username} envió la solicitud de scrim (${games} juegos)` },
        { scrimId: scrim.id, actorId: coachOf(b.id).id, type: "ACCEPTED", message: `${coachOf(b.id).username} aceptó el scrim` },
        { scrimId: scrim.id, actorId: coachOf(a.id).id, type: "RESULT", message: `${coachOf(a.id).username} registró el resultado ${a.tag} ${wa} - ${wb} ${b.tag}` },
      ],
    });
  }
  for (const t of teams) await db.team.update({ where: { id: t.id }, data: { rating: ratings[t.id] } });

  // Agenda futura para Arcane Union (AU)
  const [au, hxw, nxv, voidT, frf, ion, dmc] = teams;
  const upcoming = [
    { req: au, opp: hxw, start: at(1, 19), games: 3, status: "CONFIRMED", link: "https://discord.gg/auscrims" },
    { req: nxv, opp: au, start: at(2, 20), games: 5, status: "CONFIRMED" },
    { req: au, opp: frf, start: at(4, 18), games: 3, status: "PENDING" },
    { req: ion, opp: au, start: at(3, 21), games: 2, status: "PENDING" },
    { req: dmc, opp: au, start: at(5, 19, 30), games: 4, status: "PENDING" },
    { req: au, opp: voidT, start: at(6, 17), games: 3, status: "CONFIRMED", proposal: at(6, 20) },
  ];
  for (const u of upcoming) {
    const end = new Date(u.start.getTime() + u.games * 45 * 60000);
    const s = await db.scrim.create({
      data: {
        requesterTeamId: u.req.id,
        opponentTeamId: u.opp.id,
        createdById: coachOf(u.req.id).id,
        startAt: u.start,
        endAt: end,
        games: u.games,
        status: u.status,
        roomLink: u.link ?? null,
        ...(u.proposal
          ? {
              proposedStartAt: u.proposal,
              proposedEndAt: new Date(u.proposal.getTime() + u.games * 45 * 60000),
              proposedGames: u.games,
              proposedByTeamId: u.opp.id,
            }
          : {}),
      },
    });
    await db.scrimEvent.create({
      data: { scrimId: s.id, actorId: coachOf(u.req.id).id, type: "CREATED", message: `${coachOf(u.req.id).username} envió la solicitud de scrim (${u.games} juegos)` },
    });
    if (u.proposal)
      await db.scrimEvent.create({
        data: { scrimId: s.id, actorId: coachOf(u.opp.id).id, type: "PROPOSED", message: `${coachOf(u.opp.id).username} propuso re-agendar el scrim` },
      });
  }

  // Un scrim de ayer sin resultado, para probar el registro de marcador
  const y = at(-1, 19);
  await db.scrim.create({
    data: {
      requesterTeamId: au.id,
      opponentTeamId: ion.id,
      createdById: coachOf(au.id).id,
      startAt: y,
      endAt: new Date(y.getTime() + 3 * 45 * 60000),
      games: 3,
      status: "CONFIRMED",
    },
  });

  console.log(`[seed] Listo. Usuarios: coach.au / analyst.au / cap.au (y así por cada tag). Contraseña: SEED_PASSWORD`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
