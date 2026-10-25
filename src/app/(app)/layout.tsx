import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // La Leyenda puede navegar sin equipo (ranking, jugadores, torneos); el staff necesita uno
  const user = await requirePageUser({ needsTeam: false });
  if (!user.teamId && user.role !== "LEGEND") redirect("/onboarding");
  return (
    <AppShell user={{ id: user.id, username: user.username, role: user.role, team: user.team }}>
      {children}
    </AppShell>
  );
}
