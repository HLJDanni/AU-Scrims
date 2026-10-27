# Plan y resultados de pruebas · AU Scrims

**Fecha de ejecución:** 24/10/2026 · **Entorno:** Docker local (app `:3000`, PostgreSQL `:5434`), datos demo · **Resultado global:** 36/36 pruebas automatizadas (las 3 que consultan a Riot requieren una RIOT_API_KEY vigente)

## Cómo ejecutarlas

Con el stack levantado (`docker compose up -d`):

```bash
npm test                  # todo (Vitest + Playwright)
npm run test:unit         # unitarias + caja blanca (no requieren servidor)
npm run test:blackbox     # caja negra contra la API
npm run test:integration  # integración API + PostgreSQL
npm run test:e2e          # end-to-end en Chromium
```

Las pruebas de caja negra, integración y E2E usan los usuarios demo y limpian lo que crean (cancelan los scrims o los borran y restauran el rating).

## Resumen

| Tipo | ID | Archivo | Qué valida | Resultado |
| --- | --- | --- | --- | --- |
| Unitaria | U1 | `tests/unit/elo.test.ts` | Elo simétrico: ganar/perder todo entre iguales, empate = 0 | ✅ |
| Unitaria | U2 | `tests/unit/elo.test.ts` | Ganarle a un rival más fuerte vale más; 0 juegos = 0; más juegos pesa más | ✅ |
| Unitaria | U3 | `tests/unit/elo.test.ts` | Límites de divisiones (Hierro → Retador) | ✅ |
| Unitaria | U4 | `tests/unit/validators.test.ts` | Agendar: rechaza pasado, < 30 min, > 12 h, 0 u 11 juegos, links `javascript:` o sin protocolo | ✅ |
| Unitaria | U5 | `tests/unit/validators.test.ts` | Registro: contraseña segura, rol válido, equipo o código según el modo, normalización | ✅ |
| Unitaria | U6 | `tests/unit/lol.test.ts` | Rangos de SoloQ: escala numérica e inversa, ELO promedio de titulares (ignora suplentes y sin rango), Riot ID y link de op.gg | ✅ |
| Unitaria | U7 | `tests/unit/lol.test.ts` | Link de op.gg: acepta formatos actual, antiguo y con idioma; extrae región y Riot ID; normaliza; rechaza u.gg, rutas que no son perfiles, regiones desconocidas y links sin tag | ✅ |
| Unitaria | U8 | `tests/unit/riot.test.ts` | Cliente de la API de Riot con respuestas simuladas: rango de SoloQ (ignora Flex), Maestro sin división, sin rango, enrutamiento LAN → `americas`/`la1`, clave en cabecera y errores 404/403/429 y sin clave | ✅ |
| Unitaria | R1 | `tests/unit/reminders.test.ts` | Avisos de inicio: umbrales de 15, 10 y 5 min (límites incluidos), nada antes de 15 min ni después de empezar, clave distinta al re-agendar y cuenta regresiva | ✅ |
| Unitaria | U10 | `tests/unit/elo.test.ts` | Puntos en juego: cada marcador posible con los mismos valores que aplica el servidor (iguales, 400 arriba y 400 abajo) y probabilidad esperada | ✅ |
| Unitaria | U11 | `tests/unit/elo.test.ts` | Piso de 0 puntos: equipos nuevos no pierden puntos, el perdedor solo pierde lo que tiene y el ganador suma completo | ✅ |
| Unitaria | U12 | `tests/unit/draft.test.ts` | Orden profesional del draft: 20 acciones, 5 baneos y 5 picks por lado, fases y slots | ✅ |
| Unitaria | U13 | `tests/unit/draft.test.ts` | Fearless bloquea lo elegido (no lo baneado) en juegos anteriores; elección de lado: invitado en el juego 1, luego el perdedor | ✅ |
| Unitaria | U14 | `tests/unit/riot.test.ts` | Game ID: formatos aceptados (con o sin servidor), clúster de match-v5 (OCE → sea), ganador y campeones por lado, detección de lados cambiados y partida inexistente | ✅ |
| Unitaria | U15 | `tests/unit/champion-roles.test.ts` | Draft: cada campeón tiene su posición (Top, Jungla, Medio, ADC, Soporte) y los campeones nuevos se asignan por su clase | ✅ |
| Unitaria | S1 | `tests/unit/swiss.test.ts` | Motor suizo: ronda 1 por siembra, Bo3 en partidos decisivos, descanso con impares (una vez por equipo), torneos de 4 a 16 equipos terminan en ≤5 partidos por equipo y nunca hay revancha si existía alternativa | ✅ |
| Unitaria | S2 | `tests/unit/swiss.test.ts` | Elegibilidad: Barón (Maestro+), Heraldo (Platino II–Diamante I, límites incluidos), rechazo por rating, victorias, roster o ELO; suplentes fuera del promedio | ✅ |
| Caja blanca | W1 | `tests/whitebox/scrim-dto.test.ts` | `toDTO`: ramas anfitrión/invitado (marcador y delta invertidos), valores nulos | ✅ |
| Caja blanca | W2 | `tests/whitebox/scrim-dto.test.ts` | `toDTO`: ramas de propuesta (ninguna, incompleta, propia, del rival, juegos por defecto) | ✅ |
| Caja negra | N1 | `tests/blackbox/api.test.ts` | Login: 401 con mensaje genérico, cookie `httpOnly` + `SameSite=Lax`, `/me` sin hash | ✅ |
| Caja negra | N2 | `tests/blackbox/api.test.ts` | Sin sesión: API 401, páginas → `/login`; otro origen 403; solo el coach regenera la invitación | ✅ |
| Caja negra | N3 | `tests/blackbox/api.test.ts` | Agendar válido → PENDIENTE con juegos y link; 5 entradas inválidas → 422; contra sí mismo → 400 | ✅ |
| Caja negra | N4 | `tests/blackbox/api.test.ts` | Choque de horario → 409; el anfitrión no puede aceptar (403); el rival sí; doble respuesta → 400 | ✅ |
| Caja negra | N5 | `tests/blackbox/api.test.ts` | Un tercer equipo no ve, edita ni cancela el scrim (404) y no aparece en sus listas; ranking ordenado | ✅ |
| Integración | I1 | `tests/integration/scrim-lifecycle.test.ts` | Agendar → aceptar → proponer → aprobar → link → jugar → resultado: estado en BD, Elo de ambos equipos, bitácora y ranking | ✅ |
| Integración | I2 | `tests/integration/delete-team.test.ts` | Eliminar equipo: capitán 403, nombre incorrecto 422, coach 200; se borran equipo y scrims, el staff queda sin equipo y va a `/onboarding` | ✅ |
| Integración | I3 | `tests/integration/players.test.ts` | Roster con o sin clave de Riot: link de op.gg obligatorio, solo op.gg, servidor del equipo, Riot ID válido, analista 403, titular repetido y cuenta repetida 409, edición sin re-consultar a Riot, roster privado para otro equipo; con clave, rango real desde Riot, cuenta inexistente 422 y sincronización; máximo 3 suplentes (el cuarto da 409) | ✅ |
| Integración | I4 | `tests/integration/tournament.test.ts` | Torneo completo vía API: solo coach organiza, uno abierto por división, inscripción por rol y requisitos (9 victorias → 403), mínimo 4 equipos, solo el organizador inicia, siembra 1v3/2v4, validación de marcador Bo1/Bo3, permisos de reporte, doble reporte, fin con todos clasificados o eliminados y coherencia en BD | ✅ |
| Integración | I5 | `tests/integration/privacy-legend.test.ts` | Privacidad mutua: sin scrim nadie ve el roster rival (sí su ELO promedio); con scrim lo ven coach y analista de ambos lados, no capitán ni Leyenda; al cancelar vuelve a ser privado. Leyenda con equipo: lee sus scrims, no agenda (403) ni ve la invitación; sin equipo: ranking, jugadores y torneos sí, scrims no, y las páginas de equipo la mandan al ranking | ✅ |
| Integración | I6 | `tests/integration/chat-draft.test.ts` | El chat se abre al aceptar (403 antes), mensajes nuevos con `?after`, no leídos y marcado como leído; un tercer equipo recibe 404 | ✅ |
| Integración | I7 | `tests/integration/chat-draft.test.ts` | Draft: fearless, lado del invitado, listos, turnos (403 fuera de turno), repetido (409), resumen en el chat, ganador → el perdedor elige lado, tiempo agotado (baneo omitido, pick al azar o el seleccionado), bloqueo fearless entre juegos y reinicio | ✅ |
| Integración | I8 | `tests/integration/team-identity.test.ts` | Imagen del equipo validada por contenido (un SVG disfrazado de PNG da 422), servida con CSP y solo con sesión; el capitán edita el emblema pero no el nombre (403); solo el coach asigna roles y no puede quedarse el equipo sin coach | ✅ |
| Integración | I9 | `tests/integration/team-identity.test.ts` | La Leyenda que se une con código debe dar su op.gg (422 sin él o de otro servidor); entra al roster con su cuenta, sigue sin poder editarlo y, si el coach la quita, sale del roster | ✅ |
| Integración | I10 | `tests/integration/match-result.test.ts` | Con la clave real y una partida pública de KR: ID inválido o inexistente 422, victoria asignada al equipo correcto con lados cambiados, aviso en el chat, ID repetido 409, campeones que no coinciden 409 y marcador de la serie al ranking | ✅ |
| Integración | I11 | `tests/integration/match-result.test.ts` | Eliminar scrims: el coach recibe 403 (y la ruta del equipo ya no existe, 405); el administrador lista todos los scrims, elimina uno con resultado y los puntos de ambos equipos vuelven a como estaban; se borran su chat y su draft | ✅ |
| End-to-end | E1 | `tests/e2e/schedule-flow.spec.ts` | Crea su propio equipo, rival y coach temporales (y los borra al terminar). En el navegador: login → agendar con 5 juegos y link → Enviadas → detalle → Sala → copiar invitación → Actividad → cancelar | ✅ |
| End-to-end | E2 | `tests/e2e/schedule-flow.spec.ts` | Con un scrim confirmado a 6 min: el aviso aparece con minutos restantes, cuenta regresiva y botón para unirse a la sala; al descartarlo desaparece y no vuelve al recargar | ✅ |

