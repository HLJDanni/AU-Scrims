// Simula los escenarios de torneos suizos con datos de prueba.
//  1. (BD) Crea equipos demo para cada caso: División Barón, División Heraldo, casi elegibles y academias.
//     Cada equipo tiene staff, 5-6 jugadores con rango y un historial real de scrims (las victorias se cuentan de ahí).
//  2. (API) Ejecuta los torneos como lo haría el staff: crear, inscribir, intentos rechazados, iniciar y reportar.
//     - Copa Barón: se juega completa.
//     - Copa Heraldo: 7 equipos (hay descansos) y se deja en curso para que puedas reportar las rondas restantes.
// Uso: node scripts/simulate-tournaments.mjs   (con el stack levantado; idempotente)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

try {
  process.loadEnvFile(".env");
} catch {}
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const PASSWORD = process.env.SEED_PASSWORD || "Scrims2026!";
const db = new PrismaClient();

// ---------- Datos de los escenarios ----------
const P = (tier, division, lp) => ({ tier, division, lp });
const TEAMS = [
  // División Barón: ELO promedio Maestro+, ≥1000 pts, ≥10 scrims ganados
  { tag: "CLD", name: "Celestial Dawn", color: "#F4C874", group: "elite", target: 1850, wins: 16, ranks: [P("CHALLENGER", null, 1180), P("GRANDMASTER", null, 640), P("CHALLENGER", null, 1050), P("GRANDMASTER", null, 720), P("MASTER", null, 410)] },
  { tag: "ABK", name: "Abyss Kings", color: "#9D48E0", group: "elite", target: 1600, wins: 14, ranks: [P("GRANDMASTER", null, 560), P("MASTER", null, 380), P("CHALLENGER", null, 1010), P("MASTER", null, 290), P("GRANDMASTER", null, 530)] },
  { tag: "IPX", name: "Iron Phoenix", color: "#E84057", group: "elite", target: 1450, wins: 13, ranks: [P("MASTER", null, 320), P("GRANDMASTER", null, 600), P("MASTER", null, 270), P("MASTER", null, 410), P("MASTER", null, 150)] },
  { tag: "SFL", name: "Starfall Legion", color: "#576BCE", group: "elite", target: 1300, wins: 12, ranks: [P("MASTER", null, 210), P("MASTER", null, 180), P("GRANDMASTER", null, 515), P("MASTER", null, 90), P("MASTER", null, 260)] },
  { tag: "CRO", name: "Crimson Oath", color: "#C86B3C", group: "elite", target: 1150, wins: 11, ranks: [P("MASTER", null, 140), P("MASTER", null, 60), P("MASTER", null, 220), P("DIAMOND", 1, 80), P("MASTER", null, 310)] },
  { tag: "ETT", name: "Eternal Tide", color: "#0AC8B9", group: "elite", target: 1050, wins: 10, ranks: [P("MASTER", null, 110), P("MASTER", null, 75), P("MASTER", null, 160), P("MASTER", null, 40), P("GRANDMASTER", null, 505)] },
  // División Heraldo: ELO promedio Platino II – Diamante I. Son 7 → habrá descansos
  { tag: "JDS", name: "Jade Serpents", color: "#2DD4A8", group: "ascenso", target: 1500, wins: 14, ranks: [P("DIAMOND", 1, 70), P("DIAMOND", 2, 40), P("DIAMOND", 1, 20), P("DIAMOND", 3, 55), P("DIAMOND", 2, 10)] },
  { tag: "STR", name: "Storm Riders", color: "#576BCE", group: "ascenso", target: 1350, wins: 13, ranks: [P("DIAMOND", 3, 60), P("DIAMOND", 4, 30), P("EMERALD", 1, 75), P("DIAMOND", 2, 20), P("DIAMOND", 4, 90)] },
  { tag: "OBW", name: "Obsidian Wolves", color: "#A09B8C", group: "ascenso", target: 1250, wins: 12, ranks: [P("EMERALD", 1, 40), P("EMERALD", 2, 65), P("DIAMOND", 4, 15), P("EMERALD", 1, 90), P("EMERALD", 3, 30)] },
  { tag: "SVA", name: "Silver Arrows", color: "#F0E6D2", group: "ascenso", target: 1150, wins: 11, ranks: [P("EMERALD", 3, 50), P("EMERALD", 2, 20), P("EMERALD", 4, 70), P("EMERALD", 2, 85), P("EMERALD", 3, 10)] },
  { tag: "EMG", name: "Ember Guard", color: "#C89B3C", group: "ascenso", target: 1080, wins: 10, ranks: [P("PLATINUM", 1, 60), P("EMERALD", 4, 30), P("PLATINUM", 1, 90), P("EMERALD", 4, 5), P("PLATINUM", 2, 70)] },
  { tag: "TDF", name: "Tidal Force", color: "#0397AB", group: "ascenso", target: 1020, wins: 10, ranks: [P("PLATINUM", 2, 40), P("PLATINUM", 1, 15), P("PLATINUM", 2, 80), P("EMERALD", 4, 50), P("PLATINUM", 1, 35)] },
  { tag: "GRV", name: "Grove Vanguard", color: "#2DD4A8", group: "ascenso", target: 1010, wins: 10, ranks: [P("PLATINUM", 2, 10), P("PLATINUM", 2, 55), P("PLATINUM", 1, 20), P("PLATINUM", 2, 30), P("PLATINUM", 2, 5)] },
  // Casi elegibles: cumplen todo menos un requisito
  { tag: "RKT", name: "Rookie Titans", color: "#E84057", group: "near", note: "ELO Maestro pero solo 7 scrims ganados", target: 1400, wins: 7, ranks: [P("MASTER", null, 200), P("MASTER", null, 120), P("GRANDMASTER", null, 510), P("MASTER", null, 80), P("MASTER", null, 300)] },
  { tag: "GLC", name: "Glass Cannon", color: "#576BCE", group: "near", note: "ELO Diamante y 12 victorias, pero 850 pts", target: 850, wins: 12, ranks: [P("DIAMOND", 1, 50), P("DIAMOND", 2, 30), P("DIAMOND", 1, 80), P("DIAMOND", 3, 10), P("DIAMOND", 2, 60)] },
  { tag: "LWL", name: "Lowland Lions", color: "#C89B3C", group: "near", note: "1.200 pts y 11 victorias, pero ELO Platino III", target: 1200, wins: 11, ranks: [P("PLATINUM", 3, 50), P("PLATINUM", 3, 20), P("PLATINUM", 4, 90), P("PLATINUM", 3, 70), P("PLATINUM", 3, 40)] },
  { tag: "HFR", name: "Half Roster", color: "#9D48E0", group: "near", note: "Cumple pts y victorias, pero solo 3 titulares registrados", target: 1300, wins: 12, ranks: [P("MASTER", null, 300), P("GRANDMASTER", null, 600), P("MASTER", null, 150)] },
  // Academias: rivales de práctica, lejos de cualquier requisito
  { tag: "ACN", name: "Academia Norte", color: "#7B7A72", group: "academy", start: 600, wins: 0, ranks: [P("GOLD", 2, 40), P("GOLD", 1, 20), P("SILVER", 1, 70), P("GOLD", 3, 10), P("GOLD", 4, 55)] },
  { tag: "ACS", name: "Academia Sur", color: "#7B7A72", group: "academy", start: 550, wins: 0, ranks: [P("SILVER", 2, 40), P("GOLD", 4, 20), P("SILVER", 1, 90), P("GOLD", 4, 10), P("SILVER", 3, 50)] },
  { tag: "ACE", name: "Academia Este", color: "#7B7A72", group: "academy", start: 500, wins: 0, ranks: [P("GOLD", 1, 40), P("PLATINUM", 4, 20), P("GOLD", 2, 30), P("GOLD", 1, 75), P("GOLD", 3, 60)] },
  { tag: "ACO", name: "Academia Oeste", color: "#7B7A72", group: "academy", start: 450, wins: 0, ranks: [P("SILVER", 1, 20), P("SILVER", 2, 45), P("GOLD", 4, 30), P("SILVER", 1, 10), P("BRONZE", 1, 80)] },
];
const POS = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
const ROLES = [["COACH", "coach"], ["ANALYST", "analyst"], ["CAPTAIN", "cap"]];
const LOSSES_PER_TEAM = 3;

