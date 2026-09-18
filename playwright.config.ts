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
    {
      name: "chromium-release-validation-auth",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /release-validation-auth\.spec\.ts/,
    },
    {
      name: "chromium-release-navigation-confirmation",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /release-navigation-confirmation\.spec\.ts/,
    },
    {
      name: "chromium-release-save-races",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /release-save-races\.spec\.ts/,
    },
    {
      name: "chromium-release-security",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /release-security-collaboration\.spec\.ts/,
    },
    // Auth setup — logs in once and saves storageState for each authenticated
    // module project. Those projects depend directly on setup so selecting one
    // never pulls unrelated feature suites into a directed run.
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },

    // Global not-found experience for authenticated app routes and arbitrary
    // unmatched paths. It reuses the normal session so `/dashboardx` and
    // nested dashboard paths reach Next.js instead of the login redirect.
    {
      name: "chromium-not-found",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /not-found-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // P1-03: an Escritura keeps its creation-version Machote snapshot.
    {
      name: "chromium-document-template-snapshot",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /document-template-snapshot-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Public (unauthenticated) tests.
    // Must NOT use storageState so redirect assertions work correctly.
    {
      name: "chromium-public",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /auth-smoke\.spec\.ts/,
    },

    // Public landing without storageState: proves `/` stays public while the
    // dashboard remains protected by the existing proxy.
    {
      name: "chromium-landing-public",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /landing-public\.spec\.ts/,
    },

    // The same landing remains available with a session and provides a direct
    // path into the authenticated panel.
    {
      name: "chromium-landing-authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /landing-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Auth hardening (login, logout, session persistence, revoked user,
    // password recovery). Self-contained in terms of DATA — each test
    // creates and deletes its own disposable user via the Admin API, so it
    // does not use storageState or depend on `setup`/E2E_USER_EMAIL like the
    // rest of the authenticated chain below. It still runs against the same
    // single `next dev` process and the same local Supabase/Mailpit
    // instance as every other project, so it's chained (`dependencies`)
    // together with the rest of this auth/Mailpit group below — not for
    // storageState, purely to stop Playwright's default parallel scheduler
    // from racing several real-email/multi-login flows against that one
    // shared dev server at the same time. Reproduced concretely: running
    // chromium-auth-security + chromium-recovery-token-safety +
    // chromium-team-management concurrently (3 workers, no dependencies)
    // made an unrelated recovery-token-safety assertion miss its default
    // 5s timeout — the dev server was simply too busy serving the other two
    // projects' concurrent flows to respond in time. Isolating them removes
    // the contention outright, instead of papering over it with a longer
    // timeout.
    {
      name: "chromium-auth-security",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /auth-security-hardening\.spec\.ts/,
    },

    // Seguridad del token de recuperación: un GET nunca debe consumirlo —
    // mismo bug y mismo fix que chromium-invite-token-safety, aplicado a
    // /auth/confirm?type=recovery. Ver la nota de contención compartida en
    // chromium-auth-security de arriba.
    {
      name: "chromium-recovery-token-safety",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /recovery-token-safety\.spec\.ts/,
      dependencies: ["chromium-auth-security"],
    },

    // Roles, invitaciones y permisos de equipo (Iteración 5). Ver la nota de
    // contención compartida en chromium-auth-security de arriba.
    {
      name: "chromium-team-management",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /team-management-authenticated\.spec\.ts/,
      dependencies: ["chromium-recovery-token-safety"],
    },

    // Gating profundo de UI por permiso (Machotes/Tiptap, Escrituras,
    // Índice Notarial, Cuentas por cobrar/Pagos) a través de los tres
    // roles propietario/asistente/solo_lectura. Ver la nota de contención
    // compartida en chromium-auth-security de arriba.
    {
      name: "chromium-deep-permission-gating",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /deep-permission-gating-authenticated\.spec\.ts/,
      dependencies: ["chromium-team-management"],
    },

    // Identidad notarial y auditoría de actores (Iteración 6). Ver la nota
    // de contención compartida en chromium-auth-security de arriba.
    {
      name: "chromium-notary-identity-actor-audit",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /notary-identity-actor-audit-authenticated\.spec\.ts/,
      dependencies: ["chromium-deep-permission-gating"],
    },

    // Seguridad del token de invitación: un GET nunca debe consumirlo (fix
    // del bug real donde un prefetch/escáner podía "usar" el enlace antes
    // que la persona). Ver la nota de contención compartida en
    // chromium-auth-security de arriba.
    {
      name: "chromium-invite-token-safety",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /invite-token-safety-authenticated\.spec\.ts/,
      dependencies: ["chromium-notary-identity-actor-audit"],
    },

    // Authenticated feature projects below share only the generated auth state.
    // Each depends directly on setup; ordering inside a stateful spec remains
    // explicit through test.describe.configure({ mode: "serial" }).

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

    // Pasted/typed template variable detection — authenticated.
    {
      name: "chromium-template-pasted-variables",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /template-pasted-variables-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Milestone feedback after the first template save — authenticated.
    {
      name: "chromium-template-milestone",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /template-milestone-feedback-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Option blocks configuration in templates — authenticated.
    {
      name: "chromium-template-option-blocks",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /template-option-blocks-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Ayuda para crear un machote con una herramienta de IA externa (botón +
    // modal, sin integración real de IA) — authenticated.
    {
      name: "chromium-template-ai-help",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /template-ai-help-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Stepper always visible from template creation (Información/Documento/
    // Variables/Índice/Publicar) — authenticated.
    {
      name: "chromium-template-stepper-create",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /template-stepper-create-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Guided-flow progression in Machotes: one persistent save action,
    // completion markers, toast feedback and free step navigation.
    {
      name: "chromium-template-guided-progression",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /template-guided-progression-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Sticky Guardar bar + tri-estado de Partes (Pendiente/Requiere/No
    // requiere) en el workspace de Machotes — authenticated.
    {
      name: "chromium-template-sticky-and-parties",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /template-workspace-sticky-and-parties-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Documents (Escrituras) workspace — authenticated.
    {
      name: "chromium-documents",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /documents-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Stepper visible from document creation (Completar/Cobro/Índice) —
    // authenticated.
    {
      name: "chromium-document-stepper-create",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /document-stepper-create-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Guided-flow progression in Escrituras: one persistent save action,
    // completion markers, optional Cobro resolution and Index navigation.
    {
      name: "chromium-document-guided-progression",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /document-guided-progression-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Guardado único: reopen sin navegación forzada y navigation guard
    // (salida real del workspace de Escrituras) — authenticated.
    {
      name: "chromium-document-reopen-guard",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /document-reopen-single-save-and-exit-guard-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Inline editing of variables directly in the document sheet — authenticated.
    {
      name: "chromium-document-inline-editing",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /document-inline-editing-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Using option blocks (variant selection) in documents — authenticated.
    {
      name: "chromium-document-option-blocks",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /document-option-blocks-authenticated\.spec\.ts/,
      dependencies: ["setup"],
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
      dependencies: ["setup"],
    },

    // Document DOCX download — authenticated.
    {
      name: "chromium-documents-docx",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /documents-docx-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Document format: Frente / Vuelto margins — authenticated.
    {
      name: "chromium-document-format",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /document-format-front-back-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Document ↔ client relationship — authenticated.
    {
      name: "chromium-documents-client",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /documents-client-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Contextual client creation from the document workspace — authenticated.
    {
      name: "chromium-document-client-dialog",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /document-client-contextual-creation-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Role-based autofill from a registered client — authenticated.
    {
      name: "chromium-document-role-autofill",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /document-role-autofill-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Documents workspace (search/filter/sort) — authenticated.
    {
      name: "chromium-documents-workspace",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /documents-workspace-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Document lifecycle statuses — authenticated.
    {
      name: "chromium-documents-lifecycle",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /documents-lifecycle-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Duplicating documents (draft and finalized) as new drafts — authenticated.
    {
      name: "chromium-documents-duplication",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /documents-duplication-authenticated\.spec\.ts/,
      dependencies: ["setup"],
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
      dependencies: ["setup"],
    },

    // Document activity history — authenticated.
    {
      name: "chromium-documents-activity",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /documents-activity-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Notarial index metadata — authenticated.
    {
      name: "chromium-notarial-metadata",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /notarial-metadata-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Reusable Parties configuration per template — authenticated.
    {
      name: "chromium-notarial-template-config",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /notarial-template-config-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Notarial index workspace — authenticated.
    {
      name: "chromium-notarial-workspace",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /notarial-workspace-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Notarial index DOCX export — authenticated.
    {
      name: "chromium-notarial-export",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /notarial-docx-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Notarial index inclusion (include_in_notarial_index) — authenticated.
    {
      name: "chromium-notarial-index-inclusion",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /notarial-index-inclusion-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Notarial index confirmation lifecycle — authenticated.
    {
      name: "chromium-notarial-index-confirmation",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /notarial-index-confirmation-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Template default for notarial index inclusion, snapshotted onto new
    // documents at creation — authenticated.
    {
      name: "chromium-template-notarial-index-default",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /template-notarial-index-default-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Receivables (Cuentas por cobrar) — authenticated.
    {
      name: "chromium-receivables",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /receivables-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Milestone feedback after creating a receivable — authenticated.
    {
      name: "chromium-receivable-milestone",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /receivable-milestone-feedback-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Receivable payments — authenticated.
    {
      name: "chromium-receivable-payments",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /receivable-payments-authenticated\.spec\.ts/,
      dependencies: ["setup"],
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
      dependencies: ["setup"],
    },

    // Receivables workspace (filters, totals) — authenticated.
    {
      name: "chromium-receivables-workspace",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /receivables-workspace-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Contextual client creation from the receivable form — authenticated.
    {
      name: "chromium-receivable-client-dialog",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /receivable-client-contextual-creation-authenticated\.spec\.ts/,
      dependencies: ["setup"],
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
      dependencies: ["setup"],
    },

    // Dashboard Panel + sidebar shell — authenticated.
    {
      name: "chromium-dashboard",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /dashboard-panel-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Canonical authenticated paths and compatibility redirects from the
    // former /dashboard/<module> route tree.
    {
      name: "chromium-authenticated-routing",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /authenticated-routing\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Account and workspace settings — authenticated.
    {
      name: "chromium-authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /settings-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Shared server-side table pagination — authenticated and independently
    // selectable for directed validation.
    {
      name: "chromium-table-pagination",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /table-pagination-authenticated\.spec\.ts/,
      dependencies: ["setup"],
    },

    // Inline review and confirmation lifecycle from the notarial index.
    {
      name: "chromium-notarial-inline-review",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /notarial-inline-review-authenticated\.spec\.ts/,
      dependencies: ["setup"],
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