### Endpoints validados (17)

Además de las pruebas automatizadas, se hizo una verificación manual de los endpoints que esas pruebas no tocan:

| Endpoint | Casos | Resultado |
| --- | --- | --- |
| `POST /api/auth/register` | crear equipo 200 · correo duplicado 409 · unirse con código 200 · código inválido 404 | ✅ |
| `POST /api/auth/login` · `GET /api/auth/me` · `POST /api/auth/logout` | N1; tras logout la API responde 401 | ✅ |
| `GET/POST/PATCH /api/team` | capitán edita 403 · coach edita 200 · sin equipo 403 | ✅ |
| `GET/POST /api/team/players` · `PATCH/DELETE /api/team/players/:id` · `GET /api/teams/:id/profile` | I3 | ✅ |
| `GET/POST /api/tournaments` · `GET /api/tournaments/eligibility` · `GET/DELETE /api/tournaments/:id` · `POST …/join` · `POST …/leave` · `POST …/start` · `POST …/matches/:id` | I4 y simulación (`npm run simulate:tournaments`) | ✅ |
| `GET /api/teams` (con ELO promedio) · `GET /api/teams/:id/profile` (privacidad mutua) | I5 | ✅ |
| `DELETE /api/team` | I2: solo coach, confirmación por nombre, borrado en cascada de scrims | ✅ |
| `POST /api/team/join` · `POST /api/team/invite` | N2; coach regenera 200 | ✅ |
| `DELETE /api/team/members/:id` | capitán quita al coach 403 · coach quita al capitán 200 → este va a `/onboarding` | ✅ |
| `GET /api/teams` · `GET /api/leaderboard` · `GET /api/health` | N5, health 200 | ✅ |
| `GET/POST /api/scrims` · `GET/PATCH /api/scrims/:id` | N3, N4, N5, I1 | ✅ |
| `POST /api/scrims/:id/respond` | aceptar (N4) · rechazar → DECLINED · re-agendar un rechazado 400 | ✅ |
| `POST /api/scrims/:id/reschedule` · `/proposal` · `/cancel` · `/result` | I1, E1, N4 | ✅ |

