import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/misc";
import { ChatView } from "@/components/chat/chat-view";

export const metadata: Metadata = { title: "Chat" };

export default async function ChatPage() {
  await requirePageUser();
  return (
    <>
      <PageHeader
        eyebrow="Coordinación entre equipos"
        title="Chat de scrims"
        description="Cada scrim aceptado abre un chat con el staff del rival. Desde aquí también entras al draft de la serie."
      />
      <Suspense>
        <ChatView />
      </Suspense>
    </>
  );
}
