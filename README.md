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

## Publicar en internet

Guía paso a paso para Render (app) + Neon (PostgreSQL), con ventajas y riesgos: [docs/DEPLOY.md](docs/DEPLOY.md). El blueprint está en [render.yaml](render.yaml).

## Funcionalidades

- **Roles:** Coach (además administra el roster, el código de invitación, los ajustes y puede **eliminar el equipo**), Analista y Capitán. Todos pueden agendar, responder y re-agendar.
- **Jugadores:** cada equipo registra la cuenta principal (no smurf) de sus jugadores con su link de op.gg (obligatorio) y su posición; el rango, la división y los LP se traen de la API oficial de Riot (`RIOT_API_KEY`, ver docs/RIOT_API_KEY.md); el ELO promedio de los titulares, la descripción y los jugadores aparecen en el detalle de cada scrim con link a op.gg. Coach y capitán editan el roster: **5 titulares** (uno por posición) y **hasta 3 suplentes**.
- **Equipos:** se crean al registrarse o desde el onboarding; los demás miembros se unen con un **código de invitación**.
- **Imagen del equipo:** opcional al crear el equipo y editable por el coach y el capitán (Mi equipo → Ajustes → Emblema). El emblema muestra la imagen y, al pasar el cursor, gira como una moneda y muestra las siglas. Se acepta PNG, JPG o WebP; se recorta a 256 px en el navegador y el servidor valida el contenido real (sin SVG).
- **Asignar roles:** el coach asigna el rol de cada miembro desde Mi equipo → Miembros (coach, analista, capitán o Leyenda). El equipo nunca se queda sin coach.
- **Leyendas en el roster:** la Leyenda que se une con el código de un equipo entra también como jugador: se le pide su link de op.gg y su posición, se valida con Riot y aparece en el roster con su cuenta. Si sale del equipo, sale del roster.
- **Calendario:** vistas Semana / Mes / Día / Agenda. Selecciona un bloque para agendar; **arrastra o estira** un scrim para re-agendarlo.
- **Agendar:** rival, fecha, inicio/fin (chips de duración), **número de juegos** (1–10), **link de la sala** y notas.
- **Re-agenda:** si tu solicitud aún está pendiente se mueve directamente; si ya fue confirmada (o la propone el invitado), se crea una **propuesta** que el otro equipo aprueba o rechaza. Las propuestas se ven en el calendario como bloque punteado.
- **Detalle del scrim** (panel lateral con pestañas): Detalles · Sala (editar link, copiar invitación lista para los jugadores) · Actividad (bitácora).
- **Chat del scrim (estilo Teams):** cuando el rival acepta, se abre un chat entre el staff de ambos equipos (sección **Chat**, con no leídos en el menú). Se abre también desde el calendario y el detalle del scrim. Los avisos del scrim (aceptado, nuevo horario, sala, resultado, cancelación) y del draft aparecen en el chat.
- **Draft estilo Mundial:** botón **Draft** en el chat. Orden profesional (6 baneos, 6 picks, 4 baneos, 4 picks), reloj de 30 s opcional, selección visible para el rival, **fearless** con un toggle (lo elegido en un juego no se repite en la serie) y **elección de lado**: en el juego 1 elige el invitado; luego, el perdedor del juego anterior. Campeones e imágenes de Data Dragon (Riot), con buscador y **filtro por posición** (Top, Jungla, Medio, ADC, Soporte). Al terminar cada juego se pega su **Game ID**: Riot (match-v5) indica qué lado ganó, se comprueba que los campeones coincidan con el draft (aunque se hayan cambiado de lado en el lobby) y la victoria se asigna sola; el marcador de la serie se pasa al ranking con un clic. Si Riot no encuentra la partida, se puede registrar el ganador a mano.
- **Administrador de la app:** cuenta aparte (sin equipo) que se crea al iniciar con `ADMIN_USERNAME` y `ADMIN_PASSWORD`. Desde **Administración** ve todos los scrims y puede eliminar cualquiera (con su chat y su draft); si tenía resultado, los puntos se revierten. Ningún equipo puede eliminar scrims.
- **Choques de horario:** no se permite que un equipo tenga dos scrims activos que se crucen.
- **Puntos en juego:** al elegir rival, en el detalle de cada scrim y al registrar el marcador se muestra cuántos puntos gana o pierde el equipo con cada resultado posible (misma fórmula que el servidor).
- **Resultados y ranking:** al registrar el marcador se actualiza el rating Elo de ambos equipos (K=32, ponderado por juegos jugados). Divisiones de Hierro a Retador.
- **Historial:** solo de tu equipo, con filtros (victorias, derrotas, cancelados) y récord contra cada rival.

## Rol Leyenda y privacidad

- **Leyenda:** rol de solo lectura. Sin equipo ve el ranking de equipos y los torneos (bracket y equipos inscritos). Si pertenece a un equipo, además ve los scrims, el calendario y el roster **de su equipo**, sin poder agendar ni editar. Se registra eligiendo "Sin equipo" o con un código de invitación.
- **Privacidad mutua:** los jugadores (Riot ID y op.gg) de un equipo solo los ve su propio equipo. El coach y el analista de otro equipo los ven únicamente cuando ambos tienen un scrim agendado o jugado. El ELO promedio sí es visible para todos.

Usuarios de prueba: `leyenda` (sin equipo), `leyenda.hxw` y `leyenda.cld` (con equipo); se crean con `npm run simulate:legends`.

## Avisos de inicio de scrim

A los **15, 10 y 5 minutos** de un scrim confirmado aparece abajo a la derecha un aviso estilo Teams con el rival, la cuenta regresiva, el botón **Unirse a la sala** (o la alerta de que falta el link) y **Copiar invitación**. Suena una campanita (se puede silenciar) y, si lo permites, también llega una notificación del escritorio cuando la pestaña no está visible. Descartar un aviso se recuerda en ese navegador; si el scrim se re-agenda, los avisos vuelven a salir.

Para verlo con datos de prueba: `npm run simulate:upcoming` crea scrims que empiezan en ~16, ~11 y ~6 minutos para HXW, CLD y JDS (entra con `coach.hxw`, `coach.cld` o `coach.jds`), más próximos scrims y resultados recientes. `--in 20` cambia los minutos del primero.

## Torneos suizos

Mini torneos dentro de la app (**Torneos** en el menú), formato suizo como el Mundial: **3 victorias clasifican, 3 derrotas eliminan**; partidos Bo1 y **Bo3 cuando un equipo puede clasificar o quedar eliminado**. Con número impar, uno descansa por ronda (cuenta como victoria). Las rondas siguientes se emparejan solas por récord, sin repetir rival si hay alternativa.

| División | ELO promedio de los 5 titulares |
| --- | --- |
| Barón | Maestro – Retador |
| Heraldo | Platino II – Diamante I |

Para jugar, además: **1,000 puntos de ranking** y **10 scrims ganados**. Quien no cumple no puede inscribirse; la pestaña *Requisitos* muestra qué le falta a cada equipo. Un coach elegible organiza el torneo de su división (uno abierto a la vez), coach o capitán inscriben al equipo y el organizador lo inicia (mínimo 4 equipos).

> Todos los equipos inician en **0 puntos** y nunca bajan de 0 (como los LP de LoL). Los puntos se calculan con Elo (K 160, escala 2000): un 3-0 entre equipos parejos vale ±96, así que el umbral de 1,000 cuesta unas 10–12 victorias.

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
