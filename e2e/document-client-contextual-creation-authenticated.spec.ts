import { test, expect } from "@playwright/test";
import {
  CleanupRegistry,
  createTestDocument,
  createTestTemplate,
  registerCreatedViaUi,
  runCleanup,
  setTestDocumentStatus,
  uniqueName,
} from "./support/factories";

// Tests share the same template/seed data and interact with the same
// dialog; serial mode avoids races.
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const templateName = uniqueName("doc-client-dialog", "machote");
let templateId = "";

test.describe("create a client from the document workspace", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "document-client-contextual-creation");
  });

  test("A: seed a template with no variables", async () => {
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "ESCRITURA de prueba sin variables.",
    });
    templateId = template.id;
  });

  test("B: the dialog is reachable next to the client selector and does not compete with the main action", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);

    await expect(
      page.getByRole("button", { name: "+ Crear nuevo cliente" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Guardar cambios" }),
    ).toBeVisible();
  });

  test("C: cancelling the dialog preserves the rest of the form and creates nothing", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);

    const title = uniqueName("doc-client-dialog", "titulo-cancelado");
    await page.getByLabel("Título de la escritura").fill(title);

    await page.getByRole("button", { name: "+ Crear nuevo cliente" }).click();
    const dialog = page.getByRole("dialog", { name: "Crear nuevo cliente" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Nombre completo").fill("No debería crearse");

    await dialog.getByRole("button", { name: "Cancelar" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByLabel("Título de la escritura")).toHaveValue(title);
    await expect(
      page.getByLabel("Cliente principal (opcional)"),
    ).toHaveValue("");
    // Devuelve el foco al disparador tras cerrar.
    await expect(
      page.getByRole("button", { name: "+ Crear nuevo cliente" }),
    ).toBeFocused();
  });

  test("D: Escape also closes the dialog without side effects", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);

    await page.getByRole("button", { name: "+ Crear nuevo cliente" }).click();
    const dialog = page.getByRole("dialog", { name: "Crear nuevo cliente" });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("E: an invalid submission keeps the dialog open with the typed values and does not select anything", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);

    await page.getByRole("button", { name: "+ Crear nuevo cliente" }).click();
    const dialog = page.getByRole("dialog", { name: "Crear nuevo cliente" });

    // full_name vacío es inválido — el resto de los campos sí se llenan
    // para confirmar que se conservan tras el intento fallido.
    await dialog.getByLabel("Número de cédula").fill("9-9999-9999");
    await dialog.getByRole("button", { name: "Crear cliente" }).click();

    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Número de cédula")).toHaveValue(
      "9-9999-9999",
    );
    await expect(
      page.getByLabel("Cliente principal (opcional)"),
    ).toHaveValue("");
  });

  test("F: creating a client selects it immediately and preserves the rest of the composer", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);

    const title = uniqueName("doc-client-dialog", "titulo-creado");
    await page.getByLabel("Título de la escritura").fill(title);

    const clientName = uniqueName("doc-client-dialog", "cliente");
    await page.getByRole("button", { name: "+ Crear nuevo cliente" }).click();
    const dialog = page.getByRole("dialog", { name: "Crear nuevo cliente" });
    await dialog.getByLabel("Nombre completo").fill(clientName);
    await dialog.getByLabel("Número de cédula").fill("1-1111-1111");
    await dialog.getByLabel("Estado civil").selectOption("soltero");
    await dialog.getByLabel("Nacionalidad").fill("Costarricense");
    await dialog.getByLabel("Ocupación").fill("Abogado");
    await dialog.getByLabel("Dirección exacta").fill("San José, Costa Rica");
    await dialog.getByRole("button", { name: "Crear cliente" }).click();

    await expect(dialog).toHaveCount(0, { timeout: 15_000 });
    await expect(
      page.getByLabel("Cliente principal (opcional)"),
    ).toHaveValue(await getOptionValueByLabel(page, clientName));
    // El resto del formulario nunca se remontó.
    await expect(page.getByLabel("Título de la escritura")).toHaveValue(title);

    await registerCreatedViaUi(registry, "clients", "full_name", clientName);

    // Guarda y confirma que la asociación persiste tras recargar.
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/[0-9a-f-]{36}/, {
      timeout: 15_000,
    });
    const documentId = page.url().match(/documents\/([0-9a-f-]{36})/)![1];
    await registerCreatedViaUi(registry, "documents", "title", title);

    await page.reload();
    await expect(page.getByLabel("Cliente principal (opcional)")).toHaveValue(
      await getOptionValueByLabel(page, clientName),
    );

    await setTestDocumentStatus(documentId!, "final");
  });

  test("G: the action is not shown once the document is finalized (read-only)", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("doc-client-dialog", "machote-final"),
      content: "ESCRITURA final de prueba.",
    });
    const doc = await createTestDocument(registry, template.id, {
      title: uniqueName("doc-client-dialog", "escritura-final"),
      rendered_content: "ESCRITURA final de prueba.",
      status: "final",
    });

    await page.goto(`/dashboard/documents/${doc.id}`);

    await expect(
      page.getByRole("button", { name: "+ Crear nuevo cliente" }),
    ).toHaveCount(0);
  });
});

async function getOptionValueByLabel(
  page: import("@playwright/test").Page,
  label: string,
): Promise<string> {
  const select = page.getByLabel("Cliente principal (opcional)");
  const option = select.locator("option", { hasText: label });
  return (await option.getAttribute("value"))!;
}
