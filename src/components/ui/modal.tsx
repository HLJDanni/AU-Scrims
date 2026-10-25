"use client";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/client";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  variant?: "center" | "drawer";
  className?: string;
};

export function Modal({ open, onClose, title, subtitle, children, variant = "center", className }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const drawer = variant === "drawer";

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn("fixed inset-0 z-50 flex", drawer ? "justify-end" : "items-center justify-center p-4")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-void-950/75 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={drawer ? { x: "100%" } : { opacity: 0, scale: 0.94, y: 16 }}
            animate={drawer ? { x: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={drawer ? { x: "100%" } : { opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            className={cn(
              "hex-panel relative flex max-h-full flex-col bg-void-900/95",
              drawer ? "h-full w-full max-w-xl rounded-none border-y-0 border-r-0" : "max-h-[92dvh] w-full max-w-lg",
              className,
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-void-500/60 px-6 py-5">
              <div className="min-w-0">
                {title && <h2 className="font-display text-lg font-bold tracking-wide text-gold-50">{title}</h2>}
                {subtitle && <div className="mt-1 text-sm text-stone-300">{subtitle}</div>}
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar"
                className="rounded-md p-1.5 text-stone-400 transition hover:rotate-90 hover:bg-void-700 hover:text-gold-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
