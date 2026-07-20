import { test, expect, type Page, type Locator } from "@playwright/test";
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
  await page.goto("/dashboard/documents");
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
 * Campo del panel de datos. Se delimita a la región del panel porque las
 * variables pendientes de la hoja también llevan la clave en su aria-label.
 */
function panelField(page: Page, label: string | RegExp) {
  return page
    .getByRole("region", { name: "Datos de la escritura" })
    .getByLabel(label);
}

/**
 * Llena un campo y espera a que la hoja refleje el valor en vivo. El bloque
 * se reintenta completo: si el primer fill ocurre antes de la hidratación
 * de React, el siguiente intento lo corrige.
 */
async function fillFieldLive(page: Page, field: Locator, value: string) {
  await expect(async () => {
    await field.fill(value);
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
    await page.goto("/dashboard/documents/new");
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
    await expect(page).toHaveURL(/\/dashboard\/documents\/new$/, {
      timeout: 15_000,
    });

    // Pick the template created in test A.
    await page
      .locator("li")
      .filter({ hasText: templateName })
      .getByRole("link", { name: "Usar este machote" })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/new\/[^/]+$/, {
      timeout: 15_000,
    });

    // El compositor: documento como zona principal + panel de datos.
    await expect(documentRegion(page)).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Datos de la escritura" }),
    ).toBeVisible();

    // The title is pre-generated from the template name.
    await expect(page.getByLabel("Título de la escritura")).toHaveValue(
      draftTitle,
    );

    // La variable pendiente aparece en la hoja como placeholder.
    await expect(
      documentRegion(page).getByText(`{{${fieldKey}}}`).first(),
    ).toBeVisible();

    // Al escribir, el documento se actualiza ANTES de guardar.
    await fillFieldLive(page, panelField(page, new RegExp(fieldLabel)), filledValue);
    await expect(
      page.getByText("Cambios sin guardar").first(),
    ).toBeVisible();

    // Progreso sobre los campos (configurado + derivado del contenido).
    await expect(page.getByText("1 de 2 campos completados")).toBeVisible();

    await page.getByRole("button", { name: "Guardar cambios" }).click();

    // Saving redirects to the edit view with a confirmation.
    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/]+/, {
      timeout: 30_000,
    });
    draftPath = new URL(page.url()).pathname;
    await expect(
      page.getByText("Escritura guardada como borrador", { exact: true }),
    ).toBeVisible();

    // Register the persisted draft for cleanup (its id survives edits).
    await registerCreatedViaUi(registry, "documents", "title", draftTitle);

    await expect(
      documentRegion(page).getByText(new RegExp(filledValue)),
    ).toBeVisible();
    // The undefined variable stays visible as a placeholder.
    await expect(
      documentRegion(page).getByText(`{{${derivedKey}}}`).first(),
    ).toBeVisible();
  });

  test("C2: persisted workspace uses stable sections and accessible history", async ({
    page,
  }) => {
    await page.goto(draftPath);
    const navigation = page.getByRole("navigation", {
      name: "Secciones de la escritura",
    });
    await expect(
      navigation.getByRole("link", { name: "Documento" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      navigation.getByRole("link", { name: "Cuentas por cobrar" }),
    ).toBeVisible();
    await expect(navigation.getByText("Índice notarial")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(
      page.getByRole("region", { name: "Cuentas por cobrar de la escritura" }),
    ).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Actividad" })).toHaveCount(0);

    await navigation.getByRole("link", { name: "Cuentas por cobrar" }).click();
    await expect(page).toHaveURL(/section=receivables/);
    await expect(
      page.getByRole("region", { name: "Cuentas por cobrar de la escritura" }),
    ).toBeVisible();
    await page.goBack();
    await expect(
      page.getByRole("region", { name: "Datos de la escritura" }),
    ).toBeVisible();

    const historyTrigger = page.getByRole("button", { name: "Historial" });
    await historyTrigger.click();
    await expect(
      page.getByRole("dialog", { name: "Historial de la escritura" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cerrar historial" }).click();
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
    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/]+/, {
      timeout: 15_000,
    });

    // Existing values are loaded into the panel.
    await expect(panelField(page, new RegExp(fieldLabel))).toHaveValue(
      filledValue,
    );

    await fillFieldLive(page, panelField(page, new RegExp(fieldLabel)), editedValue);
    // El snapshot persistido no cambia hasta guardar.
    await expect(page.getByText("Cambios sin guardar").first()).toBeVisible();

    editedDraftTitle = `${templateName} — Editado`;
    await page.getByLabel("Título de la escritura").fill(editedDraftTitle);

    // Completa también la variable derivada del contenido.
    await fillFieldLive(page, panelField(page, new RegExp(derivedKey)), "ABC-123");
    await expect(page.getByText("2 de 2 campos completados")).toBeVisible();

    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(
      page.getByText("Borrador guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    draftPath = new URL(page.url()).pathname;
    await expect(
      documentRegion(page).getByText(/Cliente Editado 007 \(cero inicial: 012\)/),
    ).toBeVisible();
  });

  test("F: edited draft persists after reload", async ({ page }) => {
    await openDocumentsHome(page);

    const row = draftRow(page, editedDraftTitle);
    await expect(row).toBeVisible();

    await row.getByRole("link", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/]+/, {
      timeout: 15_000,
    });
    await page.reload();

    await expect(page.getByLabel("Título de la escritura")).toHaveValue(
      editedDraftTitle,
    );
    await expect(panelField(page, new RegExp(fieldLabel))).toHaveValue(
      editedValue,
    );
    await expect(
      documentRegion(page).getByText(/Cliente Editado 007 \(cero inicial: 012\)/),
    ).toBeVisible();
  });

  test("G: an empty required field blocks saving", async ({ page }) => {
    await page.goto(draftPath);

    const requiredField = panelField(page, new RegExp(fieldLabel));
    await expect(requiredField).toHaveValue(editedValue, { timeout: 15_000 });

    // El comportamiento de placeholders ya está cubierto arriba; aquí el
    // contrato crítico es que un campo requerido vacío bloquea el guardado.
    await expect(async () => {
      await requiredField.fill("");
      await expect(requiredField).toHaveValue("", { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });

    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByText(`${fieldLabel} es requerido`)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("H: a nonexistent document returns the not-found page", async ({
    page,
  }) => {
    await page.goto(
      "/dashboard/documents/00000000-0000-0000-0000-000000000000",
    );

    await expect(page.getByText("404")).toBeVisible();
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

    await page.goto(`/dashboard/documents/new/${bareTemplate.id}`);

    await expect(
      page.getByText(/no tiene campos definidos/),
    ).not.toBeVisible();
    await fillFieldLive(
      page,
      panelField(page, /poderdante\.nombre/),
      "Poderdante de Prueba",
    );

    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/]+/, {
      timeout: 30_000,
    });
    await expect(
      page.getByText("Escritura guardada como borrador", { exact: true }),
    ).toBeVisible();
    await registerCreatedViaUi(registry, "documents", "title", bareDraftTitle);

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

    await page.goto(`/dashboard/documents/new/${structuredTemplate.id}`);

    const sheet = documentRegion(page);
    await expect(
      sheet.locator("strong", { hasText: "PODER GENERAL." }),
    ).toBeVisible();
    await expect(sheet.locator("em", { hasText: "Otorgado en" })).toBeVisible();
    await expect(sheet.locator("u", { hasText: "San José" })).toBeVisible();

    await fillFieldLive(
      page,
      panelField(page, /otorgante\.nombre/),
      "Otorgante Estructurado",
    );
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByText("Escritura guardada como borrador", { exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await registerCreatedViaUi(registry, "documents", "title", structuredTitle);

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
    await updateTestTemplateContent(
      historyTemplate.id,
      "Acta con {{dato.uno}}.",
    );

    await page.goto(`/dashboard/documents/${historyDraft.id}`);
    // El campo huérfano ya no es editable.
    await expect(panelField(page, /dato\.dos/)).not.toBeVisible();

    // Guardar con un cambio no borra el valor histórico.
    await fillFieldLive(page, panelField(page, /dato\.uno/), "Valor Uno B");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByText("Borrador guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    // Si el machote recupera la variable, el valor histórico reaparece.
    await updateTestTemplateContent(
      historyTemplate.id,
      "Acta con {{dato.uno}} y {{dato.dos}}.",
    );
    await page.goto(`/dashboard/documents/${historyDraft.id}`);
    await expect(panelField(page, /dato\.dos/)).toHaveValue("Valor Dos");
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
