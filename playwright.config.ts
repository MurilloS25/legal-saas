import fs from "fs";
import { defineConfig, devices } from "@playwright/test";

function parseEnvValue(rawValue: string) {
  const value = rawValue.trim();
  const quote = value[0];

  if (
    (quote === "\"" || quote === "'") &&
    value.endsWith(quote) &&
    value.length >= 2
  ) {
    return value.slice(1, -1).trim();
  }

  return value;
}

// Load .env.local so E2E credentials are available to Playwright worker processes.
// Next.js loads .env.local for the dev server but not for the Playwright process itself.
try {
  const raw = fs.readFileSync(".env.local", "utf8");
  for (const line of raw.split("\n")) {
    const idx = line.indexOf("=");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = parseEnvValue(line.slice(idx + 1));
      if (key && !key.startsWith("#") && !process.env[key]) {
        process.env[key] = val;
      }
    }
  }
} catch {
  // .env.local absent — credentials must come from the environment.
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // Auth setup — logs in and saves storageState.
    // Runs before chromium-authenticated but not before chromium-public.
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },

    // Public (unauthenticated) tests.
    // Must NOT use storageState so redirect assertions work correctly.
    {
      name: "chromium-public",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /auth-smoke\.spec\.ts/,
    },

    // Clients module — authenticated.
    {
      name: "chromium-clients",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /clients-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Templates module — authenticated.
    {
      name: "chromium-templates",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /templates-authenticated\.spec\.ts/,
      dependencies: ["chromium-clients"],
    },

    // Template fields module — authenticated.
    {
      name: "chromium-template-fields",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /template-fields-authenticated\.spec\.ts/,
      dependencies: ["chromium-templates"],
    },

    // Documents (Escrituras) workspace — authenticated.
    {
      name: "chromium-documents",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /documents-authenticated\.spec\.ts/,
      dependencies: ["chromium-template-fields"],
    },

    // Document DOCX download — authenticated.
    {
      name: "chromium-documents-docx",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /documents-docx-authenticated\.spec\.ts/,
      dependencies: ["chromium-documents"],
    },

    // Document ↔ client relationship — authenticated.
    {
      name: "chromium-documents-client",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /documents-client-authenticated\.spec\.ts/,
      dependencies: ["chromium-documents-docx"],
    },

    // Documents workspace (search/filter/sort) — authenticated.
    {
      name: "chromium-documents-workspace",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /documents-workspace-authenticated\.spec\.ts/,
      dependencies: ["chromium-documents-client"],
    },

    // Document lifecycle statuses — authenticated.
    {
      name: "chromium-documents-lifecycle",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /documents-lifecycle-authenticated\.spec\.ts/,
      dependencies: ["chromium-documents-workspace"],
    },

    // Document activity history — authenticated.
    {
      name: "chromium-documents-activity",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /documents-activity-authenticated\.spec\.ts/,
      dependencies: ["chromium-documents-lifecycle"],
    },

    // Notarial index metadata — authenticated.
    {
      name: "chromium-notarial-metadata",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /notarial-metadata-authenticated\.spec\.ts/,
      dependencies: ["chromium-documents-activity"],
    },

    // Reusable Parties configuration per template — authenticated.
    {
      name: "chromium-notarial-template-config",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /notarial-template-config-authenticated\.spec\.ts/,
      dependencies: ["chromium-notarial-metadata"],
    },

    // Notarial index workspace — authenticated.
    {
      name: "chromium-notarial-workspace",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /notarial-workspace-authenticated\.spec\.ts/,
      dependencies: ["chromium-notarial-template-config"],
    },

    // Notarial index DOCX export — authenticated.
    {
      name: "chromium-notarial-export",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /notarial-docx-authenticated\.spec\.ts/,
      dependencies: ["chromium-notarial-workspace"],
    },

    // Receivables (Cuentas por cobrar) — authenticated.
    {
      name: "chromium-receivables",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /receivables-authenticated\.spec\.ts/,
      dependencies: ["chromium-notarial-export"],
    },

    // Receivable payments — authenticated.
    {
      name: "chromium-receivable-payments",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /receivable-payments-authenticated\.spec\.ts/,
      dependencies: ["chromium-receivables"],
    },

    // Receivables workspace (filters, totals) — authenticated.
    {
      name: "chromium-receivables-workspace",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /receivables-workspace-authenticated\.spec\.ts/,
      dependencies: ["chromium-receivable-payments"],
    },

    // Authenticated tests (settings) — must run last because test F logs
    // the user out, which would invalidate the shared session.
    {
      name: "chromium-authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /settings-authenticated\.spec\.ts/,
      dependencies: ["chromium-receivables-workspace"],
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer:
      !process.env.CI &&
      process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "true",
    timeout: 120 * 1000,
  },
});
