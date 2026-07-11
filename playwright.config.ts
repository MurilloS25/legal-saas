import fs from "fs";
import { defineConfig, devices } from "@playwright/test";

// Load .env.local so E2E credentials are available to Playwright worker processes.
// Next.js loads .env.local for the dev server but not for the Playwright process itself.
try {
  const raw = fs.readFileSync(".env.local", "utf8");
  for (const line of raw.split("\n")) {
    const idx = line.indexOf("=");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
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

    // Authenticated tests (settings) — must run last because test F logs
    // the user out, which would invalidate the shared session for any
    // still-running authenticated project.
    {
      name: "chromium-authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /settings-authenticated\.spec\.ts/,
      dependencies: [
        "setup",
        "chromium-clients",
        "chromium-templates",
        "chromium-template-fields",
      ],
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
      dependencies: ["setup"],
    },

    // Template fields module — authenticated.
    {
      name: "chromium-template-fields",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /template-fields-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
