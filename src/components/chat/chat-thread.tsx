"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Info, Lock, Megaphone, SendHorizontal, Swords } from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { mutate as globalMutate } from "swr";
import { toast } from "sonner";
import { api, cn } from "@/lib/client";
import { ROLE_META, type ChatMessageDTO, type ScrimDTO } from "@/lib/constants";
import { fmtDay, fmtFull, fmtShortDay, fmtTime } from "@/lib/dates";
import { Button } from "../ui/button";
import { Skeleton, StatusBadge, TeamEmblem } from "../ui/misc";
import { useShell } from "../app-shell";

const POLL_MS = 2500;
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

/** Texto con links clicables (solo http/https, abren en otra pestaña). */
function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_RE).map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-hex-100 underline underline-offset-2 hover:text-hex-200">
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

// Hora si es de hoy; si no, el día (como la lista de chats de Teams)
const shortWhen = (d: string) => (new Date(d).toDateString() === new Date().toDateString() ? fmtTime(d) : fmtShortDay(d));
const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

/** Conversación de un scrim: se consulta cada pocos segundos y solo trae los mensajes nuevos. */
export function ChatThread({ scrim, onBack }: { scrim: ScrimDTO; onBack?: () => void }) {
  const { openDetail, canAct } = useShell();
  const [messages, setMessages] = useState<ChatMessageDTO[] | null>(null);
  const [writable, setWritable] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lastAt = useRef<string | null>(null);
  const stickToBottom = useRef(true);

  const markRead = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    api(`/api/scrims/${scrim.id}/messages/read`, { method: "POST" })
      .then(() => globalMutate("/api/chats"))
      .catch(() => null);
  }, [scrim.id]);

  const append = useCallback((incoming: ChatMessageDTO[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set((prev ?? []).map((m) => m.id));
      return [...(prev ?? []), ...incoming.filter((m) => !seen.has(m.id))];
    });
    lastAt.current = incoming[incoming.length - 1].createdAt;
  }, []);

  // Carga inicial + consulta periódica de mensajes nuevos
  useEffect(() => {
    let alive = true;
    setMessages(null);
    lastAt.current = null;
    stickToBottom.current = true;
    api<{ messages: ChatMessageDTO[]; writable: boolean }>(`/api/scrims/${scrim.id}/messages`)
      .then((r) => {
        if (!alive) return;
        setMessages(r.messages);
        setWritable(r.writable);
        lastAt.current = r.messages.at(-1)?.createdAt ?? new Date(0).toISOString();
        markRead();
      })
      .catch((err) => toast.error((err as Error).message));
    const timer = setInterval(async () => {
      if (!lastAt.current || document.visibilityState !== "visible") return;
      try {
        const r = await api<{ messages: ChatMessageDTO[]; writable: boolean }>(`/api/scrims/${scrim.id}/messages?after=${encodeURIComponent(lastAt.current)}`);
        if (!alive) return;
        setWritable(r.writable);
        if (r.messages.length) {
          append(r.messages);
          markRead();
        }
      } catch {}
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [scrim.id, append, markRead]);

  // Baja al último mensaje si el usuario ya estaba abajo
  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: messages && messages.length > 0 ? "smooth" : "auto" });
  }, [messages]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const r = await api<{ message: ChatMessageDTO }>(`/api/scrims/${scrim.id}/messages`, { body: { body } });
      stickToBottom.current = true;
      append([r.message]);
      setText("");
      globalMutate("/api/chats");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  const canWrite = writable && canAct;
  const draftOpen = scrim.status === "CONFIRMED" || scrim.status === "COMPLETED";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-void-500/60 px-4 py-3">
        {onBack && (
          <button onClick={onBack} className="rounded-md p-1.5 text-stone-300 hover:bg-void-700 hover:text-gold-50 md:hidden" aria-label="Volver a los chats">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <TeamEmblem team={scrim.opponent} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold tracking-wide text-gold-50">
            vs [{scrim.opponent.tag}] {scrim.opponent.name}
          </p>
          <p className="flex flex-wrap items-center gap-2 text-[11px] text-stone-400">
            <StatusBadge status={scrim.status} />
            <span className="truncate">{fmtFull(scrim.startAt, scrim.endAt)} · {scrim.games} juegos</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => openDetail(scrim.id)}>
            <Info className="h-4 w-4" /> <span className="hidden sm:inline">Detalles</span>
          </Button>
          {draftOpen && (
            <Link href={`/draft/${scrim.id}`}>
              <Button size="sm">
                <Swords className="h-4 w-4" /> Draft
              </Button>
            </Link>
          )}
        </div>
      </header>

      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {!messages ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="ml-auto h-10 w-1/2" />
            <Skeleton className="h-10 w-3/5" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-stone-400">Aún no hay mensajes. Saluda al otro equipo y acuerden los detalles del scrim.</p>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
            const grouped =
              !newDay && prev && !prev.system && !m.system && prev.author === m.author && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;
            return (
              <Fragment key={m.id}>
                {newDay && (
                  <div className="flex items-center gap-3 py-3">
                    <span className="h-px flex-1 bg-void-500/60" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">{fmtDay(m.createdAt)}</span>
                    <span className="h-px flex-1 bg-void-500/60" />
                  </div>
                )}
                <Bubble m={m} grouped={Boolean(grouped)} />
              </Fragment>
            );
          })
        )}
      </div>

      <div className="border-t border-void-500/60 p-3">
        {canWrite ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 1000))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={Math.min(5, Math.max(1, text.split("\n").length))}
              placeholder={`Escribe a [${scrim.opponent.tag}]… (Enter envía, Shift+Enter salto de línea)`}
              className="field min-h-10 flex-1 resize-none py-2.5"
              aria-label="Mensaje"
            />
            <Button type="submit" size="icon" loading={sending} disabled={!text.trim()} aria-label="Enviar">
              <SendHorizontal className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <p className="flex items-center justify-center gap-2 py-2 text-xs text-stone-400">
            <Lock className="h-3.5 w-3.5" />
            {!canAct ? "Vista de solo lectura" : "El scrim fue cancelado: el chat queda como historial"}
          </p>
        )}
      </div>
    </div>
  );
}

