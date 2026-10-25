import { format, formatDistanceToNowStrict, isSameDay } from "date-fns";
import { es } from "date-fns/locale";

const pad = (n: number) => String(n).padStart(2, "0");

export const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const combine = (date: string, time: string) => new Date(`${date}T${time}:00`);

export const fmtDay = (d: string | Date) => format(new Date(d), "EEEE d 'de' MMMM", { locale: es });
export const fmtShortDay = (d: string | Date) => format(new Date(d), "EEE d MMM", { locale: es });
export const fmtTime = (d: string | Date) => format(new Date(d), "HH:mm");
export const fmtRange = (a: string | Date, b: string | Date) => `${fmtTime(a)} – ${fmtTime(b)}`;
export const fmtFull = (a: string | Date, b: string | Date) =>
  isSameDay(new Date(a), new Date(b))
    ? `${fmtDay(a)} · ${fmtRange(a, b)}`
    : `${format(new Date(a), "d MMM HH:mm", { locale: es })} → ${format(new Date(b), "d MMM HH:mm", { locale: es })}`;
export const fromNow = (d: string | Date) => formatDistanceToNowStrict(new Date(d), { locale: es, addSuffix: true });

export function durationLabel(a: string | Date, b: string | Date) {
  const mins = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}
