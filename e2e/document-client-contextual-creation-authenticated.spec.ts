import { test, expect, type Page } from "@playwright/test";
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

// El "+ Crear nuevo cliente" del Cliente principal vive dentro de su
// popover (DocumentContextBar) — hay que abrirlo antes de que el botón
// exista en el DOM. Idempotente: no reabre si ya está visible.
async function openClientPrincipalPopover(page: Page) {
  const select = page.getByLabel("Cliente principal", { exact: true });
  if (await select.isVisible().catch(() => false)) return;
  await page.getByRole("button", { name: /^Cliente principal/ }).click();
  await expect(select).toBeVisible();
}

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

    await openClientPrincipalPopover(page);
    await expect(
      page.getByRole("button", { name: "+ Crear nuevo cliente" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Crear escritura" }),
    ).toBeVisible();
  });

  test("C: cancelling the dialog preserves the rest of the form and creates nothing", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);

    const title = uniqueName("doc-client-dialog", "titulo-cancelado");
    await page.getByLabel("Título de la escritura").fill(title);

    await openClientPrincipalPopover(page);
    await page.getByRole("button", { name: "+ Crear nuevo cliente" }).click();
    const dialog = page.getByRole("dialog", { name: "Crear nuevo cliente" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Nombre completo").fill("No debería crearse");

    await dialog.getByRole("button", { name: "Cancelar" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByLabel("Título de la escritura")).toHaveValue(title);
    await expect(
      page.getByLabel("Cliente principal", { exact: true }),
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

    await openClientPrincipalPopover(page);
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

    await openClientPrincipalPopover(page);
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
      page.getByLabel("Cliente principal", { exact: true }),
    ).toHaveValue("");
  });

  test("F: creating a client selects it immediately and preserves the rest of the composer", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);

    const title = uniqueName("doc-client-dialog", "titulo-creado");
    await page.getByLabel("Título de la escritura").fill(title);

    const clientName = uniqueName("doc-client-dialog", "cliente");
    await openClientPrincipalPopover(page);
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
    // El popover de Cliente principal permanece abierto (solo el diálogo
    // anidado se cierra), así que el <select> sigue visible sin reabrirlo.
    await expect(
      page.getByLabel("Cliente principal", { exact: true }),
    ).toHaveValue(await getOptionValueByLabel(page, clientName));
    // El resto del formulario nunca se remontó.
    await expect(page.getByLabel("Título de la escritura")).toHaveValue(title);

    await registerCreatedViaUi(registry, "clients", "full_name", clientName);

    // Guarda y confirma que la asociación persiste tras recargar.
    await page.getByRole("button", { name: "Crear escritura" }).click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/[0-9a-f-]{36}/, {
      timeout: 15_000,
    });
    const documentId = page.url().match(/documents\/([0-9a-f-]{36})/)![1];
    await registerCreatedViaUi(registry, "documents", "title", title);

    // El chip de "Cliente principal" vive en "Completar" (ya el paso por
    // defecto tras el primer guardado, pero explícito tras el reload).
    await page.reload();
    await page.getByRole("tab", { name: "Completar", exact: true }).click();
    await openClientPrincipalPopover(page);
    await expect(
      page.getByLabel("Cliente principal", { exact: true }),
    ).toHaveValue(await getOptionValueByLabel(page, clientName));

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
  page: Page,
  label: string,
): Promise<string> {
  const select = page.getByLabel("Cliente principal", { exact: true });
  const option = select.locator("option", { hasText: label });
  return (await option.getAttribute("value"))!;
}
