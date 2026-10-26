import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import { DraftRoom } from "@/components/draft/draft-room";

export const metadata: Metadata = { title: "Draft" };

// Pantalla completa (sin el menú de la app), como la transmisión del Mundial
export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser();
  const { id } = await params;
  return <DraftRoom scrimId={id} />;
}
