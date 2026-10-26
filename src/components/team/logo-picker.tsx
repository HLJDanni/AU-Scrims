"use client";
import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { TeamEmblem } from "../ui/misc";

const SIZE = 256;
const MAX_BYTES = 200 * 1024;
const MAX_INPUT = 8 * 1024 * 1024;

/** Recorta al centro en cuadrado de 256 px y la comprime (WebP, o JPEG si el navegador no lo soporta). */
async function toLogoDataUrl(file: File) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  for (const [type, q] of [["image/webp", 0.88], ["image/webp", 0.7], ["image/jpeg", 0.8]] as const) {
    const url = canvas.toDataURL(type, q);
    if (url.startsWith(`data:${type}`) && (url.length * 3) / 4 <= MAX_BYTES) return url;
  }
  throw new Error("No se pudo comprimir la imagen; prueba con otra");
}

/**
 * Selector de la imagen del equipo con vista previa del emblema (gira al pasar el cursor).
 * value: data URL nueva · current: URL de la imagen guardada · null en ambos = sin imagen.
 */
export function LogoPicker({
  team,
  value,
  current,
  onChange,
  size = 96,
}: {
  team: { tag: string; color: string };
  value: string | null | undefined;
  current?: string | null;
  onChange: (v: string | null) => void;
  size?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // undefined = sin cambios (se ve la guardada); null = quitarla
  const shown = value === undefined ? (current ?? null) : value;

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return toast.error("Usa una imagen PNG, JPG o WebP");
    if (file.size > MAX_INPUT) return toast.error("La imagen pesa más de 8 MB");
    setBusy(true);
    try {
      onChange(await toLogoDataUrl(file));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <TeamEmblem team={{ tag: team.tag || "TAG", color: team.color }} logoSrc={shown} size={size} />
      <p className="text-center text-[11px] text-stone-400">{shown ? "Pasa el cursor: gira y muestra las siglas" : "Sin imagen: se muestran las siglas"}</p>
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="flex items-center gap-1.5 rounded-md border border-gold-500/60 px-2.5 py-1.5 text-xs font-semibold text-gold-100 transition hover:border-gold-200 hover:bg-gold-200/10 disabled:opacity-50"
        >
          <ImagePlus className="h-3.5 w-3.5" /> {shown ? "Cambiar" : "Subir imagen"}
        </button>
        {shown && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-md p-1.5 text-stone-400 transition hover:bg-blood/10 hover:text-blood"
            aria-label="Quitar imagen"
            title="Quitar imagen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
