import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestDocument,
  createTestTemplate,
  createTestTemplateField,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
  updateTestTemplateContent,
} from "./support/factories";

// Tests share the same user account, template and draft. Serial mode keeps
// the workflow consistent between tests.
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

// Module-level state shared between serial tests.
const templateName = uniqueName("documents", "machote");
const draftTitle = `${templateName} — Borrador`;
let editedDraftTitle = "";
let draftPath = "";

const fieldLabel = "Comprador 1 - Nombre completo";
const fieldKey = "buyer_1.full_name";
const derivedKey = "vehicle.plate";
const filledValue = "Cliente de Prueba Uno";
const editedValue = "Cliente Editado 007 (cero inicial: 012)";

async function openDocumentsHome(page: Page) {
  await page.goto("/documents");
  await expect(
    page.getByRole("heading", { name: "Escrituras", exact: true }),
  ).toBeVisible();
}

function draftRow(page: Page, title: string) {
  return page.locator("tbody tr").filter({ hasText: title });
}

/** Hoja documental del compositor. */
function documentRegion(page: Page) {
  return page.getByRole("region", { name: "Documento", exact: true });
}

/**
 * Panel de datos (paso Completar). Se usa para desambiguar el texto de
 * progreso, que también aparece (con punto final) en el resumen de solo
 * lectura del paso Finalizar cuando la escritura ya está persistida.
 */
function dataPanel(page: Page) {
  return page.getByRole("region", { name: "Datos de la Escritura" });
}

/**
 * Valor crudo persistido para una variable: el input oculto que el
 * formulario envía en el submit, única fuente de verdad ya que el panel de
 * datos ya no lista los campos uno a uno.
 */
function fieldValue(page: Page, key: string) {
  return page.locator(`input[name="${key}"]`);
}

/**
 * Llena una variable directamente en la hoja documental (edición inline) y
 * espera a que el valor se refleje en vivo. El bloque se reintenta completo:
 * si el primer clic/fill ocurre antes de la hidratación de React, el
 * siguiente intento lo corrige.
 */
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

