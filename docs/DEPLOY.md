# Publicar AU Scrims en Render + Neon

- **Render** ejecuta la app con el mismo `Dockerfile` que usas en local.
- **Neon** aloja la base PostgreSQL.

Los dos tienen plan gratuito y no piden tarjeta.

```
Usuario ──HTTPS──▶ Render (contenedor Next.js) ──TLS──▶ Neon (PostgreSQL 16)
                         └──▶ API de Riot (rangos)
```

## 1. Base de datos en Neon

1. Crea una cuenta en <https://neon.tech> y elige **New project**.
   - **Postgres version:** 16.
   - **Region:** AWS US East 1 (N. Virginia). Es la misma zona que Render en el paso 2; si están lejos, cada consulta se vuelve lenta.
   - **Database name:** `auscrims`.
2. En **Connect** copia dos cadenas:
   - **Pooled connection**, con el interruptor *Connection pooling* activado. El host contiene `-pooler`. Va en `DATABASE_URL`.
   - **Direct connection**, con el interruptor desactivado. Va en `DIRECT_URL`.
3. Agrega estos parámetros al final de cada cadena:

   | Cadena | Termina en |
   | --- | --- |
   | `DATABASE_URL` | `?sslmode=require&pgbouncer=true&connect_timeout=15` |
   | `DIRECT_URL` | `?sslmode=require&connect_timeout=15` |

   - `connect_timeout=15` da margen a Neon para despertar cuando estaba suspendida.
   - `pgbouncer=true` le avisa a Prisma que pasa por el pooler.

No hace falta crear tablas: el contenedor aplica las migraciones solo al iniciar (`prisma migrate deploy`).

## 2. App en Render

1. Crea una cuenta en <https://render.com> e inicia sesión con GitHub.
2. Ve a **New → Blueprint**, elige el repositorio `HLJDanni/AU-Scrims` y Render leerá [`render.yaml`](../render.yaml).
3. Te pedirá las variables marcadas como secretas:

   | Variable | Valor |
   | --- | --- |
   | `DATABASE_URL` | La cadena **pooled** de Neon |
   | `DIRECT_URL` | La cadena **direct** de Neon |
   | `RIOT_API_KEY` | Tu clave de Riot (puedes dejarla vacía y agregarla después) |
   | `ADMIN_USERNAME` | Usuario del administrador de la app, por ejemplo `admin.auscrims` |
   | `ADMIN_PASSWORD` | Contraseña del administrador, **mínimo 12 caracteres**, inventada por ti y guardada en un gestor de contraseñas |

   Render llena las demás solo:
   - `JWT_SECRET`: lo genera aleatorio.
   - `COOKIE_SECURE`: `true`.
   - `SEED_DEMO`: `false`.
4. Pulsa **Apply**. La primera construcción tarda de 5 a 10 minutos.
5. Revisa los **Logs**. Deben aparecer `[entrypoint] Aplicando migraciones…` y luego `Iniciando AU Scrims`.
6. Abre `https://au-scrims.onrender.com`. Si el nombre ya estaba ocupado, Render agrega un sufijo; la URL exacta aparece arriba en el panel.
7. Comprueba la base de datos en `https://<tu-app>.onrender.com/api/health?db=1`. Debe responder `{"ok":true,"db":true}`.

Desde ese momento, cada `git push` a `main` vuelve a desplegar solo.

### Administrador de la app

La cuenta de administrador no se registra desde la web: se crea sola al iniciar el contenedor con `ADMIN_USERNAME` y `ADMIN_PASSWORD`. Entra con ella en `/login` y verás la sección **Administración**, donde puedes eliminar cualquier scrim (por ejemplo, uno de prueba): se borra para ambos equipos con su chat y su draft, y si tenía resultado se revierten los puntos del ranking. Ningún equipo, ni su coach, puede hacerlo.

Para cambiar la contraseña, edita `ADMIN_PASSWORD` en **Environment** (Render redespliega solo). Si alguien más llegara a conocerla, cámbiala de inmediato.

### Datos de ejemplo (opcional, para una demostración)

Para mostrar la app con equipos y scrims de prueba:

1. Antes del primer inicio, pon `SEED_DEMO=true` y un `SEED_PASSWORD` propio. **No uses la contraseña de ejemplo**: el sitio es público.
2. El seed solo se ejecuta si la base está vacía.
3. Al terminar la demostración, vuelve a dejar `SEED_DEMO=false`.

### Dominio

- **Gratis:** la URL `*.onrender.com`, con HTTPS incluido.
- **Dominio propio:** ve a **Settings → Custom Domains**, agrega el dominio y crea en tu proveedor el registro `CNAME` que indica Render. El certificado HTTPS se emite solo.

## 3. Clave de Riot en producción

