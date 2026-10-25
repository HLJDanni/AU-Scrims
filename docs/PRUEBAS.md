# Plan y resultados de pruebas · AU Scrims

**Fecha de ejecución:** 24/10/2026 · **Entorno:** Docker local (app `:3000`, PostgreSQL `:5434`), datos demo · **Resultado global:** 15/15 pruebas automatizadas aprobadas

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
| Caja blanca | W1 | `tests/whitebox/scrim-dto.test.ts` | `toDTO`: ramas anfitrión/invitado (marcador y delta invertidos), valores nulos | ✅ |
| Caja blanca | W2 | `tests/whitebox/scrim-dto.test.ts` | `toDTO`: ramas de propuesta (ninguna, incompleta, propia, del rival, juegos por defecto) | ✅ |
| Caja negra | N1 | `tests/blackbox/api.test.ts` | Login: 401 con mensaje genérico, cookie `httpOnly` + `SameSite=Lax`, `/me` sin hash | ✅ |
| Caja negra | N2 | `tests/blackbox/api.test.ts` | Sin sesión: API 401, páginas → `/login`; otro origen 403; solo el coach regenera la invitación | ✅ |
| Caja negra | N3 | `tests/blackbox/api.test.ts` | Agendar válido → PENDIENTE con juegos y link; 5 entradas inválidas → 422; contra sí mismo → 400 | ✅ |
| Caja negra | N4 | `tests/blackbox/api.test.ts` | Choque de horario → 409; el anfitrión no puede aceptar (403); el rival sí; doble respuesta → 400 | ✅ |
| Caja negra | N5 | `tests/blackbox/api.test.ts` | Un tercer equipo no ve, edita ni cancela el scrim (404) y no aparece en sus listas; ranking ordenado | ✅ |
| Integración | I1 | `tests/integration/scrim-lifecycle.test.ts` | Agendar → aceptar → proponer → aprobar → link → jugar → resultado: estado en BD, Elo de ambos equipos, bitácora y ranking | ✅ |
| Integración | I2 | `tests/integration/delete-team.test.ts` | Eliminar equipo: capitán 403, nombre incorrecto 422, coach 200; se borran equipo y scrims, el staff queda sin equipo y va a `/onboarding` | ✅ |
| End-to-end | E1 | `tests/e2e/schedule-flow.spec.ts` | En el navegador: login → agendar con 5 juegos y link → Enviadas → detalle → Sala → copiar invitación → Actividad → cancelar | ✅ |

### Endpoints validados (17)

Además de las pruebas automatizadas, se hizo una verificación manual de los endpoints que esas pruebas no tocan:

| Endpoint | Casos | Resultado |
| --- | --- | --- |
| `POST /api/auth/register` | crear equipo 200 · correo duplicado 409 · unirse con código 200 · código inválido 404 | ✅ |
| `POST /api/auth/login` · `GET /api/auth/me` · `POST /api/auth/logout` | N1; tras logout la API responde 401 | ✅ |
| `GET/POST/PATCH /api/team` | capitán edita 403 · coach edita 200 · sin equipo 403 | ✅ |
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

## Hallazgos corregidos durante las pruebas

- **Accesibilidad del login:** las etiquetas "Usuario o correo" y "Contraseña" no estaban asociadas a sus campos (`htmlFor`/`id`). Lectores de pantalla y la prueba E2E no podían ubicarlos. Corregido en `src/app/login/page.tsx`.

## Fuera del alcance automatizado

- Arrastrar y soltar en FullCalendar (se probó a mano; el endpoint que usa está cubierto por I1).
- Aspecto visual y animaciones (revisión manual).
- Pruebas de carga con muchos usuarios simultáneos.
