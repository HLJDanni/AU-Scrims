import { withAdmin } from "@/lib/api";
import { deleteScrim } from "@/lib/scrims";

/** Elimina un scrim (por ejemplo, uno de prueba) y revierte sus puntos. Solo administrador. */
export const DELETE = withAdmin<{ id: string }>(async ({ user, params }) => {
  const result = await deleteScrim(params.id);
  console.info(`[admin] ${user.username} eliminó el scrim ${params.id}${result.pointsReverted ? " (puntos revertidos)" : ""}`);
  return { ok: true, ...result };
});
