import type { ScrimDTO } from "./constants";
import { fmtFull } from "./dates";

/** Mensaje listo para pegar en el chat del equipo con los datos del scrim. */
export function scrimInvite(scrim: ScrimDTO) {
  return [
    `⚔️ SCRIM ${scrim.myTeam.tag} vs ${scrim.opponent.tag}`,
    `📅 ${fmtFull(scrim.startAt, scrim.endAt)}`,
    `🎮 ${scrim.games} juegos`,
    scrim.roomLink ? `🔗 Sala: ${scrim.roomLink}` : null,
    scrim.notes ? `📝 ${scrim.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
