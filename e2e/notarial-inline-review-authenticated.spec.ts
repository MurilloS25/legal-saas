import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  createDisposableUser,
  deleteUser,
  restDelete,
  restInsert,
} from "./support/supabase-admin";

/**
 * Expansión inline del Índice Notarial (Iteración 2, parte B). Autocontenido
 * — mismo patrón que notary-identity-actor-audit-authenticated.spec.ts: su
 * propio propietario + asistente desechables, para no interferir con la
 * sesión compartida de otros specs ni depender de su estado. La membresía
 * del asistente se siembra directo (workspace_members) en vez de por el
 * flujo real de invitación por correo — ese flujo ya tiene su propia
 * cobertura dedicada en team-management-authenticated.spec.ts; aquí lo que
 * importa es el permiso ya vigente, no cómo se obtuvo.
 *
 * La lógica de derivación/precedencia/completitud/confirmación NO se
 * reverifica aquí (ya cubierta a fondo por
 * src/features/notarial-index/model/notarial.test.ts) — este spec cubre
 * solo la UI nueva: expandir/cerrar, una fila a la vez, guardar/confirmar/
 * corregir vía la revisión inline, "Ver escritura", permisos, y que cambiar
 * filtros/página cierra la expansión.
 */
test.setTimeout(90_000);

const PASSWORD = "Segura!DePrueba9";