function Bubble({ m, grouped }: { m: ChatMessageDTO; grouped: boolean }) {
  if (m.system)
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center py-1.5">
        <p className="flex max-w-xl items-start gap-2 rounded-md border border-hex-200/30 bg-hex-500/20 px-3 py-2 text-xs text-hex-100">
          <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {m.body} <span className="text-[10px] text-stone-400">· {fmtTime(m.createdAt)}</span>
          </span>
        </p>
      </motion.div>
    );
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-2", m.mine ? "justify-end" : "justify-start", !grouped && "pt-2")}>
      {!m.mine && (
        <div className="w-8 shrink-0">{!grouped && m.team && <TeamEmblem team={m.team} size={30} />}</div>
      )}
      <div className={cn("max-w-[78%] sm:max-w-[65%]", m.mine && "items-end text-right")}>
        {!grouped && (
          <p className={cn("mb-0.5 flex items-center gap-1.5 text-[11px] text-stone-400", m.mine && "justify-end")}>
            <span className="font-semibold text-gold-100">{m.mine ? "Tú" : (m.author ?? "Usuario eliminado")}</span>
            {m.team && <span style={{ color: m.team.color }}>[{m.team.tag}]</span>}
            {m.authorRole && <span>· {ROLE_META[m.authorRole].label}</span>}
            <span>· {fmtTime(m.createdAt)}</span>
          </p>
        )}
        <div
          className={cn(
            "inline-block whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-left text-sm",
            m.mine ? "rounded-tr-sm border border-gold-500/50 bg-gold-700/30 text-gold-50" : "rounded-tl-sm border border-void-500/70 bg-void-700/70 text-gold-50",
          )}
        >
          <Linkified text={m.body} />
        </div>
      </div>
    </motion.div>
  );
}

/** Lista de conversaciones estilo Teams. */
export function ChatListItem({ active, onClick, chat }: { active: boolean; onClick: () => void; chat: import("@/lib/constants").ChatSummaryDTO }) {
  const s = chat.scrim;
  const last = chat.lastMessage;
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
        active ? "bg-gold-500/15 ring-1 ring-gold-500/50" : "hover:bg-void-700/70",
      )}
    >
      <TeamEmblem team={s.opponent} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn("truncate text-sm", chat.unread ? "font-bold text-gold-50" : "font-semibold text-gold-100")}>vs [{s.opponent.tag}] {s.opponent.name}</p>
          <span className="shrink-0 text-[10px] text-stone-400">{shortWhen(last?.createdAt ?? s.updatedAt)}</span>
        </div>
        <p className={cn("truncate text-xs", chat.unread ? "text-gold-100" : "text-stone-400")}>
          {last ? `${last.system ? "" : `${last.author ?? "—"}: `}${last.body}` : `Scrim ${fmtDay(s.startAt)}`}
        </p>
      </div>
      <AnimatePresence>
        {chat.unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-hex-200 px-1.5 text-[10px] font-bold text-void-950"
          >
            {chat.unread > 99 ? "99+" : chat.unread}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
