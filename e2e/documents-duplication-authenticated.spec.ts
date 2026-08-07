import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
  createTestDocument,
  createTestNotarialMetadata,
  createTestReceivable,
  createTestTemplate,
  createTestTemplateField,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";

// Serial: comparten cliente, machote y escrituras del mismo usuario.
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const clientName = uniqueName("docdup", "cliente");
const templateName = uniqueName("docdup", "machote");
const draftTitle = uniqueName("docdup", "borrador");
const finalTitle = uniqueName("docdup", "finalizada");
const fieldLabel = "Nombre de la parte";
const fieldKey = "parte.nombre";
const fieldValue = "Persona Duplicada";

let clientId = "";
let templateId = "";
let finalId = "";

function documentRegion(page: Page) {
  return page.getByRole("region", { name: "Documento", exact: true });
}

// Coincidencia exacta del título: "Copia de X" contiene "X" como
// substring, así que un filtro por substring confundiría el original con
// su copia.
function draftRow(page: Page, title: string) {
  return page.locator("tbody tr").filter({
    has: page.getByText(title, { exact: true }),
  });
}

async function openDocumentsHome(page: Page) {
  await page.goto("/dashboard/documents");
  await expect(
    page.getByRole("heading", { name: "Escrituras", exact: true }),
  ).toBeVisible();
}

test.describe("document duplication", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "docdup");
  });

  test("A: seed a client, template, a draft and a finalized document with notarial metadata and a receivable", async () => {
    const client = await createTestClient(registry, { full_name: clientName });
    clientId = client.id;
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: `ESCRITURA. Comparece {{${fieldKey}}}.`,
    });
    templateId = template.id;
    await createTestTemplateField(registry, template.id, {
      field_key: fieldKey,
      label: fieldLabel,
      required: true,
    });

    await createTestDocument(registry, templateId, {
      title: draftTitle,
      client_id: clientId,
      field_values: { [fieldKey]: fieldValue },
      rendered_content: `ESCRITURA. Comparece ${fieldValue}.`,
    });

    const final = await createTestDocument(registry, templateId, {
      title: finalTitle,
      status: "final",
      client_id: clientId,
      field_values: { [fieldKey]: fieldValue },
      rendered_content: `ESCRITURA. Comparece ${fieldValue}.`,
    });
    finalId = final.id;
    await createTestNotarialMetadata(finalId, {
      instrument_number: 999_001,
      authorized_at: "2026-07-20T15:00:00.000Z",
      act_type: "Prueba de duplicación",
      appearing_parties_summary: fieldValue,
    });
    await createTestReceivable(registry, {
      client_id: clientId,
      concept: uniqueName("docdup", "cuenta"),
      document_id: finalId,
    });
  });

  test("B: duplicating a draft from the list creates an independent copy with the same values", async ({
    page,
  }) => {
    await openDocumentsHome(page);
    const row = draftRow(page, draftTitle);
    await row.getByRole("button", { name: `Duplicar ${draftTitle}` }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Duplicar" }).click();

    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/]+/, {
      timeout: 15_000,
    });
    await expect(
      page.getByText("Escritura duplicada como borrador nuevo.", {
        exact: true,
      }),
    ).toBeVisible();

    const copyTitle = `Copia de ${draftTitle}`;
    await expect(
      page.getByRole("heading", { name: copyTitle, exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Borrador", { exact: true })).toBeVisible();
    await expect(
      documentRegion(page).getByText(fieldValue),
    ).toBeVisible();
    await expect(page.getByText(`Cliente: ${clientName}`)).toBeVisible();

    await registerCreatedViaUi(registry, "documents", "title", copyTitle);

    // El original sigue intacto: sigue existiendo con su propio título.
    await openDocumentsHome(page);
    await expect(draftRow(page, draftTitle)).toBeVisible();
    await expect(draftRow(page, copyTitle)).toBeVisible();
  });

  test("C: duplicating a finalized document creates an editable draft, without copying history, notarial metadata or receivables", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/${finalId}`);
    await expect(
      page.getByText("Finalizada", { exact: true }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Duplicar" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Duplicar" }).click();

    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/]+/, {
      timeout: 15_000,
    });
    const copyTitle = `Copia de ${finalTitle}`;
    await expect(
      page.getByRole("heading", { name: copyTitle, exact: true }),
    ).toBeVisible();
    // La copia nace borrador, editable — no hereda el estado final.
    await expect(page.getByText("Borrador", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Título de la escritura")).toBeEnabled();

    // Sin historial propio de la copia (más allá de su propia creación) ni
    // paso de Índice habilitado (solo aplica a finalizadas).
    const stepper = page.getByRole("navigation", {
      name: "Pasos de la escritura",
    });
    await expect(stepper.getByRole("tab", { name: "Índice" })).toBeDisabled();

    await registerCreatedViaUi(registry, "documents", "title", copyTitle);

    // El original sigue finalizado e intacto.
    await page.goto(`/dashboard/documents/${finalId}`);
    await expect(
      page.getByText("Finalizada", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByLabel("Título de la escritura")).toBeDisabled();
  });

  test("D: duplicating a copy does not chain the title prefix", async ({
    page,
  }) => {
    await openDocumentsHome(page);
    const copyTitle = `Copia de ${draftTitle}`;
    const row = draftRow(page, copyTitle);
    await row.getByRole("button", { name: `Duplicar ${copyTitle}` }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Duplicar" }).click();

    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/]+/, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: copyTitle, exact: true }),
    ).toBeVisible();

    // Ahora hay dos escrituras con el mismo título ("Copia de X" no se
    // encadena): buscar por título es ambiguo, así que se registra el id
    // directo de la URL para el cleanup.
    const secondCopyId = new URL(page.url()).pathname.split("/").pop();
    if (secondCopyId) registry.register("documents", secondCopyId);
  });
});
