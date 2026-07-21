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

const clientName = uniqueName("docclient", "cliente");
const templateName = uniqueName("docclient", "machote");
const draftTitle = `${templateName} — Borrador`;
const fieldLabel = "Nombre del comprador";

let clientId = "";

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

test.describe("document ↔ client relationship", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "docclient");
  });

  test("A: seed a client, template and field", async () => {
    const client = await createTestClient(registry, { full_name: clientName });
    clientId = client.id;
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "ESCRITURA. Comparece {{comprador.nombre}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "comprador.nombre",
      label: fieldLabel,
      required: true,
    });
  });

  test("B: client detail shows the empty escrituras state and a new action", async ({
    page,
  }) => {
    await page.goto(`/dashboard/clients/${clientId}`);
    await expect(
      page.getByRole("heading", { name: "Escrituras", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Este cliente todavía no tiene escrituras asociadas."),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Nueva escritura" }),
    ).toBeVisible();
  });

  test("C: starting from the client preselects it through the flow", async ({
    page,
  }) => {
    await page.goto(`/dashboard/clients/${clientId}`);
    await page.getByRole("link", { name: "Nueva escritura" }).click();

    // El picker conserva el cliente y lo muestra.
    await expect(page).toHaveURL(/\/dashboard\/documents\/new\?client=/, {
      timeout: 15_000,
    });
    await expect(page.getByText(`Cliente principal:`)).toBeVisible();
    await expect(page.getByText(clientName)).toBeVisible();

    // Elegir el machote conserva el cliente en el query param.
    await page
      .locator("li")
      .filter({ hasText: templateName })
      .getByRole("link", { name: "Usar este machote" })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/new\/[^/]+\?client=/, {
      timeout: 15_000,
    });

    // El compositor tiene el cliente preseleccionado.
    await expect(page.getByLabel("Cliente principal (opcional)")).toHaveValue(
      clientId,
    );

    await fillInlineField(page, "comprador.nombre", "Cliente Prueba");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/]+/, {
      timeout: 30_000,
    });
    await expect(
      page.getByText("Escritura guardada como borrador", { exact: true }),
    ).toBeVisible();
    await registerCreatedViaUi(registry, "documents", "title", draftTitle);

    // El detalle de la escritura muestra el cliente asociado.
    await expect(page.getByText(`Cliente: ${clientName}`)).toBeVisible();
  });

  test("D: the associated escritura appears in the client detail", async ({
    page,
  }) => {
    await page.goto(`/dashboard/clients/${clientId}`);
    const row = page.locator("tbody tr").filter({ hasText: draftTitle });
    await expect(row).toBeVisible();
    await expect(row.getByText("Borrador", { exact: true })).toBeVisible();
    await expect(row.getByRole("link", { name: "Continuar" })).toBeVisible();
  });

  test("E: the documents list shows the associated client", async ({ page }) => {
    await page.goto("/dashboard/documents");
    const row = page.locator("tbody tr").filter({ hasText: draftTitle });
    await expect(row).toBeVisible();
    await expect(row.getByText(clientName)).toBeVisible();
  });

  test("F: the association can be removed from the composer", async ({
    page,
  }) => {
    await page.goto("/dashboard/documents");
    await page
      .locator("tbody tr")
      .filter({ hasText: draftTitle })
      .getByRole("link", { name: "Continuar" })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/]+/, {
      timeout: 15_000,
    });

    const clientSelect = page.getByLabel("Cliente principal (opcional)");
    await expect(clientSelect).toHaveValue(clientId);
    await clientSelect.selectOption("");
    await expect(page.getByText("Cambios sin guardar").first()).toBeVisible();

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByText("Borrador guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByLabel("Cliente principal (opcional)")).toHaveValue(
      "",
    );
    await expect(page.getByText("Cliente: Sin cliente")).toBeVisible();
  });

  test("G: create from Escrituras with an optional client selection", async ({
    page,
  }) => {
    const secondTitle = `${templateName} — Con cliente`;
    await page.goto("/dashboard/documents/new");
    await page
      .locator("li")
      .filter({ hasText: templateName })
      .getByRole("link", { name: "Usar este machote" })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/new\/[^/]+/, {
      timeout: 15_000,
    });

    // Sin cliente por defecto; se puede elegir uno.
    await expect(page.getByLabel("Cliente principal (opcional)")).toHaveValue(
      "",
    );
    await page.getByLabel("Título de la escritura").fill(secondTitle);
    await page
      .getByLabel("Cliente principal (opcional)")
      .selectOption({ label: clientName });
    await fillInlineField(page, "comprador.nombre", "Otro Cliente");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(
      page.getByText("Escritura guardada como borrador", { exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await registerCreatedViaUi(registry, "documents", "title", secondTitle);
    await expect(page.getByText(`Cliente: ${clientName}`)).toBeVisible();
  });
});
