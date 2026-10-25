"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarDays, Link2, Repeat2, ShieldCheck, Swords, Trophy } from "lucide-react";
import { Logo } from "./logo";
import { Button } from "./ui/button";
import { BackgroundRunes } from "./auth/auth-frame";

const FEATURES = [
  { icon: CalendarDays, title: "Calendario estilo Teams", text: "Vista semanal, mensual y diaria. Selecciona un bloque y agenda en segundos." },
  { icon: Repeat2, title: "Re-agenda con aprobación", text: "Arrastra el scrim a otra hora; el rival aprueba o rechaza la propuesta." },
  { icon: Link2, title: "Link de sala", text: "Guarda el link del lobby y copia una invitación lista para tus jugadores." },
  { icon: Trophy, title: "Ranking Elo", text: "Cada resultado mueve el rating según juegos ganados y la fuerza del rival." },
  { icon: ShieldCheck, title: "Solo staff", text: "Coaches, analistas y capitanes. Cada equipo ve únicamente su historial." },
  { icon: Swords, title: "Historial completo", text: "Victorias, derrotas, cancelaciones y récord contra cada rival." },
];

export function Landing({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <BackgroundRunes />
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Logo />
        <div className="flex gap-2">
          {loggedIn ? (
            <Link href="/dashboard">
              <Button>Ir al panel</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost">Entrar</Button>
              </Link>
              <Link href="/register">
                <Button>Registrarse</Button>
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-20 pt-16 text-center sm:pt-24">
        <motion.p
          initial={{ opacity: 0, letterSpacing: "0.1em" }}
          animate={{ opacity: 1, letterSpacing: "0.4em" }}
          transition={{ duration: 1 }}
          className="text-xs font-semibold uppercase text-hex-200"
        >
          League of Legends · Staff Hub
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-wide text-gold-50 sm:text-7xl"
        >
          Agenda tus <span className="gold-text">scrims</span>
          <br /> como un equipo pro
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mx-auto mt-6 max-w-2xl text-base text-stone-300 sm:text-lg"
        >
          Coordina fecha, horario y número de juegos con otros equipos, comparte el link de la sala con tus jugadores y escala en el ranking.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href={loggedIn ? "/calendar" : "/register"}>
            <Button size="lg">{loggedIn ? "Abrir calendario" : "Crear mi equipo"}</Button>
          </Link>
          <Link href={loggedIn ? "/leaderboard" : "/login"}>
            <Button size="lg" variant="secondary">
              {loggedIn ? "Ver ranking" : "Ya tengo cuenta"}
            </Button>
          </Link>
        </motion.div>
        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.7, duration: 0.8 }} className="divider-gold mx-auto mt-16 max-w-xl" />
      </section>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: i * 0.07, duration: 0.5 }}
            whileHover={{ y: -4, transition: { duration: 0.12 } }}
            className="hex-panel group p-6"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md border border-gold-500/60 bg-void-800 text-gold-200 transition-[border-color,box-shadow] duration-150 group-hover:border-gold-200 group-hover:shadow-gold">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-bold tracking-wide text-gold-50">{f.title}</h3>
            <p className="mt-1.5 text-sm text-stone-300">{f.text}</p>
          </motion.div>
        ))}
      </section>
      <footer className="relative z-10 border-t border-void-500/60 px-6 py-6 text-center text-xs text-stone-400">
        {/* Aviso legal requerido por las políticas de desarrolladores de Riot Games */}
        <p className="mx-auto max-w-3xl">
          AU Scrims isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games or anyone officially involved in
          producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot
          Games, Inc.
        </p>
      </footer>
    </div>
  );
}
