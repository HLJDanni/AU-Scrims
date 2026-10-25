import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      // "server-only" lanza error fuera del runtime de React Server Components
      "server-only": path.resolve(root, "tests/helpers/server-only-stub.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: loadEnv(mode, process.cwd(), ""),
    // Las pruebas de caja negra e integración comparten servidor y BD
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
}));
