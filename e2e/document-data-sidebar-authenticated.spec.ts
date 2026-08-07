import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestTemplate,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";

/**
 * Panel de datos reducido: sin lista larga de campos ni filtros "Todos" /
 * "Pendientes" — solo Cliente principal, Autollenado por roles, Progreso
 * (consciente de la variante activa de cada Bloque de opciones) y la acción
 * "Siguiente pendiente".
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const templateName = uniqueName("document-data-sidebar", "machote");
const draftTitle = `${templateName} — Borrador`;
let templateId = "";

const sidebarDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Comparece " },
        {
          type: "templateVariable",
          attrs: { key: "parte.uno", label: "Parte Uno" },
        },
        { type: "text", text: " y " },
        {
          type: "templateVariable",
          attrs: { key: "parte.dos", label: "Parte Dos" },
        },
        { type: "text", text: ". Vehículo con " },
        {
          type: "optionBlock",
          attrs: {
            blockId: "block-1",
            name: "Chasis o Serie",
            defaultVariantId: "chasis",
            variants: [
              {
                id: "chasis",
                label: "Solo chasis",
                content: [
                  { type: "text", text: "chasis " },
                  { type: "templateVariable", attrs: { key: "vehiculo.chasis" } },
                ],
              },
              {
                id: "ambos",
                label: "Chasis y serie",
                content: [
                  { type: "text", text: "chasis " },
                  { type: "templateVariable", attrs: { key: "vehiculo.chasis" } },
                  { type: "text", text: " y serie " },
                  { type: "templateVariable", attrs: { key: "vehiculo.serie" } },
                ],
              },
            ],
          },
        },
        { type: "text", text: "." },
      ],
    },
  ],
};

function documentRegion(page: Page) {
  return page.getByRole("region", { name: "Documento", exact: true });
}

function dataPanel(page: Page) {
  return page.getByRole("region", { name: "Datos de la Escritura" });
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

test.describe("document data sidebar", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "document-data-sidebar");
  });

  test("A: seed a template with plain fields and a two-variant option block", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "placeholder",
      doc: sidebarDoc,
    });
    templateId = template.id;
    void page;
  });

  test("B: the panel shows no long field list, no filter buttons, and no extra tabs", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);
    await expect(dataPanel(page)).toBeVisible();

    // Solo título, Cliente principal, Autollenado, Progreso y Acción.
    await expect(page.getByLabel("Título de la escritura")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Cliente principal/ }),
    ).toBeVisible();
    await expect(
      dataPanel(page).getByRole("group", { name: "Filtrar campos" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Todos" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Pendientes" })).toHaveCount(0);
    await expect(page.getByRole("tablist")).toHaveCount(0);
    // Ningún <input> individual por variable dentro del panel: solo viven
    // en la hoja documental (edición inline) o como inputs ocultos del form.
    await expect(
      dataPanel(page).locator('input[data-variable-key]'),
    ).toHaveCount(0);
  });

  test("C: progress is variant-aware and updates as fields are completed", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);

    // Con 3 o menos pendientes, PendingFieldsDialog lista los campos por
    // nombre ("Pendientes: X, Y, Z") en vez de mostrar un conteo.
    await expect(page.getByText("0 de 3 campos completos")).toBeVisible();
    await expect(dataPanel(page).getByText("Pendientes:")).toBeVisible();
    await expect(
      dataPanel(page).getByRole("button", { name: "parte.uno" }),
    ).toBeVisible();
    await expect(
      dataPanel(page).getByRole("button", { name: "parte.dos" }),
    ).toBeVisible();
    await expect(
      dataPanel(page).getByRole("button", { name: "vehiculo.chasis" }),
    ).toBeVisible();

    await fillInlineField(page, "parte.uno", "Persona Uno");
    await expect(page.getByText("1 de 3 campos completos")).toBeVisible();
    await expect(
      dataPanel(page).getByRole("button", { name: "parte.uno" }),
    ).toHaveCount(0);
    await expect(
      dataPanel(page).getByRole("button", { name: "parte.dos" }),
    ).toBeVisible();

    await fillInlineField(page, "parte.dos", "Persona Dos");
    await fillInlineField(page, "vehiculo.chasis", "CHASIS-001");
    await expect(page.getByText("3 de 3 campos completos")).toBeVisible();
    await expect(
      page.getByText("Todos los campos están completos."),
    ).toBeVisible();

    // Cambiar a la variante de dos campos agrega "vehiculo.serie" (vacío)
    // al total activo — el valor de "vehiculo.chasis" ya escrito se conserva.
    await page
      .getByRole("button", { name: /Cambiar variante de Chasis o Serie/ })
      .click();
    await page.getByRole("radio", { name: "Chasis y serie" }).click();

    await expect(page.getByText("3 de 4 campos completos")).toBeVisible();
    await expect(
      dataPanel(page).getByRole("button", { name: "vehiculo.serie" }),
    ).toBeVisible();
  });

  test("D: 'Siguiente pendiente' scrolls to, focuses and cycles through empty active fields in document order", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);

    const nextPending = page.getByRole("button", { name: "Siguiente pendiente →" });
    await expect(nextPending).toBeEnabled();

    await nextPending.click();
    const parteUnoInput = documentRegion(page).locator(
      'input[data-variable-key="parte.uno"]',
    );
    await expect(parteUnoInput).toBeFocused();
    await parteUnoInput.fill("Persona Uno");
    await parteUnoInput.blur();

    await nextPending.click();
    const parteDosInput = documentRegion(page).locator(
      'input[data-variable-key="parte.dos"]',
    );
    await expect(parteDosInput).toBeFocused();
    await parteDosInput.fill("Persona Dos");
    await parteDosInput.blur();

    await nextPending.click();
    const chasisInput = documentRegion(page).locator(
      'input[data-variable-key="vehiculo.chasis"]',
    );
    await expect(chasisInput).toBeFocused();
    await chasisInput.fill("CHASIS-002");
    await chasisInput.blur();

    // Con la variante predeterminada (un solo campo) ya no queda nada
    // pendiente: la acción se deshabilita.
    await expect(page.getByText("Todos los campos están completos.")).toBeVisible();
    await expect(nextPending).toBeDisabled();
  });

  test("E: saving keeps title, progress and the panel heading consistent — no autofill section for a template without role-shaped keys", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);

    // "parte.uno"/"parte.dos" no siguen el patrón `rol.dato`: sin roles
    // detectados, la sección de autollenado simplemente no aparece.
    await expect(
      page.getByRole("region", { name: "Completar desde Clientes" }),
    ).toHaveCount(0);

    await fillInlineField(page, "parte.uno", "Persona Uno");
    await fillInlineField(page, "parte.dos", "Persona Dos");
    await fillInlineField(page, "vehiculo.chasis", "CHASIS-003");

    await page.getByLabel("Título de la escritura").fill(draftTitle);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/[0-9a-f-]{36}/, {
      timeout: 15_000,
    });
    await registerCreatedViaUi(registry, "documents", "title", draftTitle);

    await expect(
      dataPanel(page).getByText("3 de 3 campos completos"),
    ).toBeVisible();
  });
});
