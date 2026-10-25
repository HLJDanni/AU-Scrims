import { requirePageUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return (
    <AppShell
      user={{ id: user.id, username: user.username, role: user.role, team: user.team! }}
    >
      {children}
    </AppShell>
  );
}