- La **Development key** vence cada 24 horas. Si la usas en Render, tendrás que cambiarla cada día en **Environment** (cambiarla redespliega la app).
- La **Personal key** es para proyectos personales o de pocos usuarios. Sirve mientras AU Scrims la usen pocos equipos.
- Si la app se abre a más comunidad, Riot pide una **Production key** registrada con la URL pública. Ya la tendrás tras este despliegue; ver [RIOT_API_KEY.md](RIOT_API_KEY.md).

## Ventajas

| | |
| --- | --- |
| **Costo 0** | Los dos planes gratis alcanzan para una tesis o una comunidad pequeña. |
| **Mismo contenedor que en local** | Render construye el `Dockerfile` del repositorio, así que lo que pruebas con `docker compose` es lo que se publica. |
| **HTTPS automático** | El certificado lo pone Render. La cookie de sesión viaja solo cifrada (`COOKIE_SECURE=true`). |
| **Despliegue continuo** | Cada `git push` a `main` construye y publica. Si la construcción falla, sigue en línea la versión anterior. |
| **Base administrada** | Neon hace respaldos, permite restaurar a un punto en el tiempo reciente y crear *branches* de la base para probar migraciones. |
| **Se suspende sola** | Neon se apaga sin tráfico y no gasta horas. El health check de Render no toca la base para no despertarla. |
| **Migraciones automáticas** | El contenedor aplica las migraciones pendientes al iniciar. |

## Riesgos y cómo mitigarlos

| Riesgo | Qué pasa | Mitigación |
| --- | --- | --- |
| **Arranque en frío** | El plan gratis de Render apaga la app tras ~15 min sin visitas. La primera visita después tarda **~30 a 60 s**, y Neon suma ~1 s al despertar. | Para una presentación, abre el sitio unos minutos antes. Para eliminarlo, usa el plan *Starter* de Render (de pago). |
| **Avisos de scrim con la app dormida** | Los avisos de 15, 10 y 5 minutos funcionan en el navegador de quien tiene la app abierta, así que no dependen del servidor. Pero si nadie la abre, nadie los recibe. | Es igual que en local. Para avisos sin la app abierta harían falta correos o notificaciones push (no incluido). |
| **Límites del plan gratis de Neon** | Almacenamiento y horas de cómputo limitadas al mes (consulta las cifras actuales en su página de precios). Si se agotan, la base se pausa hasta el mes siguiente. | AU Scrims usa muy poco: unos MB por cientos de scrims. El health check no despierta la base. |
| **Límites del plan gratis de Render** | 512 MB de RAM y horas de instancia limitadas al mes. | Sobra para una instancia. Revisa **Metrics** si crece el uso. |
| **El rate limit se reinicia** | El límite de intentos de login vive en memoria: se reinicia cuando la app se duerme o redespliega, y no se comparte entre instancias. | Con una instancia funciona. Para varias instancias habría que moverlo a Redis. |
| **Filtración de secretos** | Si `JWT_SECRET`, la cadena de Neon o la clave de Riot llegan a GitHub o a una captura, cualquiera podría firmar sesiones o leer la base. | Los secretos viven solo en el panel de Render. `.env` está en `.gitignore`. Si se exponen, rota el secreto: regenera la contraseña en Neon y la clave en Riot. Cambiar `JWT_SECRET` cierra todas las sesiones. |
| **Datos personales** | En internet hay correos, contraseñas cifradas con bcrypt y Riot IDs. | No subas datos reales de terceros sin su permiso. Las contraseñas nunca se guardan en texto plano. |
| **Migración que falla** | Si una migración nueva falla, el contenedor no arranca y Render mantiene la versión anterior. | Prueba primero con `docker compose` en local, o en un *branch* de Neon. |
| **Pérdida de datos** | El plan gratis de Neon guarda historial para restaurar, pero por poco tiempo. | Antes de cambios grandes, haz un respaldo: `pg_dump "$DIRECT_URL" > respaldo.sql`. |
| **Dependencia de terceros** | Si Render, Neon o la API de Riot fallan, la app falla o pierde los rangos. | La app funciona sin la API de Riot: solo deja de actualizar rangos. |
| **Términos de Riot** | Un sitio público con Personal key puede requerir Production key. | Registra el producto con la URL de Render y mantén el aviso legal del pie de la landing. |

## Comprobación rápida tras publicar

- [ ] `/api/health` responde `{"ok":true}` y `/api/health?db=1` responde `{"ok":true,"db":true}`.
- [ ] Registrarse, crear un equipo e iniciar sesión funciona, y la cookie `aus_session` aparece como *Secure*.
- [ ] Agregar un jugador con link de op.gg trae su rango, si configuraste `RIOT_API_KEY`.
- [ ] Agendar un scrim y verlo en el calendario.
