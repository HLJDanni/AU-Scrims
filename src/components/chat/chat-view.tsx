"use client";
import { MessagesSquare, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/client";
import type { ChatSummaryDTO } from "@/lib/constants";
import { EmptyState, Skeleton } from "../ui/misc";
import { ChatListItem, ChatThread } from "./chat-thread";

/** Chats de scrims al estilo Teams: conversaciones a la izquierda y la conversación abierta a la derecha. */
export function ChatView() {
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("scrim");
  const [q, setQ] = useState("");
  const { data, isLoading } = useSWR<{ chats: ChatSummaryDTO[] }>("/api/chats", { refreshInterval: 5000 });

  const chats = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.chats ?? []).filter((c) => !term || `${c.scrim.opponent.tag} ${c.scrim.opponent.name}`.toLowerCase().includes(term));
  }, [data, q]);
  const current = data?.chats.find((c) => c.scrim.id === selected) ?? null;
  const open = (id: string | null) => router.replace(id ? `/chat?scrim=${id}` : "/chat", { scroll: false });

  if (!isLoading && data && data.chats.length === 0)
    return (
      <EmptyState
        icon={<MessagesSquare className="h-6 w-6" />}
        title="Todavía no hay chats"
        text="Cuando un rival acepte uno de tus scrims (o aceptes uno), se abrirá aquí un chat con su staff y el botón Draft."
      />
    );

  return (
    <div className="hex-panel grid h-[calc(100dvh-13rem)] min-h-[480px] overflow-hidden md:grid-cols-[320px_1fr]">
      <aside className={cn("flex min-h-0 flex-col border-r border-void-500/60", current && "hidden md:flex")}>
        <div className="border-b border-void-500/60 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar equipo…" className="field pl-9" aria-label="Buscar chat" />
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {isLoading && !data
            ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14" />)
            : chats.map((c) => <ChatListItem key={c.scrim.id} chat={c} active={c.scrim.id === selected} onClick={() => open(c.scrim.id)} />)}
          {data && chats.length === 0 && <p className="p-4 text-center text-xs text-stone-400">Sin resultados</p>}
        </div>
      </aside>
      <section className={cn("min-h-0", !current && "hidden md:block")}>
        {current ? (
          <ChatThread key={current.scrim.id} scrim={current.scrim} onBack={() => open(null)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-stone-400">
            <MessagesSquare className="h-10 w-10 text-gold-500" />
            <p className="text-sm">Elige una conversación para hablar con el otro equipo o abrir el draft.</p>
          </div>
        )}
      </section>
    </div>
  );
}
