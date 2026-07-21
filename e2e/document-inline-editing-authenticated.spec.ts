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
 * Edición inline de variables directamente en la hoja documental de la
 * Escritura: clic sobre una variable la convierte en un campo editable in
 * situ, sincronizado con el mismo estado que el panel lateral.
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const templateName = uniqueName("document-inline-editing", "machote");
let templateId = "";
let documentUrl = "";

function documentRegion(page: Page) {
  return page.getByRole("region", { name: "Documento", exact: true });
}

/**
 * Valor crudo persistido para una variable: el input oculto que el
 * formulario envía en el submit, única fuente de verdad ya que el panel de
 * datos ya no lista los campos uno a uno.
 */
function fieldValue(page: Page, key: string) {
  return page.locator(`input[name="${key}"]`);
}

function inlineVariable(page: Page, key: string) {
  return documentRegion(page).locator(`[data-variable-key="${key}"]`);
}

test.describe("document inline field editing", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "document-inline-editing");
  });

  test("A: seed a template with a plain field and a digits_to_words field", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: templateName,
      content:
        "Comparece {{comprador.nombre}}, cédula {{comprador.cedula}}.",
    });
    templateId = template.id;

    await createTestTemplateField(registry, templateId, {
      field_key: "comprador.nombre",
      label: "Comprador - Nombre",
    });
    await createTestTemplateField(registry, templateId, {
      field_key: "comprador.cedula",
      label: "Comprador - Cédula",
      sort_order: 1,
      output_transform: "digits_to_words",
    });

    void page;
  });

  test("B: clicking a pending variable inline turns it into an editable input synced with the panel", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);

    const inlineName = inlineVariable(page, "comprador.nombre");
    await expect(inlineName).toBeVisible();
    await inlineName.click();

    const inlineInput = documentRegion(page).locator(
      'input[data-variable-key="comprador.nombre"]',
    );
    await expect(inlineInput).toBeFocused();
    await inlineInput.fill("Cliente Inline Uno");

    // Misma fuente de verdad: el valor enviado por el formulario refleja el
    // cambio inmediatamente.
    await expect(fieldValue(page, "comprador.nombre")).toHaveValue(
      "Cliente Inline Uno",
    );

    await inlineInput.blur();
    await expect(
      documentRegion(page).getByText("Cliente Inline Uno"),
    ).toBeVisible();
    // Ya no queda como <input> tras perder el foco.
    await expect(inlineInput).toHaveCount(0);
  });

  test("C: the inline field shows the raw value while editing and the transformed value once blurred", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);
    await inlineVariable(page, "comprador.cedula").click();

    const inlineInput = documentRegion(page).locator(
      'input[data-variable-key="comprador.cedula"]',
    );
    await inlineInput.fill("205750695");
    await expect(inlineInput).toHaveValue("205750695");

    await inlineInput.blur();
    await expect(
      documentRegion(page).getByText(
        "DOS CERO CINCO SIETE CINCO CERO SEIS NUEVE CINCO",
      ),
    ).toBeVisible();
    await expect(documentRegion(page).getByText("205750695")).toHaveCount(0);

    // Reabrir la edición vuelve a mostrar el valor crudo, no el transformado.
    await documentRegion(page)
      .getByText("DOS CERO CINCO SIETE CINCO CERO SEIS NUEVE CINCO")
      .click();
    await expect(inlineInput).toHaveValue("205750695");
    await inlineInput.blur();
  });

  test("D: Tab moves focus to the next variable in document order without saving automatically", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);
    await inlineVariable(page, "comprador.nombre").click();
    const nameInput = documentRegion(page).locator(
      'input[data-variable-key="comprador.nombre"]',
    );
    await nameInput.fill("Otro Cliente");
    await nameInput.press("Tab");

    const cedulaInput = documentRegion(page).locator(
      'input[data-variable-key="comprador.cedula"]',
    );
    await expect(cedulaInput).toBeFocused();

    // Escape sale del modo edición sin borrar el valor ya escrito.
    await cedulaInput.press("Escape");
    await expect(cedulaInput).toHaveCount(0);
    await expect(
      documentRegion(page).getByText("Otro Cliente"),
    ).toBeVisible();
  });

  test("E: saving and reloading persists inline-edited values in both the document and the panel", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);
    await inlineVariable(page, "comprador.nombre").click();
    await documentRegion(page)
      .locator('input[data-variable-key="comprador.nombre"]')
      .fill("Cliente Persistido");
    await documentRegion(page)
      .locator('input[data-variable-key="comprador.nombre"]')
      .blur();

    await inlineVariable(page, "comprador.cedula").click();
    await documentRegion(page)
      .locator('input[data-variable-key="comprador.cedula"]')
      .fill("101");
    await documentRegion(page)
      .locator('input[data-variable-key="comprador.cedula"]')
      .blur();

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/[0-9a-f-]{36}/, {
      timeout: 15_000,
    });
    documentUrl = page.url();
    await registerCreatedViaUi(
      registry,
      "documents",
      "title",
      `${templateName} — Borrador`,
    );

    await page.reload();
    await expect(fieldValue(page, "comprador.nombre")).toHaveValue(
      "Cliente Persistido",
    );
    await expect(fieldValue(page, "comprador.cedula")).toHaveValue("101");
    await expect(
      documentRegion(page).getByText("Cliente Persistido"),
    ).toBeVisible();
    await expect(
      documentRegion(page).getByText("UNO CERO UNO"),
    ).toBeVisible();
  });

  test("F: a finalized document is read-only — variables are no longer clickable or editable inline", async ({
    page,
  }) => {
    await page.goto(documentUrl);
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Finalizar escritura" })
      .click();
    await expect(
      page.getByRole("button", { name: "Reabrir escritura" }),
    ).toBeVisible({ timeout: 15_000 });

    // Sin botón de edición inline: el valor resuelto es texto plano.
    await expect(
      documentRegion(page).locator(
        'button[data-variable-key="comprador.nombre"]',
      ),
    ).toHaveCount(0);
    await expect(
      documentRegion(page).getByText("Cliente Persistido"),
    ).toBeVisible();

    // Reabrir para no dejar el documento finalizado tras el test.
    await page.getByRole("button", { name: "Reabrir escritura" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Reabrir escritura" })
      .click();
    await expect(
      page.getByRole("button", { name: "Finalizar escritura" }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