let seed = 20261025;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const elo = (ra, rb, wa, wb) => {
  const expected = 1 / (1 + 10 ** ((rb - ra) / 2000));
  const weight = Math.min(1.5, 0.75 + (wa + wb) * 0.15);
  return Math.round(160 * weight * (wa / (wa + wb) - expected));
};
const code = () => Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(rand() * 32)]).join("");

// ---------- 1. Datos en la BD ----------
async function seedScenarioData() {
  if (await db.team.findUnique({ where: { tag: "CLD" } })) {
    console.log("• Datos de escenarios ya existen, se reutilizan.");
    return;
  }
  console.log("• Creando equipos, staff, jugadores e historial de scrims…");
  const hash = await bcrypt.hash(PASSWORD, 12);
  const academies = TEAMS.filter((t) => t.group === "academy");
  const competitors = TEAMS.filter((t) => t.group !== "academy");

  // Calendario de scrims: cada competidor gana `wins` y pierde 3 contra academias, intercalados en el tiempo
  const schedule = [];
  const maxGames = Math.max(...competitors.map((t) => t.wins + LOSSES_PER_TEAM));
  for (let i = 0; i < maxGames; i++)
    for (const [ci, t] of competitors.entries()) {
      if (i >= t.wins + LOSSES_PER_TEAM) continue;
      schedule.push({ team: t, academy: academies[(i + ci) % academies.length], won: true });
    }
  // Cada competidor con exactamente `wins` victorias; las derrotas repartidas en su historial
  for (const t of competitors) {
    const mine = schedule.filter((s) => s.team === t);
    mine.forEach((s, i) => (s.won = !(i % 5 === 2 && i < LOSSES_PER_TEAM * 5)));
    let w = mine.filter((s) => s.won).length;
    for (const s of mine) if (w > t.wins && s.won) (s.won = false), w--;
    for (const s of mine) if (w < t.wins && !s.won) (s.won = true), w++;
  }
  for (const s of schedule) s.games = [3, 3, 2, 4, 3][Math.floor(rand() * 5)];
  for (const s of schedule) {
    const winnerGames = s.games === 2 ? 2 : Math.floor(s.games / 2) + 1; // 2→2-0, 3→2-1, 4→3-1
    s.score = s.won ? [winnerGames, s.games - winnerGames] : [s.games - winnerGames, winnerGames];
  }

  // Rating inicial tal que, tras su historial, cada competidor termine cerca de su objetivo
  const startOf = new Map(TEAMS.map((t) => [t.tag, t.start ?? t.target]));
  let finals;
  for (let it = 0; it < 8; it++) {
    const r = new Map(startOf);
    for (const s of schedule) {
      const ra = r.get(s.team.tag);
      const rb = r.get(s.academy.tag);
      const d = elo(ra, rb, s.score[0], s.score[1]);
      // Mismo cálculo que la app: nadie baja de 0
      s.delta = Math.max(ra + d, 0) - ra;
      s.opponentDelta = Math.max(rb - d, 0) - rb;
      r.set(s.team.tag, ra + s.delta);
      r.set(s.academy.tag, rb + s.opponentDelta);
    }
    finals = r;
    for (const t of competitors) startOf.set(t.tag, startOf.get(t.tag) + (t.target - r.get(t.tag)));
  }

  const ids = new Map();
  for (const t of TEAMS) {
    const team = await db.team.create({
      data: {
        name: t.name,
        tag: t.tag,
        color: t.color,
        region: "LAN",
        inviteCode: code(),
        rating: finals.get(t.tag),
        description: t.group === "academy" ? "Academia de práctica para scrims de entrenamiento." : t.note ?? `Equipo de la ${t.group === "elite" ? "División Barón" : "División Heraldo"}.`,
      },
    });
    ids.set(t.tag, team.id);
    for (const [role, prefix] of ROLES)
      await db.user.create({ data: { username: `${prefix}.${t.tag.toLowerCase()}`, email: `${prefix}.${t.tag.toLowerCase()}@auscrims.dev`, passwordHash: hash, role, teamId: team.id } });
    const base = t.name.split(" ")[0].slice(0, 9);
    for (const [i, r] of t.ranks.entries()) {
      const gameName = `${base}${["Top", "Jgl", "Mid", "Adc", "Sup"][i]}`;
      const tagLine = `${t.tag}${i + 1}`;
      await db.player.create({
        data: { teamId: team.id, gameName, tagLine, opggUrl: `https://op.gg/lol/summoners/lan/${gameName}-${tagLine}`, position: POS[i], ...r },
      });
    }
  }

  const coachOf = new Map((await db.user.findMany({ where: { role: "COACH", teamId: { in: [...ids.values()] } } })).map((u) => [u.teamId, u.id]));
  let when = Date.now() - schedule.length * 3 * 3600_000 - 86400_000;
  for (const s of schedule) {
    const startAt = new Date(when);
    when += 3 * 3600_000;
    const req = ids.get(s.team.tag);
    await db.scrim.create({
      data: {
        requesterTeamId: req,
        opponentTeamId: ids.get(s.academy.tag),
        createdById: coachOf.get(req),
        startAt,
        endAt: new Date(startAt.getTime() + s.games * 45 * 60000),
        games: s.games,
        status: "COMPLETED",
        requesterScore: s.score[0],
        opponentScore: s.score[1],
        ratingDelta: s.delta,
        opponentRatingDelta: s.opponentDelta,
      },
    });
  }
  console.log(`  ${TEAMS.length} equipos, ${TEAMS.length * 3} usuarios, ${schedule.length} scrims finalizados.`);
}

