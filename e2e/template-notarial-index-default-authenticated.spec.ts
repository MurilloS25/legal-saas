import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestTemplate,
  createTestTemplateField,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";

/**
 * Machote → Escritura → Índice: el default de Índice Notarial de un Machote
 * (`templates.include_in_notarial_index_by_default`) se toma como snapshot
 * al crear una Escritura desde él (`documents.include_in_notarial_index`).
 * Las Escrituras se crean aquí siempre vía la UI real de creación (no un
 * insert directo de factory), porque lo que se está probando es justamente
 * que `createDocumentDraftAction` copia ese valor — un insert de factory se
 * saltaría por completo la lógica bajo prueba. Mismo patrón que
 * `document-stepper-create-authenticated.spec.ts`.
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const registry = new CleanupRegistry();
const fieldKey = "parte.nombre";
const fieldLabel = "Parte";

const templateOnName = uniqueName("tnid", "machote-on");
const templateOffName = uniqueName("tnid", "machote-off");

let templateOnId = "";
let docFromOnId = "";
let docFromOffId = "";

function stepper(page: Page) {
  return page.getByRole("navigation", { name: "Pasos de la escritura" });
}

function notarialSection(page: Page) {
  return page.getByRole("region", { name: "Datos para índice" });
}

function templateIndexSection(page: Page) {
  return page.getByRole("region", { name: "Configuración del índice notarial" });
}

function documentRegion(page: Page) {
  return page.getByRole("region", { name: "Documento", exact: true });
}

async function fillFieldLive(page: Page, key: string, value: string) {
  await expect(async () => {
    await documentRegion(page)
      .locator(`[data-variable-key="${key}"]`)
      .first()
      .click();
    const input = documentRegion(page).locator(
      `input[data-variable-key="${key}"]`,
    );
    await input.fill(value);
    await input.blur();
    await expect(
      documentRegion(page).getByText(value).first(),
    ).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

/** Navega a la pantalla de creación de una Escritura desde un Machote, sin
 * guardar nada — para inspeccionar el stepper ANTES de que exista fila en
 * `documents` (regresión: mostraba el paso Índice temporalmente aquí,
 * hardcodeado a `true` en modo creación, sin importar el default real del
 * Machote — ver DocumentComposer.tsx). */
async function openCreatePage(page: Page, templateName: string): Promise<void> {
  await page.goto("/dashboard/documents/new");
  await page
    .locator("li")
    .filter({ hasText: templateName })
    .getByRole("link", { name: "Usar este machote" })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/documents\/new\/[^/]+$/, {
    timeout: 15_000,
  });
}

/** Crea una Escritura desde un machote vía la UI real y devuelve su id. */
async function createDocumentFromTemplate(
  page: Page,
  templateName: string,
  title: string,
  partyName: string,
): Promise<string> {
  await page.goto("/dashboard/documents/new");
  await page
    .locator("li")
    .filter({ hasText: templateName })
    .getByRole("link", { name: "Usar este machote" })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/documents\/new\/[^/]+$/, {
    timeout: 15_000,
  });

  await page.getByLabel("Título de la escritura").fill(title);
  await fillFieldLive(page, fieldKey, partyName);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/?]+/, {
    timeout: 30_000,
  });
  await registerCreatedViaUi(registry, "documents", "title", title);
  const documentId = new URL(page.url()).pathname.split("/").pop();
  if (!documentId) throw new Error("No se pudo determinar el id de la escritura creada.");
  return documentId;
}

