import { defineConfig, devices } from "@playwright/test";

// Las pruebas E2E preparan sus propios datos en la BD (DATABASE_URL del .env)
try {
  process.loadEnvFile(".env");
} catch {}

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3000",
    locale: "es-GT",
    timezoneId: "America/Guatemala",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
});
