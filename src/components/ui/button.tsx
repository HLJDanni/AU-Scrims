"use client";
import { motion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/client";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "hex";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-gold-gradient text-void-950 font-semibold shadow-gold hover:brightness-110 border border-gold-100/40",
  secondary:
    "border border-gold-200/60 text-gold-100 bg-void-900/60 hover:bg-gold-200/10 hover:border-gold-200 hover:text-gold-50",
  ghost: "text-stone-300 hover:text-gold-50 hover:bg-void-700/70",
  danger: "border border-blood/50 text-blood bg-blood/5 hover:bg-blood/15 hover:border-blood",
  hex: "border border-hex-200/60 text-hex-100 bg-hex-500/40 hover:bg-hex-400/40 hover:shadow-hex",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-sm gap-2 tracking-wide",
  icon: "h-9 w-9 justify-center",
};

type Props = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: React.ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading, disabled, className, children, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileHover={disabled || loading ? undefined : { y: -1 }}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      transition={{ type: "tween", duration: 0.1 }}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center rounded-md uppercase tracking-wider transition-[background-color,border-color,color,box-shadow,filter] duration-100 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hex-200/60",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </motion.button>
  );
});
