import { z } from "zod";

export const roleSchema = z.enum(["COACH", "ANALYST", "CAPTAIN"], { message: "Selecciona un rol válido" });

const password = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "La contraseña es demasiado larga")
  .regex(/[A-Za-z]/, "La contraseña debe incluir letras")
  .regex(/\d/, "La contraseña debe incluir números");

export const teamFields = {
  name: z.string().trim().min(3, "El nombre del equipo necesita al menos 3 caracteres").max(40),
  tag: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,5}$/, "El tag debe tener 2 a 5 letras o números"),
  region: z.enum(["LAN", "LAS", "NA", "BR", "EUW", "EUNE", "KR", "OCE"]).default("LAN"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido")
    .default("#C8AA6E"),
};

export const createTeamSchema = z.object(teamFields);
export const updateTeamSchema = z
  .object({ ...teamFields, description: z.string().trim().max(400, "Máximo 400 caracteres").nullable().transform((v) => v || null) })
  .partial();

const tiers = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"] as const;
const apexTiers = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

export const playerSchema = z
  .object({
    gameName: z
      .string()
      .trim()
      .min(3, "El nombre del Riot ID debe tener 3 a 16 caracteres")
      .max(16, "El nombre del Riot ID debe tener 3 a 16 caracteres")
      .refine((v) => !v.includes("#"), "Escribe el nombre sin el #"),
    tagLine: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{2,5}$/, "El tag del Riot ID debe tener 2 a 5 letras o números"),
    position: z.enum(["TOP", "JUNGLE", "MID", "ADC", "SUPPORT", "SUB"], { message: "Selecciona una posición" }),
    tier: z.enum(tiers).nullable().default(null),
    division: z.coerce.number().int().min(1).max(4).nullable().default(null),
    lp: z.coerce.number().int().min(0, "LP inválidos").max(3000, "LP inválidos").default(0),
  })
  .transform((v) => {
    // Sin rango → sin división ni LP; Maestro+ no tiene división; el resto exige división
    if (!v.tier) return { ...v, division: null, lp: 0 };
    if (apexTiers.has(v.tier)) return { ...v, division: null };
    return { ...v, division: v.division ?? 4, lp: Math.min(v.lp, 99) };
  });
export const deleteTeamSchema = z.object({ confirmName: z.string().trim().min(1, "Escribe el nombre del equipo para confirmar") });
export const joinTeamSchema = z.object({ inviteCode: z.string().trim().toUpperCase().min(6, "Código inválido").max(12) });

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "El usuario necesita al menos 3 caracteres")
      .max(24)
      .regex(/^[A-Za-z0-9_.]+$/, "Usa solo letras, números, punto o guion bajo"),
    email: z.string().trim().toLowerCase().email("Correo inválido"),
    password,
    role: roleSchema,
    mode: z.enum(["create", "join"]),
    team: createTeamSchema.optional(),
    inviteCode: z.string().trim().toUpperCase().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "create" && !v.team) ctx.addIssue({ code: "custom", message: "Completa los datos del equipo" });
    if (v.mode === "join" && !v.inviteCode) ctx.addIssue({ code: "custom", message: "Ingresa el código de invitación" });
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Ingresa tu usuario o correo"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

const isoDate = z.coerce.date({ message: "Fecha inválida" });

const roomLink = z
  .string()
  .trim()
  .max(500)
  .url("El link de la sala debe ser una URL válida (https://...)")
  .refine((v) => /^https?:\/\//i.test(v), "El link debe iniciar con http:// o https://")
  .optional()
  .or(z.literal("").transform(() => undefined))
  .nullable();

const slot = {
  startAt: isoDate,
  endAt: isoDate,
  games: z.coerce.number().int().min(1, "Mínimo 1 juego").max(10, "Máximo 10 juegos"),
};

function refineSlot(v: { startAt: Date; endAt: Date }, ctx: z.RefinementCtx) {
  const minutes = (v.endAt.getTime() - v.startAt.getTime()) / 60000;
  if (minutes < 30) ctx.addIssue({ code: "custom", message: "El bloque debe durar al menos 30 minutos" });
  if (minutes > 12 * 60) ctx.addIssue({ code: "custom", message: "El bloque no puede durar más de 12 horas" });
  if (v.startAt.getTime() < Date.now() - 5 * 60000)
    ctx.addIssue({ code: "custom", message: "No puedes agendar en el pasado" });
}

export const createScrimSchema = z
  .object({
    opponentTeamId: z.string().min(1, "Selecciona un equipo rival"),
    ...slot,
    roomLink,
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .superRefine(refineSlot);

export const rescheduleSchema = z.object(slot).superRefine(refineSlot);

export const updateScrimSchema = z.object({
  roomLink,
  notes: z.string().trim().max(500).optional().nullable(),
});

export const respondSchema = z.object({ action: z.enum(["accept", "decline"]) });
export const proposalSchema = z.object({ action: z.enum(["accept", "reject"]) });

export const resultSchema = z.object({
  myScore: z.coerce.number().int().min(0).max(10),
  opponentScore: z.coerce.number().int().min(0).max(10),
});
