import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/misc";
import { AdminScrims } from "@/components/admin/admin-scrims";

export const metadata: Metadata = { title: "Administración" };

export default async function AdminPage() {
  const user = await requirePageUser({ needsTeam: false });
  if (!user.isAdmin) redirect("/dashboard");
  return (
    <>
      <PageHeader
        eyebrow="Solo administrador"
        title="Administración de scrims"
        description="Todos los scrims de la plataforma. Eliminar uno lo borra para ambos equipos (con su chat y su draft) y, si tenía resultado, revierte los puntos del ranking."
      />
      <AdminScrims />
    </>
  );
}