// ---------- 2. Torneos vía API ----------
const sessions = new Map();
async function as(username) {
  if (sessions.has(username)) return sessions.get(username);
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ identifier: username, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`No se pudo iniciar sesión como ${username}: ${res.status}`);
  const cookie = res.headers.get("set-cookie").split(";")[0];
  const call = async (method, path, body) => {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers: { Cookie: cookie, Origin: BASE, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  sessions.set(username, call);
  return call;
}

const tagsOf = (group) => TEAMS.filter((t) => t.group === group).map((t) => t.tag);
const strength = new Map(TEAMS.map((t) => [t.tag, t.target ?? 0]));

async function runTournament({ name, organizer, members, rejected, stopAfterRound }) {
  const org = await as(`coach.${organizer.toLowerCase()}`);
  const list = await org("GET", "/api/tournaments");
  if (list.body.tournaments.some((t) => t.name === name)) {
    console.log(`• "${name}" ya existe, se omite.`);
    return;
  }
  console.log(`\n• ${name}`);
  const created = await org("POST", "/api/tournaments", { name });
  if (created.status !== 200) throw new Error(`No se pudo crear: ${JSON.stringify(created.body)}`);
  const id = created.body.tournament.id;
  console.log(`  [${organizer}] organiza e inscribe a su equipo`);

  for (const tag of members) {
    const r = await (await as(`coach.${tag.toLowerCase()}`))("POST", `/api/tournaments/${id}/join`);
    console.log(`  [${tag}] inscripción → ${r.status === 200 ? "aceptada" : `${r.status} ${r.body.error}`}`);
  }
  for (const tag of rejected) {
    const r = await (await as(`coach.${tag.toLowerCase()}`))("POST", `/api/tournaments/${id}/join`);
    console.log(`  [${tag}] inscripción → RECHAZADA (${r.status}): ${r.body.error}`);
  }

  const started = await org("POST", `/api/tournaments/${id}/start`);
  if (started.status !== 200) throw new Error(`No se pudo iniciar: ${JSON.stringify(started.body)}`);

  for (let guard = 0; guard < 60; guard++) {
    const d = (await org("GET", `/api/tournaments/${id}`)).body;
    if (d.tournament.status === "FINISHED") break;
    if (stopAfterRound && d.tournament.round > stopAfterRound) {
      console.log(`  Se deja en curso en la ronda ${d.tournament.round} para probarla desde la app.`);
      break;
    }
    const current = d.rounds.find((r) => r.round === d.tournament.round);
    const pending = current.matches.filter((m) => !m.winnerId && !m.bye);
    const byes = current.matches.filter((m) => m.bye).map((m) => m.teamA.tag);
    console.log(`  Ronda ${d.tournament.round}: ${current.matches.filter((m) => !m.bye).map((m) => `${m.teamA.tag} vs ${m.teamB.tag} (Bo${m.bestOf})`).join(", ")}${byes.length ? ` · descansa ${byes.join(", ")}` : ""}`);
    for (const m of pending) {
      // El más fuerte gana con probabilidad proporcional a su rating, con algo de azar
      const pA = 1 / (1 + 10 ** ((strength.get(m.teamB.tag) - strength.get(m.teamA.tag)) / 900));
      const aWins = rand() < pA;
      const need = Math.ceil(m.bestOf / 2);
      const lose = m.bestOf === 1 ? 0 : rand() < 0.45 ? 1 : 0;
      const body = aWins ? { scoreA: need, scoreB: lose } : { scoreA: lose, scoreB: need };
      const r = await org("POST", `/api/tournaments/${id}/matches/${m.id}`, body);
      if (r.status !== 200) throw new Error(`Error al reportar: ${JSON.stringify(r.body)}`);
    }
  }

  const final = (await org("GET", `/api/tournaments/${id}`)).body;
  console.log("  Clasificación:");
  for (const e of final.table)
    console.log(`   ${String(e.position).padStart(2)}. [${e.team.tag}] ${e.team.name.padEnd(16)} ${e.wins}-${e.losses}  Buchholz ${e.buchholz}  ${{ ALIVE: "en juego", QUALIFIED: "CLASIFICADO", ELIMINATED: "eliminado" }[e.status]}`);
}

async function main() {
  await seedScenarioData();

  const viewer = await as("coach.cld");
  const elig = (await viewer("GET", "/api/tournaments/eligibility")).body.teams;
  console.log("\n• Elegibilidad de todos los equipos:");
  for (const e of elig) {
    const failed = e.checks.filter((c) => !c.ok).map((c) => c.label);
    console.log(`  [${e.team.tag.padEnd(4)}] ${e.team.name.padEnd(18)} ${String(e.team.rating).padStart(5)} pts  ${String(e.scrimWins).padStart(2)} victorias  ${(e.eloLabel ?? "—").padEnd(20)} → ${e.division ?? `NO ELEGIBLE (${failed.join(", ")})`}`);
  }

  await runTournament({
    name: "Copa Barón · Temporada 1",
    organizer: "CLD",
    members: tagsOf("elite").filter((t) => t !== "CLD"),
    rejected: ["RKT", "HFR", "JDS"], // casi elegibles y un equipo de la otra división
  });
  await runTournament({
    name: "Copa Heraldo · Temporada 1",
    organizer: "JDS",
    members: tagsOf("ascenso").filter((t) => t !== "JDS"),
    rejected: ["GLC", "LWL", "CLD"],
    stopAfterRound: 2,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
