import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
  createTestTemplate,
  createTestTemplateField,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";

// Serial: comparten cliente, machote y escritura del mismo usuario.
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const clientName = uniqueName("activity", "cliente");
const templateName = uniqueName("activity", "machote");
const draftTitle = `${templateName} — Borrador`;
const fieldLabel = "Nombre de la parte";

let templateId = "";
let documentId = "";

async function activitySection(page: Page) {
  await page.getByRole("button", { name: "Historial" }).click();
  const dialog = page.getByRole("dialog", { name: "Historial de la escritura" });
  await expect(dialog).toBeVisible();
  return dialog.getByRole("region", { name: "Actividad" });
}

function documentRegion(page: Page) {
  return page.getByRole("region", { name: "Documento", exact: true });
}

async function fillInlineField(page: Page, key: string, value: string) {
  await documentRegion(page)
    .locator(`[data-variable-key="${key}"]`)
    .first()
    .click();
  const input = documentRegion(page).locator(`input[data-variable-key="${key}"]`);
  await input.fill(value);
  await input.blur();
}

async function openDocument(page: Page) {
  await page.goto(`/dashboard/documents/${documentId}`);
  await expect(
    page.getByRole("region", { name: "Datos de la Escritura" }),
  ).toBeVisible();
}

test.describe("document activity history", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "activity");
  });

  test("A: seed a client, template and field", async () => {
    await createTestClient(registry, { full_name: clientName });
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "ESCRITURA. Comparece {{parte.nombre}}.",
    });
    templateId = template.id;
    await createTestTemplateField(registry, template.id, {
      field_key: "parte.nombre",
      label: fieldLabel,
      required: true,
    });
  });

  test("B: creating a draft records a creation event", async ({ page }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);
    await fillInlineField(page, "parte.nombre", "Persona Uno");
    await page.getByRole("button", { name: "Crear escritura" }).click();

    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/]+/, {
      timeout: 30_000,
    });
    await registerCreatedViaUi(registry, "documents", "title", draftTitle);
    documentId = new URL(page.url()).pathname.split("/").pop() as string;

    const activity = await activitySection(page);
    await expect(activity).toBeVisible();
    await expect(activity.getByText("Escritura creada")).toBeVisible();
  });

  test("C: assigning a client and changing the title record events", async ({
    page,
  }) => {
    await openDocument(page);
    await page.getByLabel("Título de la escritura").fill(`${draftTitle} v2`);
    await page.getByRole("button", { name: /^Cliente principal/ }).click();
    await page
      .getByLabel("Cliente principal", { exact: true })
      .selectOption({ label: clientName });
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page.getByRole("status").getByText("Escritura guardada."),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    const activity = await activitySection(page);
    await expect(activity.getByText("Cliente asociado")).toBeVisible();
    await expect(activity.getByText(`Cliente: ${clientName}`)).toBeVisible();
    await expect(activity.getByText("Título actualizado")).toBeVisible();
  });

  test("D: finalizing records a lifecycle event", async ({ page }) => {
    await openDocument(page);
    await page.getByRole("tab", { name: "Revisar y finalizar" }).click();
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    await page
      .getByRole("alertdialog", { name: "Finalizar escritura" })
      .getByRole("button", { name: "Finalizar escritura" })
      .click();
    await expect(
      page.getByText("Finalizada", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    const activity = await activitySection(page);
    await expect(activity.getByText("Escritura finalizada")).toBeVisible();
    await expect(
      activity.getByText("De Borrador a Finalizada"),
    ).toBeVisible();
  });

  test("E: the timeline shows the most recent event first", async ({ page }) => {
    await openDocument(page);
    const titles = await (await activitySection(page))
      .getByRole("heading", { level: 3 })
      .allInnerTexts();
    // El evento de estado es el más reciente; la creación, el más antiguo.
    expect(titles[0]).toBe("Escritura finalizada");
    expect(titles[titles.length - 1]).toBe("Escritura creada");
  });

  test("F: generating a Word file records an event", async ({ page }) => {
    await openDocument(page);
    await page.getByRole("tab", { name: "Revisar y finalizar" }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar Word" }).click();
    await downloadPromise;

    await expect(
      (await activitySection(page)).getByText("Documento Word generado"),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("G: a failed operation records no activity", async ({ page }) => {
    await openDocument(page);
    await page.getByRole("tab", { name: "Revisar y finalizar" }).click();
    await page.getByRole("button", { name: "Reabrir escritura" }).click();
    await page
      .getByRole("alertdialog", { name: "¿Reabrir la escritura?" })
      .getByRole("button", { name: "Reabrir escritura" })
      .click();
    await expect(
      page.getByText("Borrador", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
    const contentEvents = (await activitySection(page)).getByRole("heading", {
      name: "Contenido de la escritura actualizado",
    });
    const beforeContentEventCount = await contentEvents.count();
    await page.getByRole("button", { name: "Cerrar historial" }).click();

    // Reabrir aterriza en "Revisar y finalizar" (no avanza — deshace la
    // finalización). El campo de título vive en "Completar" (el botón
    // "Guardar" ya es global — visible en Completar y Revisar por igual).
    await page.getByRole("tab", { name: "Completar", exact: true }).click();

    // Vaciar un campo requerido bloquea el guardado (operación fallida).
    await fillInlineField(page, "parte.nombre", "");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page.getByText(`${fieldLabel} es requerido`),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    // No debe existir un evento espurio: el conteo de "Contenido..." no crece
    // por un guardado que falló la validación.
    await expect(
      (await activitySection(page)).getByRole("heading", {
        name: "Contenido de la escritura actualizado",
      }),
    ).toHaveCount(beforeContentEventCount);
  });

  test("H: a second context cannot read the activity via the API", async ({
    browser,
    baseURL,
  }) => {
    // La actividad se sirve solo server-side; una petición anónima al detalle
    // redirige a login (ruta protegida) y nunca expone la actividad ajena.
    const anon = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const response = await anon.request.get(
      `${baseURL}/dashboard/documents/${documentId}`,
      { maxRedirects: 0 },
    );
    expect([302, 307]).toContain(response.status());
    await anon.close();
  });
});
