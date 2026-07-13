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

function activitySection(page: Page) {
  return page.getByRole("region", { name: "Actividad" });
}

function panelField(page: Page, label: string | RegExp) {
  return page
    .getByRole("region", { name: "Datos de la escritura" })
    .getByLabel(label);
}

async function openDocument(page: Page) {
  await page.goto(`/dashboard/documents/${documentId}`);
  await expect(
    page.getByRole("region", { name: "Datos de la escritura" }),
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
    await panelField(page, new RegExp(fieldLabel)).fill("Persona Uno");
    await page.getByRole("button", { name: "Guardar borrador" }).click();

    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/]+/, {
      timeout: 30_000,
    });
    await registerCreatedViaUi(registry, "documents", "title", draftTitle);
    documentId = new URL(page.url()).pathname.split("/").pop() as string;

    const activity = activitySection(page);
    await expect(activity).toBeVisible();
    await expect(activity.getByText("Escritura creada")).toBeVisible();
  });

  test("C: assigning a client and changing the title record events", async ({
    page,
  }) => {
    await openDocument(page);
    await page.getByLabel("Título de la escritura").fill(`${draftTitle} v2`);
    await page
      .getByLabel("Cliente principal (opcional)")
      .selectOption({ label: clientName });
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(
      page.getByText("Borrador guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    const activity = activitySection(page);
    await expect(activity.getByText("Cliente asociado")).toBeVisible();
    await expect(activity.getByText(`Cliente: ${clientName}`)).toBeVisible();
    await expect(activity.getByText("Título actualizado")).toBeVisible();
  });

  test("D: changing status records a status event", async ({ page }) => {
    await openDocument(page);
    await page
      .getByRole("button", { name: "Marcar como listo para revisar" })
      .click();
    await expect(
      page.getByText("Listo para revisar", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    const activity = activitySection(page);
    await expect(activity.getByText("Estado actualizado")).toBeVisible();
    await expect(
      activity.getByText("De Borrador a Listo para revisar"),
    ).toBeVisible();
  });

  test("E: the timeline shows the most recent event first", async ({ page }) => {
    await openDocument(page);
    const titles = await activitySection(page)
      .getByRole("heading", { level: 3 })
      .allInnerTexts();
    // El evento de estado es el más reciente; la creación, el más antiguo.
    expect(titles[0]).toBe("Estado actualizado");
    expect(titles[titles.length - 1]).toBe("Escritura creada");
  });

  test("F: generating a Word file records an event", async ({ page }) => {
    await openDocument(page);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar Word" }).click();
    await downloadPromise;

    await expect(
      activitySection(page).getByText("Documento Word generado"),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("G: a failed operation records no activity", async ({ page }) => {
    await openDocument(page);
    const contentEvents = activitySection(page).getByRole("heading", {
      name: "Contenido de la escritura actualizado",
    });
    const beforeContentEventCount = await contentEvents.count();

    // Vaciar un campo requerido bloquea el guardado (operación fallida).
    await panelField(page, new RegExp(fieldLabel)).fill("");
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(
      page.getByText(`${fieldLabel} es requerido`),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    // No debe existir un evento espurio: el conteo de "Contenido..." no crece
    // por un guardado que falló la validación.
    await expect(
      activitySection(page).getByRole("heading", {
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
