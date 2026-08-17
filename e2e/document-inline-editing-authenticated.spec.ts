import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestTemplate,
  createTestTemplateField,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";
import { extractDocxText, readDocx } from "../test/support/docx";

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

const repeatedVariableDocument = {
  type: "doc" as const,
  content: [
    {
      type: "paragraph" as const,
      content: [
        { type: "text" as const, text: "Comparece " },
        {
          type: "templateVariable" as const,
          attrs: { key: "comprador.nombre" },
        },
        { type: "text" as const, text: ", cédula " },
        {
          type: "templateVariable" as const,
          attrs: { key: "comprador.cedula" },
        },
        { type: "text" as const, text: "." },
      ],
    },
    {
      type: "paragraph" as const,
      content: [
        { type: "text" as const, text: "Se identifica nuevamente como " },
        {
          type: "templateVariable" as const,
          attrs: { key: "comprador.nombre" },
        },
        { type: "text" as const, text: "." },
      ],
    },
    {
      type: "paragraph" as const,
      content: [
        {
          type: "optionBlock" as const,
          attrs: {
            blockId: "repeticion-final",
            name: "Repetición final",
            defaultVariantId: "repite",
            variants: [
              {
                id: "repite",
                label: "Repetir nombre",
                content: [
                  { type: "text" as const, text: "Firma " },
                  {
                    type: "templateVariable" as const,
                    attrs: { key: "comprador.nombre" },
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  ],
};

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
      content: "placeholder",
      doc: repeatedVariableDocument,
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

    const inlineName = inlineVariable(page, "comprador.nombre").first();
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
    await expect(inlineVariable(page, "comprador.nombre")).toHaveCount(3);
    await expect(inlineVariable(page, "comprador.nombre").nth(2)).toHaveText(
      "Cliente Inline Uno",
    );
    // Ya no queda como <input> tras perder el foco.
    await expect(inlineInput).toHaveCount(0);
  });

  test("B2: editing the last repeated occurrence updates every occurrence immediately", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);
    await inlineVariable(page, "comprador.nombre").nth(2).click();
    const input = documentRegion(page).locator(
      'input[data-variable-key="comprador.nombre"]',
    );
    await expect(input).toHaveCount(1);
    await input.fill("Valor Compartido");
    await expect(fieldValue(page, "comprador.nombre")).toHaveValue(
      "Valor Compartido",
    );
    await input.blur();
    await expect(inlineVariable(page, "comprador.nombre")).toHaveCount(3);
    for (const occurrence of await inlineVariable(
      page,
      "comprador.nombre",
    ).all()) {
      await expect(occurrence).toHaveText("Valor Compartido");
    }
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
    await inlineVariable(page, "comprador.nombre").first().click();
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
    await expect(documentRegion(page).getByText("Otro Cliente")).toHaveCount(3);
  });

  test("E: saving and reloading persists inline-edited values in both the document and the panel", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);
    await inlineVariable(page, "comprador.nombre").nth(1).click();
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

    await page.getByRole("button", { name: "Guardar y continuar" }).click();
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

    // El guardado avanza a "Revisar y finalizar"; la hoja documental
    // editable (con `data-variable-key` en inputs) solo se renderiza en
    // "Completar" — volver ahí tras recargar.
    await page.reload();
    await page.getByRole("tab", { name: "Completar", exact: true }).click();
    await expect(fieldValue(page, "comprador.nombre")).toHaveValue(
      "Cliente Persistido",
    );
    await expect(fieldValue(page, "comprador.cedula")).toHaveValue("101");
    await expect(inlineVariable(page, "comprador.nombre")).toHaveCount(3);
    for (const occurrence of await inlineVariable(
      page,
      "comprador.nombre",
    ).all()) {
      await expect(occurrence).toHaveText("Cliente Persistido");
    }
    await expect(
      documentRegion(page).getByText("UNO CERO UNO"),
    ).toBeVisible();
  });

  test("F: preview and DOCX contain every repeated occurrence", async ({
    page,
    request,
  }) => {
    await page.goto(documentUrl);
    // `documentUrl` quedó apuntando a "Revisar y finalizar" (paso al que
    // avanzó el guardado en el test E) — la hoja documental editable solo
    // se renderiza en "Completar".
    await page.getByRole("tab", { name: "Completar", exact: true }).click();
    await expect(inlineVariable(page, "comprador.nombre")).toHaveCount(3);
    const documentId = new URL(documentUrl).pathname.split("/").pop();
    const response = await request.get(
      `/api/documents/${documentId}/docx`,
    );
    expect(response.status()).toBe(200);
    const text = extractDocxText(
      (await readDocx(await response.body())).documentXml,
    );
    expect(text.match(/Cliente Persistido/g)).toHaveLength(3);
  });

  test("G: a finalized document is read-only — variables are no longer clickable or editable inline", async ({
    page,
  }) => {
    await page.goto(documentUrl);
    await page.getByRole("tab", { name: "Revisar y finalizar" }).click();
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Finalizar escritura" })
      .click();
    // Finalizar redirige de verdad (server action) y avanza al paso
    // siguiente ("Cobro") — hay que volver a Finalizar para ver Reabrir.
    await page.getByRole("tab", { name: "Revisar y finalizar" }).click();
    await expect(
      page.getByRole("button", { name: "Reabrir escritura" }),
    ).toBeVisible({ timeout: 15_000 });

    // La hoja documental solo se renderiza en el paso Completar (los demás
    // pasos son paneles independientes, ocultos con `hidden`).
    await page.getByRole("tab", { name: "Completar" }).click();

    // Sin botón de edición inline: el valor resuelto es texto plano.
    await expect(
      documentRegion(page).locator(
        'button[data-variable-key="comprador.nombre"]',
      ),
    ).toHaveCount(0);
    await expect(inlineVariable(page, "comprador.nombre")).toHaveCount(3);

    // Reabrir para no dejar el documento finalizado tras el test.
    await page.getByRole("tab", { name: "Revisar y finalizar" }).click();
    await page.getByRole("button", { name: "Reabrir escritura" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Reabrir escritura" })
      .click();
    await page.getByRole("tab", { name: "Revisar y finalizar" }).click();
    await expect(
      page.getByRole("button", { name: "Finalizar escritura" }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
