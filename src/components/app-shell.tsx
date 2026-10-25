"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Crown, LayoutDashboard, LogOut, Menu, Plus, Swords, Trophy, Users, X } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { SWRConfig } from "swr";
import useSWR from "swr";
import { api, cn, fetcher } from "@/lib/client";
import type { Role, ScrimDTO } from "@/lib/constants";
import { Logo } from "./logo";
import { RoleBadge, TeamEmblem } from "./ui/misc";
import { Button } from "./ui/button";
import { ScrimForm, type ScrimFormPrefill } from "./scrims/scrim-form";
import { ScrimDrawer } from "./scrims/scrim-drawer";

export type ShellUser = {
  id: string;
  username: string;
  role: Role;
  team: { id: string; name: string; tag: string; color: string; region: string; rating: number };
};

type Ctx = {
  user: ShellUser;
  openCreate: (prefill?: ScrimFormPrefill) => void;
  openReschedule: (scrim: ScrimDTO) => void;
  openDetail: (id: string) => void;
};
const ShellContext = createContext<Ctx | null>(null);
export const useShell = () => {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell fuera de AppShell");
  return ctx;
};

const NAV = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendario", icon: CalendarDays },
  { href: "/scrims", label: "Scrims", icon: Swords, badge: true },
  { href: "/leaderboard", label: "Ranking", icon: Trophy },
  { href: "/tournaments", label: "Torneos", icon: Crown },
  { href: "/team", label: "Mi equipo", icon: Users },
];

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const [form, setForm] = useState<{ open: boolean; prefill?: ScrimFormPrefill; scrim?: ScrimDTO }>({ open: false });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const ctx: Ctx = {
    user,
    openCreate: (prefill) => setForm({ open: true, prefill }),
    openReschedule: (scrim) => {
      setDetailId(null);
      setForm({ open: true, scrim });
    },
    openDetail: (id) => setDetailId(id),
  };

  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: true, dedupingInterval: 1500, keepPreviousData: true }}>
      <ShellContext.Provider value={ctx}>
        <div className="flex min-h-dvh">
          <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-void-500/60 bg-void-950 lg:flex">
            <Sidebar user={user} />
          </aside>

          <AnimatePresence>
            {mobileOpen && (
              <motion.div className="fixed inset-0 z-40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="absolute inset-0 bg-void-950/80" onClick={() => setMobileOpen(false)} />
                <motion.aside
                  initial={{ x: -280 }}
                  animate={{ x: 0 }}
                  exit={{ x: -280 }}
                  transition={{ type: "spring", stiffness: 380, damping: 36 }}
                  className="relative flex h-full w-64 flex-col border-r border-gold-500/40 bg-void-950"
                >
                  <button className="absolute right-3 top-4 text-stone-400" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú">
                    <X className="h-5 w-5" />
                  </button>
                  <Sidebar user={user} onNavigate={() => setMobileOpen(false)} />
                </motion.aside>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-void-500/60 bg-void-950/95 px-4 sm:px-6">
              <div className="flex items-center gap-3">
                <button className="rounded-md p-2 text-gold-100 hover:bg-void-700 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
                  <Menu className="h-5 w-5" />
                </button>
                <div className="lg:hidden">
                  <Logo compact />
                </div>
                <div className="hidden items-center gap-3 lg:flex">
                  <TeamEmblem team={user.team} size={34} />
                  <div className="leading-tight">
                    <p className="font-display text-sm font-bold tracking-wide text-gold-50">{user.team.name}</p>
                    <p className="text-[11px] text-stone-400">
                      {user.team.region} · Staff del equipo
                    </p>
                  </div>
                </div>
              </div>
              <Button size="sm" onClick={() => ctx.openCreate()}>
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Agendar scrim</span>
              </Button>
            </header>
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
          </div>
        </div>

        <ScrimForm
          open={form.open}
          prefill={form.prefill}
          scrim={form.scrim}
          onClose={() => setForm((f) => ({ ...f, open: false }))}
        />
        <ScrimDrawer id={detailId} onClose={() => setDetailId(null)} />
      </ShellContext.Provider>
    </SWRConfig>
  );
}

function Sidebar({ user, onNavigate }: { user: ShellUser; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useSWR<{ scrims: ScrimDTO[] }>("/api/scrims?scope=requests", { refreshInterval: 30_000 });
  const awaiting = (data?.scrims ?? []).filter(
    (s) => (s.status === "PENDING" && !s.isHost && !s.proposal) || (s.proposal && !s.proposal.byMe),
  ).length;

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <div className="px-5 pb-6 pt-5">
        <Link href="/dashboard" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>
      <div className="divider-gold mx-5 mb-4 w-auto" />
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                active ? "text-gold-50" : "text-stone-300 hover:text-gold-100",
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-md border border-gold-500/60 bg-gradient-to-r from-gold-500/25 via-gold-700/10 to-transparent"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              {active && <motion.span layoutId="nav-bar" className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-gold-300 shadow-[0_0_10px_#C89B3C]" />}
              <Icon className={cn("relative h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110", active && "text-gold-200")} />
              <span className="relative">{item.label}</span>
              {item.badge && awaiting > 0 && (
                <span className="relative ml-auto flex">
                  <span className="absolute inset-0 animate-ping rounded-full bg-hex-200/50" />
                  <span className="relative flex h-5 min-w-5 items-center justify-center rounded-full bg-hex-200 px-1.5 text-[10px] font-bold text-void-950">
                    {awaiting}
                  </span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 rounded-md border border-void-500/70 bg-void-900/80 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-300/60 bg-gold-gradient font-display text-sm font-bold text-void-950">
            {user.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gold-50">{user.username}</p>
            <RoleBadge role={user.role} />
          </div>
          <button onClick={logout} className="rounded-md p-2 text-stone-400 transition hover:bg-void-700 hover:text-blood" aria-label="Cerrar sesión" title="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
