import "server-only";
import { fail } from "./api";

// Imagen del equipo: llega como data URL (la interfaz ya la recorta a 256×256) y se valida por su contenido real,
// no solo por el tipo declarado. Sin SVG: puede llevar scripts.
export const MAX_LOGO_BYTES = 200 * 1024;

const SIGNATURES: { type: string; test: (b: Buffer) => boolean }[] = [
  { type: "image/png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/webp", test: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
];

/** Convierte la data URL en bytes verificados. */
export function parseLogo(dataUrl: string) {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return fail(422, "La imagen debe ser PNG, JPG o WebP");
  const data = Buffer.from(m[2], "base64");
  if (data.length > MAX_LOGO_BYTES) return fail(422, "La imagen es demasiado pesada (máximo 200 KB)");
  const sig = SIGNATURES.find((s) => s.test(data));
  if (!sig) return fail(422, "El archivo no es una imagen válida");
  return { logo: data, logoType: sig.type, logoUpdatedAt: new Date() };
}

/** Datos para guardar: imagen nueva, quitarla (null) o no tocarla (undefined). */
export function logoData(input: string | null | undefined) {
  if (input === undefined) return {};
  if (input === null) return { logo: null, logoType: null, logoUpdatedAt: null };
  return parseLogo(input);
}
