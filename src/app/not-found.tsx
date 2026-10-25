import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-7xl font-bold text-gold-200">404</p>
      <p className="text-stone-300">Esta grieta no existe.</p>
      <Link href="/dashboard" className="text-sm font-semibold uppercase tracking-wider text-hex-200 hover:text-hex-100">
        Volver al panel
      </Link>
    </div>
  );
}
