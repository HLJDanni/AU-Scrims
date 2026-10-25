// End-to-end: un coach inicia sesión en el navegador, agenda un scrim con link de sala,
// lo ve en Solicitudes → Enviadas, abre el detalle, copia la invitación y lo cancela.
// Crea su propio equipo, rival y coach temporales para no depender de los datos demo.
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const id = Math.random().toString(36).slice(2, 6).toUpperCase();
const PASSWORD = "E2eSegura123";
const fixture = {
  username: `e2e_coach_${id.toLowerCase()}`,
  team: { name: `E2E Home ${id}`, tag: `H${id}` },
  rival: { name: `E2E Rival ${id}`, tag: `R${id}` },
};

test.beforeAll(async () => {
  const [home] = await Promise.all([
    db.team.create({ data: { ...fixture.team, inviteCode: `EH${id}XX` } }),
    // Rating alto para que aparezca primero en la lista de rivales
    db.team.create({ data: { ...fixture.rival, inviteCode: `ER${id}XX`, rating: 4999 } }),
  ]);
  await db.user.create({
    data: {
      username: fixture.username,
      email: `${fixture.username}@test.dev`,
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      role: "COACH",
      teamId: home.id,
    },
  });
});

test.afterAll(async () => {
  // Borrar los equipos elimina en cascada sus scrims y su bitácora
  await db.team.deleteMany({ where: { tag: { in: [fixture.team.tag, fixture.rival.tag] } } });
  await db.user.deleteMany({ where: { username: fixture.username } });
  await db.$disconnect();
});

test("E2E · login → agendar scrim con link → ver en solicitudes → detalle y sala → cancelar", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  // Fecha lejana y aleatoria para no chocar con otros scrims
  const day = new Date();
  day.setDate(day.getDate() + 200 + Math.floor(Math.random() * 400));
  const dateValue = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  const hour = String(9 + Math.floor(Math.random() * 8)).padStart(2, "0");

  // 1. Login
  await page.goto("/login");
  await page.getByLabel("Usuario o correo").fill(fixture.username);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: fixture.team.name })).toBeVisible();

  // 2. Abrir el formulario y completar
  await page.getByRole("button", { name: /Agendar scrim/i }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Agendar scrim", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: new RegExp(fixture.rival.name) }).click();
  await dialog.locator('input[type="date"]').fill(dateValue);
  await dialog.locator('input[type="time"]').first().fill(`${hour}:00`);
  await dialog.getByRole("button", { name: "2h", exact: true }).click();
  await dialog.getByRole("button", { name: "5", exact: true }).click();
  await dialog.getByPlaceholder(/discord\.gg/).fill("https://discord.gg/e2e-room");
  await dialog.getByPlaceholder(/Fearless/).fill("Prueba E2E");
  await dialog.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(page.getByText("Solicitud de scrim enviada")).toBeVisible();
  await expect(dialog).toBeHidden();

  // 3. Aparece en Solicitudes → Enviadas
  await page.goto("/scrims?tab=requests");
  await page.getByRole("button", { name: /Enviadas/ }).click();
  const card = page.locator("div.cursor-pointer", { hasText: fixture.rival.name }).filter({ hasText: `${hour}:00` }).first();
  await expect(card).toBeVisible();
  await expect(card).toContainText("5 juegos");
  await expect(card).toContainText("Sala lista");

  // 4. Detalle → pestaña Sala → copiar invitación
  await card.click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText(`vs ${fixture.rival.name}`)).toBeVisible();
  await drawer.getByRole("tab", { name: /Sala/ }).click();
  await expect(drawer.getByText("https://discord.gg/e2e-room").first()).toBeVisible();
  await drawer.getByRole("button", { name: /Copiar invitación/ }).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain(`SCRIM ${fixture.team.tag} vs ${fixture.rival.tag}`);
  expect(clip).toContain("https://discord.gg/e2e-room");

  // 5. Actividad registra la creación
  await drawer.getByRole("tab", { name: /Actividad/ }).click();
  await expect(drawer.getByText(new RegExp(`${fixture.username} envió la solicitud`))).toBeVisible();

  // 6. Cancelar (limpieza) y verificar estado
  await drawer.getByRole("tab", { name: /Detalles/ }).click();
  page.once("dialog", (d) => d.accept());
  await drawer.getByRole("button", { name: "Cancelar scrim" }).click();
  await expect(page.getByText("Scrim cancelado")).toBeVisible();
  await expect(drawer.getByText("Cancelado").first()).toBeVisible();
});
