import type { Metadata } from "next";
import { TournamentsView } from "@/components/tournaments/tournaments-view";

export const metadata: Metadata = { title: "Torneos" };

export default function TournamentsPage() {
  return <TournamentsView />;
}