function uniqueEmail(label: string): string {
  return `e2e-notarial-inline-${label}-${randomUUID()}@example.com`;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

/**
 * `document_notarial_metadata` está protegida por un trigger
 * (`enforce_notarial_metadata_editable`) que exige `is_workspace_member`
 * sobre el actor real (`auth.uid()`) — a diferencia de `templates`/
 * `documents`, un INSERT vía service role (sin sesión, `auth.uid()` nulo)
 * lo rechaza con "workspace membership required". Se siembra este único
 * registro autenticado de verdad como el propietario, en vez de vía
 * `restInsert` (service role) como el resto de fixtures de este archivo.
 */
async function insertNotarialMetadataAsUser(
  email: string,
  password: string,
  row: Record<string, unknown>,
): Promise<void> {
  const apiKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const tokenResponse = await fetch(
    `${requireEnv("NEXT_PUBLIC_SUPABASE_URL")}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
  );
  if (!tokenResponse.ok) {
    throw new Error(`Password grant failed: ${tokenResponse.status} ${await tokenResponse.text()}`);
  }
  const { access_token: accessToken } = (await tokenResponse.json()) as {
    access_token: string;
  };

  const insertResponse = await fetch(
    `${requireEnv("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/document_notarial_metadata`,
    {
      method: "POST",
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(row),
    },
  );
  if (!insertResponse.ok) {
    throw new Error(
      `Insert into document_notarial_metadata failed: ${insertResponse.status} ${await insertResponse.text()}`,
    );
  }
}

async function loginAndExpectDashboard(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await page.getByRole("navigation", { name: "Navegación principal" }).waitFor();
}

test.describe("notarial index inline review", () => {
  test.describe.configure({ mode: "serial" });

  const ownerEmail = uniqueEmail("owner");
  const assistantEmail = uniqueEmail("assistant");
  let ownerId: string;
  let assistantId: string;
  let templateId: string;
  let completeDocId: string;
  let incompleteDocId: string;
  const indexUrl =
    "/dashboard/notarial-index?year=2026&month=7&half=FIRST_HALF";

  test.beforeAll(async () => {
    ownerId = await createDisposableUser(ownerEmail, PASSWORD);
    assistantId = await createDisposableUser(assistantEmail, PASSWORD);

    await restInsert("workspace_members", {
      workspace_id: ownerId,
      user_id: assistantId,
      role: "asistente",
      status: "active",
    });

    const template = await restInsert<{ id: string }>("templates", {
      owner_id: ownerId,
      workspace_id: ownerId,
      name: `E2E Inline Review Template ${randomUUID().slice(0, 8)}`,
      status: "active",
      content_json: { text: "ESCRITURA de prueba de revisión inline." },
      text_preview: "ESCRITURA de prueba de revisión inline.",
    });
    templateId = template.id;

    const completeDoc = await restInsert<{ id: string }>("documents", {
      owner_id: ownerId,
      workspace_id: ownerId,
      template_id: templateId,
      title: `E2E Inline Complete ${randomUUID().slice(0, 8)}`,
      status: "final",
      field_values: {},
      rendered_content: "ESCRITURA de prueba de revisión inline.",
      include_in_notarial_index: true,
      created_at: "2026-07-05T12:00:00.000Z",
    });
    completeDocId = completeDoc.id;

    await insertNotarialMetadataAsUser(ownerEmail, PASSWORD, {
      owner_id: ownerId,
      workspace_id: ownerId,
      document_id: completeDocId,
      instrument_number: 101,
      authorized_at: "2026-07-05T15:00:00.000Z",
      protocol_book: "08",
      initial_folio: "1F",
      final_folio: "1V",
      act_name_snapshot: "Compraventa de prueba",
      generated_parties: "Juan Pérez Gómez y María López Sánchez",
    });

    const incompleteDoc = await restInsert<{ id: string }>("documents", {
      owner_id: ownerId,
      workspace_id: ownerId,
      template_id: templateId,
      title: `E2E Inline Incomplete ${randomUUID().slice(0, 8)}`,
      status: "final",
      field_values: {},
      rendered_content: "ESCRITURA de prueba de revisión inline.",
      include_in_notarial_index: true,
      created_at: "2026-07-06T12:00:00.000Z",
    });
    incompleteDocId = incompleteDoc.id;
  });

  test.afterAll(async () => {
    await restDelete("workspace_activity", `workspace_id=eq.${ownerId}`);
    await deleteUser(assistantId);
    await deleteUser(ownerId);
  });

  function expandButton(page: Page, documentId: string) {
    return page.locator(`[aria-controls="notarial-row-detail-${documentId}"]`);
  }

  function detailRegion(page: Page, documentId: string) {
    return page.locator(`#notarial-row-detail-${documentId}`);
  }

  // Cada `test()` recibe un `page` nuevo y sin sesión (Playwright no
  // comparte contexto entre tests, ni en modo serial) — a diferencia de un
  // único test largo con múltiples pasos, aquí hay que iniciar sesión como
  // propietario al principio de cada uno (excepto I, que usa su propia
  // sesión de asistente en otro contexto).
  test.beforeEach(async ({ page }) => {
    await loginAndExpectDashboard(page, ownerEmail, PASSWORD);
  });

  test("A: expanding a row reveals its inline review", async ({ page }) => {
    await page.goto(indexUrl);

    const button = expandButton(page, completeDocId);
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(detailRegion(page, completeDocId)).toBeVisible();
  });

  test("B: only one row is expanded at a time", async ({ page }) => {
    await page.goto(indexUrl);
    await expandButton(page, completeDocId).click();
    await expect(detailRegion(page, completeDocId)).toBeVisible();

    await expandButton(page, incompleteDocId).click();
    await expect(detailRegion(page, incompleteDocId)).toBeVisible();
    await expect(expandButton(page, completeDocId)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(page.locator(`#notarial-row-detail-${completeDocId}`)).toHaveCount(0);
  });

  test("C: clicking the same row again closes it", async ({ page }) => {
    await page.goto(indexUrl);
    const button = expandButton(page, completeDocId);
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(`#notarial-row-detail-${completeDocId}`)).toHaveCount(0);
  });

  test("D: an incomplete record shows exactly what's missing", async ({ page }) => {
    await page.goto(indexUrl);
    await expandButton(page, incompleteDocId).click();
    const detail = detailRegion(page, incompleteDocId);
    await expect(detail.getByText(/Faltan:/)).toBeVisible();
    await expect(detail.getByText(/número de instrumento/)).toBeVisible();
  });

  test("E: saving metadata inline persists it and updates completeness", async ({
    page,
  }) => {
    await page.goto(indexUrl);
    const detail = detailRegion(page, incompleteDocId);
    await expandButton(page, incompleteDocId).click();

    await detail.getByLabel("Número de instrumento").fill("202");
    await detail.getByLabel("Fecha y hora de autorización").fill("2026-07-06T10:00");
    await detail.getByLabel("Tomo").fill("09");
    await detail.getByLabel("Folio inicial").fill("2F");
    await detail.getByLabel("Folio final").fill("2V");
    await detail.getByLabel("Acto o contrato").fill("Donación de prueba");
    await detail.getByLabel("Partes / comparecientes").fill("Ana Rodríguez y Luis Castro");
    await detail.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByText(/Datos del índice completos\.|Cambios del índice guardados\./)).toBeVisible({
      timeout: 15_000,
    });
    await expect(detail.getByText(/Faltan:/)).toHaveCount(0);
  });

  test("F: confirming complete data updates the lifecycle state", async ({ page }) => {
    await page.goto(indexUrl);
    const detail = detailRegion(page, incompleteDocId);
    await expandButton(page, incompleteDocId).click();

    await detail.getByRole("button", { name: "Confirmar datos" }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Confirmar datos" }).click();

    await expect(detail.getByText("Confirmado", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(detail.getByLabel("Número de instrumento")).toBeDisabled();
  });

  test("G: correcting confirmed data reopens it for editing per the real lifecycle", async ({
    page,
  }) => {
    await page.goto(indexUrl);
    const detail = detailRegion(page, incompleteDocId);
    await expandButton(page, incompleteDocId).click();
    await expect(detail.getByText("Confirmado", { exact: true })).toBeVisible();

    await detail.getByRole("button", { name: "Corregir datos" }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Corregir datos" }).click();

    await expect(detail.getByText("Revisión requerida")).toBeVisible({ timeout: 15_000 });
    await expect(detail.getByLabel("Número de instrumento")).toBeEnabled();
  });

  test("H: 'Ver escritura' always links to the full document", async ({ page }) => {
    await page.goto(indexUrl);
    await expandButton(page, completeDocId).click();
    const detail = detailRegion(page, completeDocId);
    await expect(detail.getByRole("link", { name: "Ver escritura" })).toHaveAttribute(
      "href",
      `/dashboard/documents/${completeDocId}`,
    );
  });

  test("I: an asistente can open the inline review for a row (notarial_index.generate)", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const assistantPage = await context.newPage();
    await loginAndExpectDashboard(assistantPage, assistantEmail, PASSWORD);
    await assistantPage.goto(indexUrl);

    const button = expandButton(assistantPage, completeDocId);
    await button.click();
    const detail = detailRegion(assistantPage, completeDocId);
    await expect(detail).toBeVisible();
    await expect(
      detail.getByRole("link", { name: "Ver escritura" }),
    ).toHaveAttribute("href", `/dashboard/documents/${completeDocId}`);
    await context.close();
  });

  test("J: changing a filter closes the currently expanded row", async ({ page }) => {
    await page.goto(indexUrl);
    const button = expandButton(page, completeDocId);
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");

    await page.getByLabel("Completitud").selectOption("complete");
    await expect(page.locator(`#notarial-row-detail-${completeDocId}`)).toHaveCount(0);
  });
});
