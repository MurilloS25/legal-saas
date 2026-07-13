import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Los specs de Playwright quedan fuera de vitest; los helpers puros de
    // e2e/support (p. ej. el registro de cleanup) sí se prueban con vitest.
    exclude: ["e2e/**/*.spec.ts", "e2e/*.setup.ts", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` lanza al resolverse fuera de un bundler RSC; en las
      // pruebas se reemplaza por un stub vacío para poder ejercitar los
      // módulos server-only puros (generación DOCX) bajo Node.
      "server-only": path.resolve(__dirname, "./test/support/server-only-stub.ts"),
    },
  },
});
