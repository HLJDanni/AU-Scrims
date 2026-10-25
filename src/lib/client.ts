"use client";
import { mutate } from "swr";

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined") window.location.href = "/logout";
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Ocurrió un error");
  return data as T;
}

export const fetcher = <T,>(url: string) => api<T>(url);

/** Revalida todas las vistas que dependen de scrims (calendario, listas, dashboard, ranking). */
export function refreshScrims() {
  return mutate((key) => typeof key === "string" && (key.startsWith("/api/scrims") || key.startsWith("/api/leaderboard") || key.startsWith("/api/team")));
}

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
