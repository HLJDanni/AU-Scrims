"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Logo } from "../logo";

export function AuthFrame({ title, subtitle, children, footer, wide }: { title: string; subtitle: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <BackgroundRunes />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={`relative w-full ${wide ? "max-w-2xl" : "max-w-md"}`}
      >
        <Link href="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <div className="hex-panel p-7 sm:p-9">
          <h1 className="text-center font-display text-2xl font-bold tracking-wide text-gold-50">{title}</h1>
          <p className="mt-1.5 text-center text-sm text-stone-300">{subtitle}</p>
          <div className="divider-gold my-6" />
          {children}
        </div>
        {footer && <div className="mt-6 text-center text-sm text-stone-300">{footer}</div>}
      </motion.div>
    </div>
  );
}

export function BackgroundRunes() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold-500/10"
        animate={{ rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
      >
        <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-gold-300/50 bg-void-950" />
        <span className="absolute bottom-0 left-1/2 h-3 w-3 -translate-x-1/2 translate-y-1/2 rotate-45 border border-hex-200/50 bg-void-950" />
      </motion.div>
      <motion.div
        className="absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-hex-200/10"
        animate={{ rotate: -360 }}
        transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
      />
      <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(200,155,60,.08),transparent)]" />
    </div>
  );
}
