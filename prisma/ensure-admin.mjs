// Crea o actualiza la cuenta de administrador de la app a partir de variables de entorno.
// Se ejecuta al iniciar el contenedor. La contraseña nunca está en el código: cambiar ADMIN_PASSWORD
// y reiniciar actualiza la contraseña. Sin ADMIN_USERNAME/ADMIN_PASSWORD no hace nada.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const username = process.env.ADMIN_USERNAME?.trim();
const password = process.env.ADMIN_PASSWORD ?? "";

if (!username || !password) process.exit(0);
if (!/^[A-Za-z0-9_.]{3,24}$/.test(username)) {
  console.warn("[admin] ADMIN_USERNAME inválido (3-24 letras, números, punto o guion bajo): no se crea el administrador");
  process.exit(0);
}
if (password.length < 12) {
  console.warn("[admin] ADMIN_PASSWORD debe tener al menos 12 caracteres: no se crea el administrador");
  process.exit(0);
}

const db = new PrismaClient();
try {
  const existing = await db.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } } });
  // Nunca convierte en administrador una cuenta normal que ya usa ese nombre
  if (existing && !existing.isAdmin) {
    console.warn(`[admin] Ya existe un usuario "${username}" que no es administrador: elige otro ADMIN_USERNAME`);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    if (existing) {
      const same = await bcrypt.compare(password, existing.passwordHash);
      if (!same) await db.user.update({ where: { id: existing.id }, data: { passwordHash } });
      console.log(`[admin] Administrador "${username}" listo${same ? "" : " (contraseña actualizada)"}`);
    } else {
      await db.user.create({
        data: {
          username,
          email: process.env.ADMIN_EMAIL?.trim().toLowerCase() || `${username.toLowerCase()}@admin.auscrims`,
          passwordHash,
          role: "LEGEND", // sin equipo: no agenda ni edita equipos; su permiso extra es la administración
          isAdmin: true,
        },
      });
      console.log(`[admin] Administrador "${username}" creado`);
    }
  }
} finally {
  await db.$disconnect();
}