test.describe("document composer workspace", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "documents");
  });

  test("A: seed a template with one field via factories", async ({ page }) => {
    const template = await createTestTemplate(registry, {
      name: templateName,
      content:
        "ESCRITURA DE PRUEBA. Comparece {{buyer_1.full_name}}, placa {{vehicle.plate}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: fieldKey,
      label: fieldLabel,
      required: true,
    });

    // Sanity check: the seeded template is visible in the picker.
    await page.goto("/documents/new");
    await expect(
      page.locator("li").filter({ hasText: templateName }),
    ).toBeVisible();
  });

  test("B: documents home offers the new-document action", async ({ page }) => {
    await openDocumentsHome(page);

    await expect(
      page
        .getByRole("link", { name: /Nueva escritura|Crear primera escritura/ })
        .first(),
    ).toBeVisible();
  });

  test("C: the composer creates a draft with live document updates", async ({
    page,
  }) => {
    await openDocumentsHome(page);

    await page
      .getByRole("link", { name: /Nueva escritura|Crear primera escritura/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/documents\/new$/, {
      timeout: 15_000,
    });

    // Pick the template created in test A.
    await page
      .locator("li")
      .filter({ hasText: templateName })
      .getByRole("link", { name: "Usar este machote" })
      .click();
    await expect(page).toHaveURL(/\/documents\/new\/[^/]+$/, {
      timeout: 15_000,
    });

    // El compositor: documento como zona principal + panel de datos.
    await expect(documentRegion(page)).toBeVisible();
    await expect(page.getByLabel("Título de la escritura")).toBeVisible();

    // The title is pre-generated from the template name.
    await expect(page.getByLabel("Título de la escritura")).toHaveValue(
      draftTitle,
    );

    // La variable pendiente aparece en la hoja como placeholder.
    await expect(
      documentRegion(page).getByText(`{{${fieldKey}}}`).first(),
    ).toBeVisible();

    // Al escribir, el documento se actualiza ANTES de guardar.
    await fillFieldLive(page, fieldKey, filledValue);
    await expect(page.getByText("Cambios sin guardar").first()).toBeVisible();

    // Progreso sobre los campos (configurado + derivado del contenido).
    await expect(
      dataPanel(page).getByText("1 de 2 campos completos", { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Crear escritura" }).click();

    // Saving redirects to the edit view with a confirmation.
    await expect(page).toHaveURL(/\/documents\/(?!new)[^/]+/, {
      timeout: 30_000,
    });
    draftPath = new URL(page.url()).pathname;
    await expect(
      page.getByRole("status").getByText("Escritura guardada.", { exact: true }),
    ).toBeVisible();

    // Register the persisted draft for cleanup (its id survives edits).
    await registerCreatedViaUi(registry, "documents", "title", draftTitle);

    // El primer guardado ("Crear escritura") aterriza en "Completar" (el
    // paso por defecto) — la hoja documental ya está ahí; el clic es
    // redundante pero inofensivo.
    await page.getByRole("tab", { name: "Completar", exact: true }).click();
    await expect(
      documentRegion(page).getByText(new RegExp(filledValue)),
    ).toBeVisible();
    // The undefined variable stays visible as a placeholder.
    await expect(
      documentRegion(page).getByText(`{{${derivedKey}}}`).first(),
    ).toBeVisible();
  });

  test("C2: persisted workspace uses a stable stepper and accessible history", async ({
    page,
  }) => {
    await page.goto(draftPath);
    const stepper = page.getByRole("navigation", {
      name: "Pasos de la escritura",
    });
    await expect(
      stepper.getByRole("tab", { name: "Completar" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(stepper.getByRole("tab", { name: "Cobro" })).toBeVisible();
    await expect(stepper.getByRole("tab", { name: "Índice" })).toBeDisabled();
    await expect(
      page.getByRole("region", { name: "Cuentas por cobrar de la escritura" }),
    ).toHaveCount(0);

    // El stepper es cliente-puro (pushState): cambiar de paso nunca navega
    // realmente, así que atrás/adelante del navegador debe seguir
    // funcionando (popstate) sin perder el compositor.
    await stepper.getByRole("tab", { name: "Cobro" }).click();
    await expect(page).toHaveURL(/section=cobro/);
    await expect(
      page.getByRole("region", { name: "Cuentas por cobrar de la escritura" }),
    ).toBeVisible();
    await page.goBack();
    await expect(
      stepper.getByRole("tab", { name: "Completar" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Título de la escritura")).toBeVisible();

    const historyTrigger = page.getByRole("button", { name: "Historial" });
    await historyTrigger.click();
    const historyDialog = page.getByRole("dialog", {
      name: "Historial de la escritura",
    });
    await expect(historyDialog).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(historyDialog.locator(":focus")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(historyDialog).toBeHidden();
    await expect(historyTrigger).toBeFocused();
  });

  test("D: the saved draft appears in the documents list", async ({ page }) => {
    await openDocumentsHome(page);

    const row = draftRow(page, draftTitle);
    await expect(row).toBeVisible();
    await expect(row.getByText("Borrador", { exact: true })).toBeVisible();
    await expect(row.getByRole("link", { name: "Continuar" })).toBeVisible();
  });

  test("E: editing updates the document live and persists on save", async ({
    page,
  }) => {
    await openDocumentsHome(page);
    await draftRow(page, draftTitle)
      .getByRole("link", { name: "Continuar" })
      .click();
    await expect(page).toHaveURL(/\/documents\/(?!new)[^/]+/, {
      timeout: 15_000,
    });

    // Existing values are loaded, mirrored in the hidden form input.
    await expect(fieldValue(page, fieldKey)).toHaveValue(filledValue);

    await fillFieldLive(page, fieldKey, editedValue);
    // El snapshot persistido no cambia hasta guardar.
    await expect(page.getByText("Cambios sin guardar").first()).toBeVisible();

    editedDraftTitle = `${templateName} — Editado`;
    await page.getByLabel("Título de la escritura").fill(editedDraftTitle);

    // Completa también la variable derivada del contenido.
    await fillFieldLive(page, derivedKey, "ABC-123");
    await expect(
      dataPanel(page).getByText("2 de 2 campos completos", { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Guardar" }).click();

    await expect(
      page.getByRole("status").getByText("Escritura guardada."),
    ).toBeVisible({ timeout: 15_000 });
    draftPath = new URL(page.url()).pathname;

    // El guardado deja al usuario en "Completar" (el paso por defecto);
    // el clic solo confirma la hoja documental está ahí.
    await page.getByRole("tab", { name: "Completar", exact: true }).click();
    await expect(
      documentRegion(page).getByText(/Cliente Editado 007 \(cero inicial: 012\)/),
    ).toBeVisible();
  });

  test("F: edited draft persists after reload", async ({ page }) => {
    await openDocumentsHome(page);

    const row = draftRow(page, editedDraftTitle);
    await expect(row).toBeVisible();

    await row.getByRole("link", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/\/documents\/(?!new)[^/]+/, {
      timeout: 15_000,
    });
    await page.reload();

    await expect(page.getByLabel("Título de la escritura")).toHaveValue(
      editedDraftTitle,
    );
    await expect(fieldValue(page, fieldKey)).toHaveValue(editedValue);
    await expect(
      documentRegion(page).getByText(/Cliente Editado 007 \(cero inicial: 012\)/),
    ).toBeVisible();
  });

  test("G: an empty required field blocks saving", async ({ page }) => {
    await page.goto(draftPath);

    await expect(fieldValue(page, fieldKey)).toHaveValue(editedValue, {
      timeout: 15_000,
    });

    // El comportamiento de placeholders ya está cubierto arriba; aquí el
    // contrato crítico es que un campo requerido vacío bloquea el guardado.
    await expect(async () => {
      await documentRegion(page)
        .locator(`[data-variable-key="${fieldKey}"]`)
        .first()
        .click();
      const input = documentRegion(page).locator(
        `input[data-variable-key="${fieldKey}"]`,
      );
      await input.fill("");
      await input.blur();
      await expect(fieldValue(page, fieldKey)).toHaveValue("", { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });

    await page.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByText(`${fieldLabel} es requerido`)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("H: a nonexistent document returns the not-found page", async ({
    page,
  }) => {
    // El "404" grande y el badge "Ruta 404" son decorativos (aria-hidden);
    // lo que importa es el status HTTP y el encabezado accesible, igual
    // que en not-found-authenticated.spec.ts.
    const response = await page.goto("/documents/00000000-0000-0000-0000-000000000000");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: "Página no encontrada" }),
    ).toBeVisible();
  });

  test("N: a draft template is excluded from the create-document picker, and its direct URL is blocked", async ({
    page,
  }) => {
    const draftName = uniqueName("documents", "machote-borrador");
    const draftTemplate = await createTestTemplate(registry, {
      name: draftName,
      content: "ACTA. Comparece {{persona.nombre}}.",
      status: "draft",
    });

    await page.goto("/documents/new");
    await expect(page.locator("li").filter({ hasText: draftName })).toHaveCount(0);

    // Bypassing the picker via a direct URL is also blocked (defense in
    // depth: the restriction isn't just a UI filter).
    await page.goto(`/documents/new/${draftTemplate.id}`);
    await expect(
      page.getByText("Este machote no está activo"),
    ).toBeVisible();
    await expect(
      page.getByLabel("Título de la escritura"),
    ).toHaveCount(0);
  });

  test("O: the template detail page hides 'Crear escritura' for a non-active template", async ({
    page,
  }) => {
    const draftName = uniqueName("documents", "machote-detalle-borrador");
    const draftTemplate = await createTestTemplate(registry, {
      name: draftName,
      content: "ACTA. Comparece {{persona.nombre}}.",
      status: "draft",
    });

    await page.goto(`/templates/${draftTemplate.id}`);
    await expect(
      page.getByRole("link", { name: "Crear escritura" }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Activa este machote para crear escrituras"),
    ).toBeVisible();
  });

  test("J: regression — a template without configured fields still creates a draft", async ({
    page,
  }) => {
    // Antes de la corrección, esta pantalla bloqueaba con "Este machote no
    // tiene campos definidos" y el usuario no podía crear la escritura.
    const bareTemplateName = uniqueName("documents", "sin-campos");
    const bareDraftTitle = `${bareTemplateName} — Borrador`;
    const bareTemplate = await createTestTemplate(registry, {
      name: bareTemplateName,
      content: "PODER ESPECIAL. Otorgado por {{poderdante.nombre}} en {{lugar}}.",
    });

    await page.goto(`/documents/new/${bareTemplate.id}`);

    await expect(
      page.getByText(/no tiene campos definidos/),
    ).not.toBeVisible();
    await fillFieldLive(page, "poderdante.nombre", "Poderdante de Prueba");

    await page.getByRole("button", { name: "Crear escritura" }).click();

    await expect(page).toHaveURL(/\/documents\/(?!new)[^/]+/, {
      timeout: 30_000,
    });
    await expect(
      page.getByRole("status").getByText("Escritura guardada.", { exact: true }),
    ).toBeVisible();
    await registerCreatedViaUi(registry, "documents", "title", bareDraftTitle);

    // El primer guardado aterriza en "Completar" (el paso por defecto) —
    // la hoja documental ya está ahí.
    await page.getByRole("tab", { name: "Completar", exact: true }).click();
    await expect(
      documentRegion(page).getByText(/Poderdante de Prueba/),
    ).toBeVisible();
    // La variable sin valor sigue visible como placeholder.
    await expect(
      documentRegion(page).getByText("{{lugar}}").first(),
    ).toBeVisible();
  });

  test("K: a structured template shows bold, italic and underline in the sheet", async ({
    page,
  }) => {
    const structuredName = uniqueName("documents", "estructurado");
    const structuredTitle = `${structuredName} — Borrador`;
    const structuredTemplate = await createTestTemplate(registry, {
      name: structuredName,
      content: "PODER GENERAL. Otorgado en San José por {{otorgante.nombre}}.",
      doc: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "PODER GENERAL. ",
                marks: [{ type: "bold" }],
              },
              {
                type: "text",
                text: "Otorgado en ",
                marks: [{ type: "italic" }],
              },
              {
                type: "text",
                text: "San José",
                marks: [{ type: "underline" }],
              },
              { type: "text", text: " por " },
              {
                type: "templateVariable",
                attrs: {
                  key: "otorgante.nombre",
                  label: "Nombre del otorgante",
                },
              },
              { type: "text", text: "." },
            ],
          },
        ],
      },
    });

    await page.goto(`/documents/new/${structuredTemplate.id}`);

    const sheet = documentRegion(page);
    await expect(
      sheet.locator("strong", { hasText: "PODER GENERAL." }),
    ).toBeVisible();
    await expect(sheet.locator("em", { hasText: "Otorgado en" })).toBeVisible();
    await expect(sheet.locator("u", { hasText: "San José" })).toBeVisible();

    await fillFieldLive(page, "otorgante.nombre", "Otorgante Estructurado");
    await page.getByRole("button", { name: "Crear escritura" }).click();
    await expect(
      page.getByRole("status").getByText("Escritura guardada.", { exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await registerCreatedViaUi(registry, "documents", "title", structuredTitle);

    // El primer guardado aterriza en "Completar" (el paso por defecto) —
    // la hoja documental ya está ahí.
    await page.getByRole("tab", { name: "Completar", exact: true }).click();
    await expect(
      documentRegion(page).getByText(/Otorgante Estructurado/),
    ).toBeVisible();
  });

  test("L: historical values survive when the template loses a variable", async ({
    page,
  }) => {
    const historyName = uniqueName("documents", "historicos");
    const historyTemplate = await createTestTemplate(registry, {
      name: historyName,
      content: "Acta con {{dato.uno}} y {{dato.dos}}.",
    });
    const historyDraft = await createTestDocument(registry, historyTemplate.id, {
      title: `${historyName} — Borrador`,
      field_values: { "dato.uno": "Valor Uno", "dato.dos": "Valor Dos" },
      rendered_content: "Acta con Valor Uno y Valor Dos.",
    });

    // El machote pierde la variable dato.dos después de guardar el borrador.
    // La Escritura conserva su snapshot histórico, así que el campo y su
    // valor siguen perteneciendo a esta versión documental.
    await updateTestTemplateContent(
      historyTemplate.id,
      "Acta con {{dato.uno}}.",
    );

    await page.goto(`/documents/${historyDraft.id}`);
    await expect(fieldValue(page, "dato.dos")).toHaveValue("Valor Dos");

    // Guardar con un cambio no borra el valor histórico.
    await fillFieldLive(page, "dato.uno", "Valor Uno B");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page.getByRole("status").getByText("Escritura guardada."),
    ).toBeVisible({ timeout: 15_000 });

    // Cambios posteriores al Machote tampoco alteran el snapshot existente.
    await updateTestTemplateContent(
      historyTemplate.id,
      "Acta con {{dato.uno}} y {{dato.dos}}.",
    );
    await page.goto(`/documents/${historyDraft.id}`);
    await expect(fieldValue(page, "dato.dos")).toHaveValue("Valor Dos");
  });

  test("M: mobile viewport switches between data and document", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(draftPath);

    // En móvil solo se muestra una zona a la vez; Datos es la inicial.
    await expect(page.getByLabel("Título de la escritura")).toBeVisible();
    await expect(documentRegion(page)).not.toBeVisible();

    await page.getByRole("button", { name: "Documento", exact: true }).click();
    await expect(documentRegion(page)).toBeVisible();
    await expect(page.getByLabel("Título de la escritura")).not.toBeVisible();

    // exact: "Datos" es substring de "Guardar datos del índice" (sección notarial).
    await page.getByRole("button", { name: "Datos", exact: true }).click();
    await expect(page.getByLabel("Título de la escritura")).toBeVisible();
  });

  test("I: user can delete the draft with confirmation", async ({ page }) => {
    await openDocumentsHome(page);

    await draftRow(page, editedDraftTitle)
      .getByRole("button", { name: `Eliminar ${editedDraftTitle}` })
      .click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Eliminar" }).click();

    await expect(draftRow(page, editedDraftTitle)).not.toBeVisible({
      timeout: 15_000,
    });
  });
});
