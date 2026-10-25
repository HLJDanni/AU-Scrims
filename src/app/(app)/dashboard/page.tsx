import { requirePageUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = { title: "Inicio" };

export default async function DashboardPage() {
  const user = await requirePageUser();
  // El inicio tiene acciones de agenda: la Leyenda va directo a los scrims de su equipo
  if (user.role === "LEGEND") redirect("/scrims");
  return <DashboardView />;
}
