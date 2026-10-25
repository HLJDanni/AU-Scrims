# Solicitud de Personal API Key de Riot Games

Guía para pedir la clave con la que AU Scrims podrá validar Riot IDs y leer el rango de SoloQ de los jugadores.

## Qué tipo de clave pedir

| Clave | Para qué sirve | Vence | Límite |
| --- | --- | --- | --- |
| Development | Probar mientras se aprueba la otra | Cada 24 h | 20 peticiones/s · 100 cada 2 min |
| **Personal** ← esta | Proyectos personales, académicos o de una comunidad pequeña | No vence | Igual que Development |
| Production | Sitios públicos con mucho tráfico | No vence | Más alto, requiere el producto ya publicado |

Para AU Scrims corresponde la **Personal API Key**: es un proyecto universitario, de uso interno para el staff de algunos equipos.

## Pasos

1. Entra a <https://developer.riotgames.com> e inicia sesión con tu cuenta de Riot.
2. Acepta los términos de la API.
3. En tu panel, elige **Register Product** y luego **Personal API Key**.
4. Llena el formulario con los textos de abajo. El formulario está en inglés; los textos ya están traducidos.
5. Envía y espera la revisión. Suele tardar de días a un par de semanas y llega por correo.
6. Mientras tanto, la **Development key** del panel sirve para probar (renuévala cada día).
7. Cuando tengas la clave, guárdala en el archivo `.env` (nunca en el código ni en GitHub):

   ```
   RIOT_API_KEY=RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

> Los nombres exactos de los campos pueden variar un poco según cambie el portal. Usa los textos según el campo que más se parezca.

## Textos para el formulario

**Product Name**

```
AU Scrims
```

**Product Description**

```
AU Scrims is a private scrim-scheduling platform for amateur and academic League of Legends teams in LAN/LAS, built as a university graduation project.

Only team staff (coach, analyst and captain) can use it. Each team registers its players by their main Riot ID. We want to use the Riot API to:

1. Validate that each registered Riot ID exists (ACCOUNT-V1: /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}), so teams cannot register typos or fake accounts.
2. Read each player's current Ranked Solo/Duo tier, division and LP (LEAGUE-V4: /lol/league/v4/entries/by-puuid/{puuid}) to show it in the team roster and compute the average rank of the five starters, so teams can find scrim partners of a similar level.

Ranks are refreshed on demand by staff and cached in our database for several hours; we do not poll the API continuously. Expected volume is a few hundred requests per day. We do not calculate or display hidden MMR, we do not sell data, and the app is not monetized. The scrim rating shown in the app is our own internal rating based on scrim results and is clearly separate from Riot's ranked system.
```

**Product URL**

```
https://github.com/HLJDanni/AU-Scrims
```

(Si publicas la app en un dominio, usa ese enlace. Riot debe poder ver el proyecto.)

**Product Game Focus**

```
League of Legends
```

**¿Es una organización?** No, proyecto personal / académico.

## Requisitos que Riot revisa

- [x] El aviso legal "isn't endorsed by Riot Games…" aparece en la página principal (pie de la landing).
- [x] La clave se guarda solo en el servidor (`.env`), nunca en el navegador ni en el repositorio (`.env` está en `.gitignore`).
- [x] No se calcula MMR oculto ni se reemplaza el sistema de clasificatorias de Riot.
- [x] Se respetan los límites de peticiones guardando los rangos en caché.
- [ ] Si Riot pide ver la app funcionando, comparte capturas o un video corto del roster y del detalle del scrim.

## Cómo activarla en AU Scrims

La integración está programada y **verificada con una clave real** (26/10/2026): los tres endpoints responden y la app trae el rango al agregar jugadores.

> Si Riot responde **401 "Unknown apikey"**, la clave venció o se regeneró después de copiarla: regenera en el Dashboard, pégala de nuevo en `.env` y recrea el contenedor.

1. Pega la clave en el archivo `.env`:

   ```
   RIOT_API_KEY=RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

2. Recrea el contenedor para que tome la variable:

   ```bash
   docker compose up -d
   ```

3. En **Mi equipo → Jugadores** pulsa **Actualizar rangos**. Desde ese momento, al agregar un jugador con su link de op.gg se verifica que la cuenta exista y se traen solos su rango, división, LP, nivel y partidas de SoloQ.

Con la **Development key** hay que repetir los pasos 1 y 2 cada día, porque vence a las 24 horas. Con la **Personal key** se hace una sola vez.

### Endpoints que usa la app

| Dato | Endpoint | Enrutamiento |
| --- | --- | --- |
| Validar Riot ID y obtener PUUID | `/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}` | `americas` (LAN, LAS, NA, BR, OCE) · `europe` · `asia` |
| Nivel de la cuenta | `/lol/summoner/v4/summoners/by-puuid/{puuid}` | `la1` LAN · `la2` LAS · `na1` · `br1` · `euw1` · `eun1` · `kr` · `oc1` |
| Rango de SoloQ | `/lol/league/v4/entries/by-puuid/{puuid}` | igual que el anterior |
