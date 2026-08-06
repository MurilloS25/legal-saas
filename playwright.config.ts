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

    // Auth hardening (login, logout, session persistence, revoked user,
    // password recovery). Self-contained: each test creates and deletes its
    // own disposable user via the Admin API, so it does not use storageState
    // or depend on `setup`/E2E_USER_EMAIL like the rest of the authenticated
    // chain below.
    {
      name: "chromium-auth-security",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /auth-security-hardening\.spec\.ts/,
    },

    // Seguridad del token de recuperación: un GET nunca debe consumirlo —
    // mismo bug y mismo fix que chromium-invite-token-safety, aplicado a
    // /auth/confirm?type=recovery. Autocontenido por la misma razón que
    // chromium-auth-security.
    {
      name: "chromium-recovery-token-safety",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /recovery-token-safety\.spec\.ts/,
    },

    // Roles, invitaciones y permisos de equipo (Iteración 5). Autocontenido
    // igual que chromium-auth-security: cada test crea/borra sus propios
    // usuarios y Workspaces desechables vía la Admin API, así que no usa
    // storageState ni depende de `setup`.
    {
      name: "chromium-team-management",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /team-management-authenticated\.spec\.ts/,
    },

    // Gating profundo de UI por permiso (Machotes/Tiptap, Escrituras,
    // Índice Notarial, Cuentas por cobrar/Pagos) a través de los tres
    // roles propietario/asistente/solo_lectura. Autocontenido igual que
    // chromium-team-management.
    {
      name: "chromium-deep-permission-gating",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /deep-permission-gating-authenticated\.spec\.ts/,
    },

    // Identidad notarial y auditoría de actores (Iteración 6). Autocontenido
    // por la misma razón que chromium-team-management.
    {
      name: "chromium-notary-identity-actor-audit",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /notary-identity-actor-audit-authenticated\.spec\.ts/,
    },

    // Seguridad del token de invitación: un GET nunca debe consumirlo (fix
    // del bug real donde un prefetch/escáner podía "usar" el enlace antes
    // que la persona). Autocontenido por la misma razón que
    // chromium-team-management.
    {
      name: "chromium-invite-token-safety",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /invite-token-safety-authenticated\.spec\.ts/,
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

    // Pasted/typed template variable detection — authenticated.
    {
      name: "chromium-template-pasted-variables",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /template-pasted-variables-authenticated\.spec\.ts/,
      dependencies: ["chromium-template-fields"],
    },

    // Milestone feedback after the first template save — authenticated.
    {
      name: "chromium-template-milestone",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /template-milestone-feedback-authenticated\.spec\.ts/,
      dependencies: ["chromium-template-pasted-variables"],
    },

    // Option blocks configuration in templates — authenticated.
    {
      name: "chromium-template-option-blocks",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /template-option-blocks-authenticated\.spec\.ts/,
      dependencies: ["chromium-template-milestone"],
    },

    // Documents (Escrituras) workspace — authenticated.
    {
      name: "chromium-documents",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /documents-authenticated\.spec\.ts/,
      dependencies: ["chromium-template-option-blocks"],
    },

    // Inline editing of variables directly in the document sheet — authenticated.
    {
      name: "chromium-document-inline-editing",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /document-inline-editing-authenticated\.spec\.ts/,
      dependencies: ["chromium-documents"],
    },

    // Using option blocks (variant selection) in documents — authenticated.
    {
      name: "chromium-document-option-blocks",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /document-option-blocks-authenticated\.spec\.ts/,
      dependencies: ["chromium-document-inline-editing"],
    },

    // Simplified document data sidebar (progress + "Siguiente pendiente") —
    // authenticated.
    {
      name: "chromium-document-data-sidebar",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /document-data-sidebar-authenticated\.spec\.ts/,
      dependencies: ["chromium-document-option-blocks"],
    },

    // Document DOCX download — authenticated.
    {
      name: "chromium-documents-docx",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /documents-docx-authenticated\.spec\.ts/,
      dependencies: ["chromium-document-data-sidebar"],
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

    // Contextual client creation from the document workspace — authenticated.
    {
      name: "chromium-document-client-dialog",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /document-client-contextual-creation-authenticated\.spec\.ts/,
      dependencies: ["chromium-documents-client"],
    },

    // Role-based autofill from a registered client — authenticated.
    {
      name: "chromium-document-role-autofill",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /document-role-autofill-authenticated\.spec\.ts/,
      dependencies: ["chromium-document-client-dialog"],
    },

    // Documents workspace (search/filter/sort) — authenticated.
    {
      name: "chromium-documents-workspace",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /documents-workspace-authenticated\.spec\.ts/,
      dependencies: ["chromium-document-role-autofill"],
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

    // Duplicating documents (draft and finalized) as new drafts — authenticated.
    {
      name: "chromium-documents-duplication",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /documents-duplication-authenticated\.spec\.ts/,
      dependencies: ["chromium-documents-lifecycle"],
    },

    // Milestone feedback after the first draft save and after finalizing —
    // authenticated.
    {
      name: "chromium-document-milestone",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /document-milestone-feedback-authenticated\.spec\.ts/,
      dependencies: ["chromium-documents-duplication"],
    },

    // Document activity history — authenticated.
    {
      name: "chromium-documents-activity",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /documents-activity-authenticated\.spec\.ts/,
      dependencies: ["chromium-document-milestone"],
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

    // Milestone feedback after creating a receivable — authenticated.
    {
      name: "chromium-receivable-milestone",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /receivable-milestone-feedback-authenticated\.spec\.ts/,
      dependencies: ["chromium-receivables"],
    },

    // Receivable payments — authenticated.
    {
      name: "chromium-receivable-payments",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /receivable-payments-authenticated\.spec\.ts/,
      dependencies: ["chromium-receivable-milestone"],
    },

    // Financial immutability of receivables once payment history exists —
    // authenticated.
    {
      name: "chromium-receivable-financial-immutability",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /receivable-financial-immutability-authenticated\.spec\.ts/,
      dependencies: ["chromium-receivable-payments"],
    },

    // Receivables workspace (filters, totals) — authenticated.
    {
      name: "chromium-receivables-workspace",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /receivables-workspace-authenticated\.spec\.ts/,
      dependencies: ["chromium-receivable-financial-immutability"],
    },

    // Contextual client creation from the receivable form — authenticated.
    {
      name: "chromium-receivable-client-dialog",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /receivable-client-contextual-creation-authenticated\.spec\.ts/,
      dependencies: ["chromium-receivables-workspace"],
    },

    // Context navigation between a document and its receivables (returnTo
    // back link) — authenticated.
    {
      name: "chromium-document-receivable-navigation",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /document-receivable-context-navigation-authenticated\.spec\.ts/,
      dependencies: ["chromium-receivable-client-dialog"],
    },

    // Dashboard Panel + sidebar shell — authenticated.
    {
      name: "chromium-dashboard",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /dashboard-panel-authenticated\.spec\.ts/,
      dependencies: ["chromium-document-receivable-navigation"],
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
      dependencies: ["chromium-dashboard"],
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
