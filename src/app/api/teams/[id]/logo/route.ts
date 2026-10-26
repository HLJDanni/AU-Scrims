import { db } from "@/lib/db";
import { fail, withUser } from "@/lib/api";

/** Imagen del equipo. La URL lleva ?v=<fecha de la imagen>, así que se puede guardar en caché sin límite. */
export const GET = withUser<{ id: string }>(async ({ params }) => {
  const team = await db.team.findUnique({ where: { id: params.id }, select: { logo: true, logoType: true } });
  if (!team?.logo || !team.logoType) fail(404, "El equipo no tiene imagen");
  return new Response(new Uint8Array(team!.logo!), {
    headers: {
      "Content-Type": team!.logoType!,
      "Cache-Control": "private, max-age=31536000, immutable",
      // Aunque alguien lograra subir otro contenido, el navegador no ejecuta nada desde esta ruta
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
    },
  });
});
