# AU Scrims

Plataforma web para que equipos de League of Legends agenden, re-agenden y registren **scrims**, con calendario estilo Teams, historial privado por equipo y ranking Elo.

Solo el **staff** usa la plataforma: **Coach**, **Analista** y **Capitán**. Cada equipo ve únicamente sus propios scrims e historial; el ranking es global.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend + API | Next.js 15 (App Router, React 19, TypeScript) |
| UI | Tailwind CSS, Framer Motion, FullCalendar, lucide-react, sonner |
| Datos | PostgreSQL 16 + Prisma ORM |
| Auth | JWT HS256 (jose) en cookie `httpOnly`, contraseñas con bcrypt (12 rondas) |
| Infra | Docker multi-stage (imagen `standalone`, usuario sin privilegios) + docker-compose |

## Levantar con Docker

```bash
cp .env.example .env      # ajusta JWT_SECRET y contraseñas
docker compose up -d --build
```

- App: http://localhost:3000
- PostgreSQL: `localhost:5434` (usuario/clave en `.env`)

Al arrancar, el contenedor aplica las migraciones y, si `SEED_DEMO=true` y la base está vacía, carga 8 equipos de ejemplo con historial.

**Usuarios demo:** `coach.au`, `analyst.au`, `cap.au` (y lo mismo para `hxw`, `nxv`, `void`, `frf`, `ion`, `dmc`, `shr`). Contraseña: valor de `SEED_PASSWORD` en `.env`.

## Desarrollo local (sin contenedor para la app)

```bash
npm install
docker compose up -d db
npx prisma migrate deploy
npm run db:seed
npm run dev
```

## Pruebas

Con el stack levantado: `npm test` (Vitest + Playwright). El detalle de cada prueba y la validación de los criterios de aceptación están en [docs/PRUEBAS.md](docs/PRUEBAS.md).

## Funcionalidades

- **Roles:** Coach (además administra el roster, el código de invitación, los ajustes y puede **eliminar el equipo**), Analista y Capitán. Todos pueden agendar, responder y re-agendar.
- **Jugadores:** cada equipo registra la cuenta principal (no smurf) de sus jugadores con su link de op.gg (obligatorio) y su posición; el rango, la división y los LP se traen de la API oficial de Riot (`RIOT_API_KEY`, ver docs/RIOT_API_KEY.md); el ELO promedio de los titulares, la descripción y los jugadores aparecen en el detalle de cada scrim con link a op.gg. Coach y capitán editan el roster.
- **Equipos:** se crean al registrarse o desde el onboarding; los demás miembros se unen con un **código de invitación**.
- **Calendario:** vistas Semana / Mes / Día / Agenda. Selecciona un bloque para agendar; **arrastra o estira** un scrim para re-agendarlo.
- **Agendar:** rival, fecha, inicio/fin (chips de duración), **número de juegos** (1–10), **link de la sala** y notas.
- **Re-agenda:** si tu solicitud aún está pendiente se mueve directamente; si ya fue confirmada (o la propone el invitado), se crea una **propuesta** que el otro equipo aprueba o rechaza. Las propuestas se ven en el calendario como bloque punteado.
- **Detalle del scrim** (panel lateral con pestañas): Detalles · Sala (editar link, copiar invitación lista para los jugadores) · Actividad (bitácora).
- **Choques de horario:** no se permite que un equipo tenga dos scrims activos que se crucen.
- **Resultados y ranking:** al registrar el marcador se actualiza el rating Elo de ambos equipos (K=32, ponderado por juegos jugados). Divisiones de Hierro a Retador.
- **Historial:** solo de tu equipo, con filtros (victorias, derrotas, cancelados) y récord contra cada rival.

## Torneos suizos

Mini torneos dentro de la app (**Torneos** en el menú), formato suizo como el Mundial: **3 victorias clasifican, 3 derrotas eliminan**; partidos Bo1 y **Bo3 cuando un equipo puede clasificar o quedar eliminado**. Con número impar, uno descansa por ronda (cuenta como victoria). Las rondas siguientes se emparejan solas por récord, sin repetir rival si hay alternativa.

| División | ELO promedio de los 5 titulares |
| --- | --- |
| Barón | Maestro – Retador |
| Heraldo | Platino II – Diamante I |

Para jugar, además: **7,000 puntos de ranking** y **10 scrims ganados**. Quien no cumple no puede inscribirse; la pestaña *Requisitos* muestra qué le falta a cada equipo. Un coach elegible organiza el torneo de su división (uno abierto a la vez), coach o capitán inscriben al equipo y el organizador lo inicia (mínimo 4 equipos).

> El rating de equipos usa Elo en escala ×5 (base 6000, K 160) para que el umbral de 7,000 sea alcanzable; se comporta igual que el Elo clásico.

### Simulación con datos de prueba

```bash
npm run simulate:tournaments
```

Crea equipos para cada escenario (Barón, Heraldo, casi elegibles y academias) con historial real de scrims, juega completa la **Copa Barón** y deja la **Copa Heraldo** (7 equipos, con descansos) en la ronda 3 para probarla. Contraseña: `SEED_PASSWORD`.

| Escenario | Usuarios |
| --- | --- |
| Barón (CLD organiza) | `coach.cld`, `coach.abk`, `coach.ipx`, `coach.sfl`, `coach.cro`, `coach.ett` |
| Heraldo en curso (JDS organiza) | `coach.jds`, `coach.str`, `coach.obw`, `coach.sva`, `coach.emg`, `coach.tdf`, `coach.grv` |
| Casi elegibles (rechazados) | `coach.rkt` (7 victorias), `coach.glc` (6,850 pts), `coach.lwl` (Platino III), `coach.hfr` (3 titulares) |

## Seguridad

- Cookie de sesión `httpOnly`, `SameSite=Lax` (activa `COOKIE_SECURE=true` detrás de HTTPS).
- Verificación de `Origin` en todas las peticiones que modifican datos (CSRF).
- Validación de entrada con Zod en cada endpoint; las consultas siempre filtran por el equipo del usuario.
- Rate limiting en login, registro y unión a equipos.
- Cabeceras de seguridad (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`).

## Escalabilidad

- La app es *stateless* (sesión en JWT): se pueden levantar varias réplicas detrás de un balanceador.
- Índices en `Scrim(requesterTeamId, startAt)`, `Scrim(opponentTeamId, startAt)` y `status`.
- Para varias réplicas, mover el rate limiter en memoria (`src/lib/rate-limit.ts`) a Redis.

## Estructura

```
prisma/              schema, migraciones y seed
src/app/api/         endpoints REST (auth, team, teams, scrims, leaderboard, health)
src/app/(app)/       páginas autenticadas: dashboard, calendar, scrims, leaderboard, team
src/components/      UI (shell, calendario, scrims, ranking, equipo)
src/lib/             auth, validación, Elo, helpers de scrims
```
