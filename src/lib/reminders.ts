// Avisos de inicio de scrim (estilo Teams): a los 15, 10 y 5 minutos. Funciones puras para poder probarlas.

export const REMINDER_MINUTES = [15, 10, 5] as const;
export type ReminderStage = (typeof REMINDER_MINUTES)[number];

/**
 * Aviso que corresponde según el tiempo que falta: el umbral más pequeño que todavía no se pasó.
 * 14:59 → 15 · 9:59 → 10 · 4:59 → 5 · más de 15 min o ya empezó → null.
 */
export function reminderStage(msLeft: number): ReminderStage | null {
  if (msLeft <= 0) return null;
  for (const m of [...REMINDER_MINUTES].sort((a, b) => a - b)) if (msLeft <= m * 60_000) return m;
  return null;
}

/** Clave única por scrim, horario y aviso: si el scrim se re-agenda, los avisos vuelven a salir. */
export const reminderKey = (scrim: { id: string; startAt: string }, stage: ReminderStage) => `${scrim.id}@${scrim.startAt}#${stage}`;

/** "09:42" a partir de milisegundos. */
export function mmss(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