test.describe("template notarial index default", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "tnid");
  });

  test("A: seed two templates (default true / default false)", async () => {
    const templateOn = await createTestTemplate(registry, {
      name: templateOnName,
      content: `ESCRITURA. Comparece {{${fieldKey}}}.`,
      includeInNotarialIndexByDefault: true,
    });
    templateOnId = templateOn.id;
    await createTestTemplateField(registry, templateOn.id, {
      field_key: fieldKey,
      label: fieldLabel,
      required: true,
    });

    const templateOff = await createTestTemplate(registry, {
      name: templateOffName,
      content: `CONSTANCIA. Comparece {{${fieldKey}}}.`,
      includeInNotarialIndexByDefault: false,
    });
    await createTestTemplateField(registry, templateOff.id, {
      field_key: fieldKey,
      label: fieldLabel,
      required: true,
    });
  });

  // Regresión encontrada en smoke manual de producción: en modo creación
  // (antes del primer guardado, la Escritura todavía no existe en DB) el
  // stepper mostraba SIEMPRE 4 pasos, sin importar el default real del
  // Machote — corregido a nivel de bug, no solo de test (ver
  // DocumentComposer.tsx: `includeInNotarialIndex` en modo "create" ahora
  // lee `template.include_in_notarial_index_by_default`, no `true` fijo).
  test("A2: the stepper reflects the Machote's default from the very first render, before any save exists", async ({
    page,
  }) => {
    await openCreatePage(page, templateOnName);
    await expect(stepper(page).getByRole("tab")).toHaveCount(4);
    await expect(
      stepper(page).getByRole("tab", { name: "Índice", exact: true }),
    ).toBeVisible();

    await openCreatePage(page, templateOffName);
    await expect(stepper(page).getByRole("tab")).toHaveCount(3);
    await expect(
      stepper(page).getByRole("tab", { name: "Índice", exact: true }),
    ).toHaveCount(0);
  });

  test("B: creating from a default=true template shows 4 steps (Índice included) after saving", async ({
    page,
  }) => {
    const title = uniqueName("tnid", "doc-on");
    docFromOnId = await createDocumentFromTemplate(
      page,
      templateOnName,
      title,
      "Persona Uno",
    );
    await expect(stepper(page).getByRole("tab")).toHaveCount(4);
    await expect(
      stepper(page).getByRole("tab", { name: "Índice", exact: true }),
    ).toBeVisible();
  });

  test("C: creating from a default=false template shows 3 steps (no Índice) after saving", async ({
    page,
  }) => {
    const title = uniqueName("tnid", "doc-off");
    docFromOffId = await createDocumentFromTemplate(
      page,
      templateOffName,
      title,
      "Persona Dos",
    );
    await expect(stepper(page).getByRole("tab")).toHaveCount(3);
    await expect(
      stepper(page).getByRole("tab", { name: "Índice", exact: true }),
    ).toHaveCount(0);
  });

  test("C2: Cobro's continue button reads 'Finalizar flujo' and returns to Revisar y finalizar when the document is excluded from the Índice (AUD-04)", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/${docFromOffId}?section=cobro`);
    const cobro = page.getByRole("region", { name: "Cuentas por cobrar de la escritura" });
    await expect(cobro).toBeVisible();
    const continueButton = cobro.getByRole("button", { name: "Finalizar flujo" });
    await expect(continueButton).toBeVisible();
    await continueButton.click();
    await expect(
      stepper(page).getByRole("tab", { name: "Revisar y finalizar", exact: true }),
    ).toHaveAttribute("aria-selected", "true", { timeout: 15_000 });
  });

  test("D: finalize dialog shows no checkbox, only static status text matching the current value", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/${docFromOnId}?section=revisar`);
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    const dialogOn = page.getByRole("alertdialog", { name: "Finalizar escritura" });
    await expect(dialogOn.getByRole("checkbox")).toHaveCount(0);
    await expect(
      dialogOn.getByText(/se incluirá en el Índice Notarial según su configuración actual/),
    ).toBeVisible();
    await dialogOn.getByRole("button", { name: "Finalizar escritura" }).click();
    // "lifecycle=finalized" es efímero (mismo patrón que "?saved=1" en
    // document-stepper-create): un efecto de montaje lo limpia apenas
    // dispara el toast, así que solo se afirma el destino final del
    // redirect ("Cobro", el siguiente paso del flujo guiado).
    await expect(page).toHaveURL(/section=cobro/, { timeout: 15_000 });
    // No pidió redundantemente la decisión: la Escritura sigue incluida sin
    // haber tenido que confirmarlo en el diálogo.
    await stepper(page).getByRole("tab", { name: "Índice", exact: true }).click();
    await expect(notarialSection(page)).toBeVisible();

    await page.goto(`/dashboard/documents/${docFromOffId}?section=revisar`);
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    const dialogOff = page.getByRole("alertdialog", { name: "Finalizar escritura" });
    await expect(dialogOff.getByRole("checkbox")).toHaveCount(0);
    await expect(
      dialogOff.getByText(/no se incluirá en el Índice Notarial según su configuración actual/),
    ).toBeVisible();
    await dialogOff.getByRole("button", { name: "Finalizar escritura" }).click();
    await expect(page).toHaveURL(/section=cobro/, { timeout: 15_000 });
  });

  test("E: excluded finalized document shows the compact card, not the detailed form", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/${docFromOffId}`);
    // El paso "Índice" ya no aparece en la navegación normal.
    await expect(
      stepper(page).getByRole("tab", { name: "Índice", exact: true }),
    ).toHaveCount(0);
    // Pero la ruta sigue siendo alcanzable por enlace directo.
    await page.goto(`/dashboard/documents/${docFromOffId}?section=notarial`);
    await expect(
      page.getByText("No pertenece al Índice Notarial", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Esta Escritura no está incluida en el Índice Notarial.", { exact: true }),
    ).toBeVisible();
    // Nunca se muestran los campos detallados ni acciones de confirmación.
    await expect(page.getByText("Número de instrumento")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Confirmar datos del Índice" }),
    ).toHaveCount(0);
  });

  test("F: including from the compact card restores the full section and the step reappears", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/${docFromOffId}?section=notarial`);
    await page.getByRole("button", { name: "Incluir en el Índice" }).click();
    await page
      .getByRole("alertdialog", { name: "¿Incluir esta Escritura en el Índice Notarial?" })
      .getByRole("button", { name: "Incluir" })
      .click();
    await expect(notarialSection(page)).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText("No pertenece al Índice Notarial"),
    ).toHaveCount(0);

    // El paso reaparece de inmediato en la navegación normal del stepper.
    await expect(
      stepper(page).getByRole("tab", { name: "Índice", exact: true }),
    ).toBeVisible();
    await expect(stepper(page).getByRole("tab")).toHaveCount(4);
  });

  test("G: excluding while standing on Índice navigates to a valid previous step", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/${docFromOffId}?section=notarial`);
    await expect(notarialSection(page)).toBeVisible();
    await notarialSection(page).getByLabel("Incluir en el Índice Notarial").click();
    await page
      .getByRole("alertdialog", { name: "¿Excluir esta Escritura del Índice Notarial?" })
      .getByRole("button", { name: "Excluir" })
      .click();

    // Ya no queda parado en un paso inexistente: navegó a "Cobro".
    await expect(
      page.getByRole("region", { name: "Cuentas por cobrar de la escritura" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      stepper(page).getByRole("tab", { name: "Índice", exact: true }),
    ).toHaveCount(0);
  });

  test("H: changing the template default later does not retroactively change existing documents", async ({
    page,
  }) => {
    await page.goto(`/dashboard/templates/${templateOnId}?section=notarial`);

    const templateSection = templateIndexSection(page);
    const toggle = templateSection.getByLabel("Incluir en Índice Notarial");
    await expect(toggle).toBeChecked();
    // Guardado único (iteración 4): el toggle ya no guarda al instante —
    // solo marca dirty, como cualquier otro cambio del machote — así que un
    // clic requiere el "Guardar" global para persistir.
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    // docFromOnId ya existía antes de este cambio — sigue incluida.
    await page.goto(`/dashboard/documents/${docFromOnId}`);
    await expect(stepper(page).getByRole("tab")).toHaveCount(4);
    await expect(
      stepper(page).getByRole("tab", { name: "Índice", exact: true }),
    ).toBeVisible();

    // Restaurar para no afectar otras corridas.
    await page.goto(`/dashboard/templates/${templateOnId}?section=notarial`);
    const restoreToggle = templateIndexSection(page).getByLabel(
      "Incluir en Índice Notarial",
    );
    await restoreToggle.click();
    await expect(restoreToggle).toBeChecked();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