**Tiempos de respuesta** (20 peticiones por endpoint, con sesión):

| Endpoint | p50 | p95 |
| --- | --- | --- |
| `/api/scrims?scope=upcoming` | 13 ms | 24 ms |
| `/api/scrims?scope=requests` | 16 ms | 23 ms |
| `/api/scrims?scope=history` | 16 ms | 23 ms |
| `/api/leaderboard` | 13 ms | 19 ms |
| `/api/team` | 16 ms | 35 ms |
| `/api/teams` | 11 ms | 15 ms |

## Criterios de aceptación

| ID | Criterio (del requerimiento) | Evidencia | Estado |
| --- | --- | --- | --- |
| CA-01 | Existen 3 roles: coach, analista y capitán | U5 (solo esos 3 roles son válidos), N1 (rol en `/me`), registro con los 3 roles | ✅ Cumple |
| CA-02 | Solo el staff de un equipo puede agendar scrims y ver el historial **de su equipo** | N2 (401 sin sesión), N5 (otro equipo 404 y no aparece en sus listas), usuario sin equipo → 403 y `/onboarding` | ✅ Cumple |
| CA-03 | Agendar con fecha, horario y número de juegos | N3, I1, E1 (5 juegos, fecha y hora desde la UI) | ✅ Cumple |
| CA-04 | Calendario estilo Teams para agendar | Vistas Semana/Mes/Día/Agenda; seleccionar un bloque abre el formulario. Revisado manualmente en el navegador | ✅ Cumple (verificación manual) |
| CA-05 | Permitir re-agendar | I1 (propuesta → aprobación cambia horario y juegos), N4. Arrastrar en el calendario llama al mismo endpoint (revisado manualmente) | ✅ Cumple |
| CA-06 | Link de sala para que el staff lo envíe a los jugadores | I1 (guardar y verlo desde ambos equipos), E1 (copiar invitación con el link), U4/N3 (solo `http(s)`) | ✅ Cumple |
| CA-07 | Historial de scrims del equipo | I1 (aparece en el historial del rival con su marcador), N5 | ✅ Cumple |
| CA-08 | Leaderboard / ranking | U1–U3, I1 (Elo aplicado a ambos equipos y reflejado en el ranking), N5 (orden por rating) | ✅ Cumple |
| CA-09 | En Docker y con PostgreSQL | Stack `docker compose` (app + postgres:16), migraciones al iniciar, `/api/health` 200 | ✅ Cumple |
| CA-10 | Seguro | N1 (cookie `httpOnly`, mensaje que no revela usuarios), N2 (CSRF 403, permisos por rol), U4 (links seguros), bcrypt, rate limiting | ✅ Cumple |
| CA-11 | Respuesta rápida | p95 ≤ 35 ms en todos los endpoints de lectura; UI con SWR y caché | ✅ Cumple |
| CA-12 | Escalable | App sin estado (JWT), índices en `Scrim`, imagen `standalone` | ⚠️ Cumple parcialmente: el rate limiter vive en memoria, hay que moverlo a Redis antes de correr varias réplicas |
| CA-13 | Temática LoL (negro, gris, dorado, amarillo, blanco, café), animaciones, UX fluida y pestañas con secciones | Revisado manualmente: Dashboard, Calendario, Scrims (Próximos/Solicitudes/Historial), Ranking (Clasificación/Divisiones/Más activos), Equipo (Staff/Invitación/Estadísticas/Ajustes), panel del scrim (Detalles/Sala/Actividad) | ✅ Cumple (verificación manual) |
| CA-14 | Solo los coaches pueden eliminar un equipo | I2 (capitán 403, confirmación obligatoria, efecto verificado en BD); la opción solo aparece en la pestaña Ajustes, visible únicamente para el coach | ✅ Cumple |
| CA-15 | En el detalle del scrim se ve la descripción de cada equipo, su ELO promedio y el Riot ID principal de sus jugadores | I3 (perfil visible para el rival), U6 (cálculo del promedio); revisado en el navegador en Scrims → Detalles | ✅ Cumple |
| CA-16 | Donde se muestra el ELO aparece el emblema oficial de la liga | Revisado en el navegador: roster, ELO promedio, detalle del scrim, ranking (tabla, podio y divisiones), Inicio y Mi equipo. Emblemas en `public/ranks/` | ✅ Cumple (verificación manual) |
| CA-17 | El link de op.gg es obligatorio para registrar a un jugador | I3 (sin link 422, link de otro sitio 422, servidor distinto al del equipo 422), U7 (lectura del link); en la UI el botón Agregar queda deshabilitado sin un link válido | ✅ Cumple |
| CA-18 | El rango, la división y los LP no se escriben a mano: se obtienen automáticamente | U8 (respuestas simuladas), I3 (con o sin clave) y **prueba real con RIOT_API_KEY** (26/10/2026): account-v1, summoner-v4 y league-v4 responden 200; al agregar un jugador con su op.gg se trae su rango real, una cuenta inexistente se rechaza (422) y «Actualizar rangos» sincroniza | ✅ Cumple |
| CA-19 | Torneo con bracket suizo dentro de la app | S1, I4; simulación con 6 y 7 equipos (con descansos); bracket estilo Mundial (columnas por ronda, récords ordenados de mejor a peor, líneas del ganador y del perdedor por equipo, columna de clasificados/eliminados y rondas futuras vacías) y tabla con Buchholz revisados en el navegador | ✅ Cumple |
| CA-20 | División Barón (Maestro – Retador) y División Heraldo (Platino II – Diamante I); cada equipo solo accede a la suya | S2, I4; simulación: CLD rechazado en Heraldo y JDS en Barón | ✅ Cumple |
| CA-21 | Para participar se necesitan 1,000 puntos de ranking y 10 scrims ganados | S2, I4 (9 victorias → 403); simulación: GLC (~850 pts) y RKT (7 victorias) rechazados. Los equipos inician en 0 y nunca bajan de 0 (U11) | ✅ Cumple |
| CA-22 | Los equipos que no cumplen ningún parámetro no pueden jugar | S2; pestaña Requisitos muestra a cada equipo qué le falta; LWL (Platino III) y HFR (roster incompleto) rechazados en la simulación | ✅ Cumple |
| CA-23 | Al agendar un scrim se puede filtrar a los rivales por ELO promedio con un dropdown | I5 (la lista de rivales trae el ELO promedio y no los jugadores); dropdown con emblemas y conteo por liga revisado en el navegador | ✅ Cumple |
| CA-24 | Rol "Leyendas": ve bracket de torneos, ranking y equipos inscritos, pero no los jugadores; solo ve datos de su equipo y no agenda | I5, U5 (registro sin equipo); menú reducido y vistas de solo lectura revisadas en el navegador | ✅ Cumple |
| CA-25 | Los Riot ID / op.gg de otros equipos solo los ven coaches y analistas con un scrim mutuo | I5 | ✅ Cumple |
| CA-26 | Aviso estilo Teams a los 15, 10 y 5 minutos del inicio de un scrim, con la temática de la app | R1, E2; revisado en el navegador con `npm run simulate:upcoming` (sonido, botón de sala, invitación y aviso del escritorio opcional) | ✅ Cumple |
| CA-27 | Vista previa de los puntos de ranking en juego al agendar, en el detalle del scrim y al registrar el resultado | U10; revisado en el navegador (formulario con rival elegido, detalle de un scrim confirmado y registro de un 1-1) | ✅ Cumple |
| CA-28 | Todos los equipos inician en 0 puntos de ranking y nunca quedan en negativo | U1, U11; migración `rating_base_zero` lleva los equipos existentes a la nueva escala (rating − 6000, mínimo 0) | ✅ Cumple |
| CA-29 | Al aceptarse un scrim se abre un chat entre ambos equipos, accesible desde el calendario como en Teams | I6; revisado en el navegador (lista de chats con no leídos, icono en el calendario, botones Abrir chat y Draft en el detalle) | ✅ Cumple |
| CA-30 | Botón Draft con experiencia estilo Mundial | U12, I7; revisado en el navegador en escritorio y móvil (banners por lado, reloj, baneos, picks con splash art, cuadrícula con búsqueda y filtro por clase) | ✅ Cumple |
| CA-31 | Draft fearless o normal con un toggle y elección de lado | U13, I7 | ✅ Cumple |
| CA-32 | Al crear el equipo se puede elegir una imagen; el emblema alterna entre imagen y siglas al pasar el cursor, con giro | I8; revisado en el navegador (giro al pasar el cursor, vista previa en el registro y en Ajustes) | ✅ Cumple |
| CA-33 | Coach y capitán editan el emblema; el coach asigna capitanes y roles | I8; revisado en el navegador (selector de rol en Mi equipo → Miembros) | ✅ Cumple |
| CA-34 | La Leyenda que se une con código da su op.gg y queda integrada al roster del equipo | I9; revisado en el navegador (formulario de registro con op.gg y posición) | ✅ Cumple |
| CA-35 | Un equipo tiene como máximo 3 suplentes | I3; en la interfaz el botón Suplente se desactiva al llegar a 3 y el contador muestra 3/3 | ✅ Cumple |
| CA-36 | Al terminar un juego se pega el Game ID y la victoria se asigna al lado que ganó según Riot | U14, I10; revisado en el navegador (campo Game ID, error claro si Riot no la encuentra, registro manual como alternativa) | ✅ Cumple |
| CA-37 | Solo un administrador de la app puede eliminar scrims (por ejemplo, de prueba), revirtiendo sus puntos | I11; revisado en el navegador (sección Administración, búsqueda y confirmación) | ✅ Cumple |
| CA-38 | En el draft los campeones se filtran por posición, no por clase | U15; revisado en el navegador (filtros Jungla y Soporte) | ✅ Cumple |
| CA-39 | Reiniciar el draft de un juego requiere la aprobación de ambos equipos | I7; revisado en el navegador (solicitud arriba del draft, aceptar reinicia y pide confirmar de nuevo) | ✅ Cumple |

## Hallazgos corregidos durante las pruebas

- **Redirección de `/logout`:** apuntaba a `http://0.0.0.0:3000/login` (la dirección interna del contenedor), una dirección que el navegador no puede abrir. Ahora es relativa (`/login`); se agregó la verificación a N2.
- **Accesibilidad del login:** las etiquetas "Usuario o correo" y "Contraseña" no estaban asociadas a sus campos (`htmlFor`/`id`). Lectores de pantalla y la prueba E2E no podían ubicarlos. Corregido en `src/app/login/page.tsx`.

## Fuera del alcance automatizado

- Arrastrar y soltar en FullCalendar (se probó a mano; el endpoint que usa está cubierto por I1).
- Aspecto visual y animaciones (revisión manual).
- Pruebas de carga con muchos usuarios simultáneos.
