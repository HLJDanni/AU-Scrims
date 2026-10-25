import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TournamentBoard } from "@/components/tournaments/tournament-board";

export const metadata: Metadata = { title: "Torneo" };

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-4">
      <Link href="/tournaments" className="inline-flex items-center gap-1.5 text-sm text-stone-300 hover:text-gold-50">
        <ArrowLeft className="h-4 w-4" /> Torneos
      </Link>
      <TournamentBoard id={id} />
    </div>
  );
}
