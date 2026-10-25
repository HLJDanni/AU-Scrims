"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/client";
import { AuthFrame } from "@/components/auth/auth-frame";
import { Button } from "@/components/ui/button";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api<{ hasTeam: boolean }>("/api/auth/login", { body: { identifier, password } });
      const next = params.get("next");
      router.replace(!res.hasTeam ? "/onboarding" : next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label htmlFor="identifier" className="label">Usuario o correo</label>
        <input id="identifier" className="field" autoComplete="username" autoFocus required value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
      </div>
      <div>
        <label htmlFor="password" className="label">Contraseña</label>
        <div className="relative">
          <input
            id="password"
            className="field pr-10"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-gold-100" aria-label="Mostrar contraseña">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        Entrar
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthFrame
      title="Iniciar sesión"
      subtitle="Acceso exclusivo para coaches, analistas y capitanes"
      footer={
        <>
          ¿Aún no tienes cuenta?{" "}
          <Link href="/register" className="font-semibold text-gold-200 hover:text-gold-50">
            Regístrate
          </Link>
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}
