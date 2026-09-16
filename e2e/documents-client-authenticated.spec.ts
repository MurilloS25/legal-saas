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

// El <select> de Cliente principal vive dentro de su popover
// (DocumentContextBar) — hay que abrirlo antes de leerlo/usarlo.
// Idempotente: no reabre si ya está visible.
async function openClientPrincipalPopover(page: Page) {
  const select = page.getByLabel("Cliente principal", { exact: true });
  if (await select.isVisible().catch(() => false)) return;
  await page.getByRole("button", { name: /^Cliente principal/ }).click();
  await expect(select).toBeVisible();
}

// Cierra el popover con el mismo trigger (toggle), en vez de Escape: Escape
// depende de qué elemento tiene el foco (ej. tras un `selectOption`, el foco
// no queda garantizado dentro del panel), mientras que el trigger siempre
// cierra sin importar el foco actual.
async function closeClientPrincipalPopover(page: Page) {
  await page.getByRole("button", { name: /^Cliente principal/ }).click();
  await expect(
    page.getByRole("dialog", { name: /Cliente principal/ }),
  ).toBeHidden();
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
    await page.goto(`/clients/${clientId}`);
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
    await page.goto(`/clients/${clientId}`);
    await page.getByRole("link", { name: "Nueva escritura" }).click();

    // El picker conserva el cliente y lo muestra.
    await expect(page).toHaveURL(/\/documents\/new\?client=/, {
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
    await expect(page).toHaveURL(/\/documents\/new\/[^/]+\?client=/, {
      timeout: 15_000,
    });

    // El compositor tiene el cliente preseleccionado.
    await openClientPrincipalPopover(page);
    await expect(page.getByLabel("Cliente principal", { exact: true })).toHaveValue(
      clientId,
    );
    // Cierra el popover explícitamente antes de interactuar con la hoja
    // documental, en vez de depender del cierre implícito por clic afuera
    // justo en el mismo gesto que activa la edición inline.
    await closeClientPrincipalPopover(page);

    await fillInlineField(page, "comprador.nombre", "Cliente Prueba");
    await page.getByRole("button", { name: "Crear escritura" }).click();

    await expect(page).toHaveURL(/\/documents\/(?!new)[^/]+/, {
      timeout: 30_000,
    });
    await expect(
      page.getByRole("status").getByText("Escritura guardada.", { exact: true }),
    ).toBeVisible();
    await registerCreatedViaUi(registry, "documents", "title", draftTitle);

    // El detalle de la escritura muestra el cliente asociado.
    await expect(page.getByText(`Cliente: ${clientName}`)).toBeVisible();
  });

  test("D: the associated escritura appears in the client detail", async ({
    page,
  }) => {
    await page.goto(`/clients/${clientId}`);
    const row = page.locator("tbody tr").filter({ hasText: draftTitle });
    await expect(row).toBeVisible();
    await expect(row.getByText("Borrador", { exact: true })).toBeVisible();
    await expect(row.getByRole("link", { name: "Continuar" })).toBeVisible();
  });

  test("E: the documents list shows the associated client", async ({ page }) => {
    await page.goto("/documents");
    const row = page.locator("tbody tr").filter({ hasText: draftTitle });
    await expect(row).toBeVisible();
    await expect(row.getByText(clientName)).toBeVisible();
  });

  test("F: the association can be removed from the composer", async ({
    page,
  }) => {
    await page.goto("/documents");
    await page
      .locator("tbody tr")
      .filter({ hasText: draftTitle })
      .getByRole("link", { name: "Continuar" })
      .click();
    await expect(page).toHaveURL(/\/documents\/(?!new)[^/]+/, {
      timeout: 15_000,
    });

    await openClientPrincipalPopover(page);
    const clientSelect = page.getByLabel("Cliente principal", { exact: true });
    await expect(clientSelect).toHaveValue(clientId);
    await clientSelect.selectOption("");
    await expect(page.getByText("Cambios sin guardar").first()).toBeVisible();

    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page.getByRole("status").getByText("Escritura guardada."),
    ).toBeVisible({ timeout: 15_000 });

    // Guardar no navega de paso — el chip de "Cliente principal" vive en
    // "Completar", así que confirmamos ahí explícitamente tras recargar.
    await page.reload();
    await page.getByRole("tab", { name: "Completar", exact: true }).click();
    await openClientPrincipalPopover(page);
    await expect(page.getByLabel("Cliente principal", { exact: true })).toHaveValue(
      "",
    );
    await expect(page.getByText("Cliente: Sin cliente")).toBeVisible();
  });

  test("G: create from Escrituras with an optional client selection", async ({
    page,
  }) => {
    const secondTitle = `${templateName} — Con cliente`;
    await page.goto("/documents/new");
    await page
      .locator("li")
      .filter({ hasText: templateName })
      .getByRole("link", { name: "Usar este machote" })
      .click();
    await expect(page).toHaveURL(/\/documents\/new\/[^/]+/, {
      timeout: 15_000,
    });

    // Sin cliente por defecto; se puede elegir uno.
    await openClientPrincipalPopover(page);
    await expect(page.getByLabel("Cliente principal", { exact: true })).toHaveValue(
      "",
    );
    await page.getByLabel("Título de la escritura").fill(secondTitle);
    await page
      .getByLabel("Cliente principal", { exact: true })
      .selectOption({ label: clientName });
    // Cierra el popover explícitamente antes de interactuar con la hoja
    // documental (ver nota en el test C).
    await closeClientPrincipalPopover(page);
    await fillInlineField(page, "comprador.nombre", "Otro Cliente");
    await page.getByRole("button", { name: "Crear escritura" }).click();

    await expect(
      page.getByRole("status").getByText("Escritura guardada.", { exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await registerCreatedViaUi(registry, "documents", "title", secondTitle);
    await expect(page.getByText(`Cliente: ${clientName}`)).toBeVisible();
  });
});
