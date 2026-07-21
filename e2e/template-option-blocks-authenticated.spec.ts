import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestTemplate,
  runCleanup,
  uniqueName,
} from "./support/factories";

/**
 * Configuración de Bloques de opciones en Machotes: insertar, editar y
 * eliminar un bloque estructurado (nunca texto plano ambiguo ni tokens
 * `{{SMART:...}}` legacy), con variantes que referencian variables
 * normales.
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

let templateUrl = "";
const templateName = uniqueName("template-option-blocks", "machote");

function contentEditor(page: Page) {
  return page.getByRole("textbox", { name: "Contenido del machote" });
}

function previewRegion(page: Page) {
  return page.getByRole("region", { name: "Vista previa" });
}

function variablesRegion(page: Page) {
  return page.getByRole("region", { name: "Variables del machote" });
}

async function waitForWorkspace(page: Page) {
  await expect(contentEditor(page)).toBeVisible({ timeout: 10_000 });
}

async function goToVariablesTab(page: Page) {
  await page.getByRole("tab", { name: "Variables" }).click();
  await expect(variablesRegion(page)).toBeVisible();
}

async function openInsertDialog(page: Page) {
  await page
    .getByRole("button", { name: "Insertar bloque de opciones" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Insertar bloque de opciones" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("template option blocks", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "template-option-blocks");
  });

  test("A: seed an empty template", async ({ page }) => {
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "ESCRITURA de prueba.",
    });
    templateUrl = `/dashboard/templates/${template.id}`;
    void page;
  });

  test("B: inserting a block with five variants (Chasis, VIN y Serie) shows a chip and the default variant in preview", async ({
    page,
  }) => {
    await page.goto(templateUrl);
    await waitForWorkspace(page);
    await contentEditor(page).click();
    await page.keyboard.press("End");
    await page.keyboard.type(" ");

    const dialog = await openInsertDialog(page);
    await dialog.getByLabel("Nombre del bloque").fill("Chasis, VIN y Serie");

    await dialog.getByLabel("Etiqueta de variante").fill("Todos iguales");
    await dialog
      .getByLabel("Contenido de variante")
      .fill("CHASIS, VIN y SERIE número {{vehiculo.numero}}");

    await dialog.getByRole("button", { name: "Agregar variante" }).click();
    const variantBlocks = dialog.locator("fieldset > div > div");
    await variantBlocks.nth(1).getByLabel("Etiqueta de variante").fill(
      "Todos distintos",
    );
    await variantBlocks
      .nth(1)
      .getByLabel("Contenido de variante")
      .fill(
        "CHASIS número {{vehiculo.chasis}}, VIN número {{vehiculo.vin}} y SERIE número {{vehiculo.serie}}",
      );
    await variantBlocks.nth(1).getByLabel("Variante predeterminada").check();

    await dialog.getByRole("button", { name: "Insertar bloque" }).click();
    await expect(dialog).not.toBeVisible();

    await expect(
      contentEditor(page).getByText("Bloque: Chasis, VIN y Serie"),
    ).toBeVisible();

    // El preview muestra la variante predeterminada ("Todos distintos"),
    // desenvuelta como texto y variables normales.
    await expect(
      previewRegion(page).getByText(/CHASIS número/),
    ).toBeVisible();
    await expect(previewRegion(page).getByText("Todos iguales")).toHaveCount(0);

    // Las variables de TODAS las variantes quedan disponibles para
    // configurar, no solo las de la predeterminada.
    await goToVariablesTab(page);
    await expect(
      variablesRegion(page).getByText("vehiculo.numero"),
    ).toBeVisible();
    await expect(
      variablesRegion(page).getByText("vehiculo.chasis"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("C: clicking the chip and 'Editar bloque' reopens the dialog prefilled, and saving updates the chip/preview", async ({
    page,
  }) => {
    await page.goto(templateUrl);
    await waitForWorkspace(page);

    await contentEditor(page)
      .getByText("Bloque: Chasis, VIN y Serie")
      .click();
    await page.getByRole("button", { name: "Editar bloque" }).click();

    const dialog = page.getByRole("dialog", { name: "Editar bloque de opciones" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Nombre del bloque")).toHaveValue(
      "Chasis, VIN y Serie",
    );

    await dialog.getByLabel("Nombre del bloque").fill("Chasis VIN Serie");
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(dialog).not.toBeVisible();

    await expect(
      contentEditor(page).getByText("Bloque: Chasis VIN Serie"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("D: deleting a block requires confirmation and removes it from the editor and preview", async ({
    page,
  }) => {
    await page.goto(templateUrl);
    await waitForWorkspace(page);

    await contentEditor(page).getByText("Bloque: Chasis VIN Serie").click();
    await page.getByRole("button", { name: "Editar bloque" }).click();
    const dialog = page.getByRole("dialog", { name: "Editar bloque de opciones" });
    await dialog.getByRole("button", { name: "Eliminar bloque" }).click();

    // Cancelar la eliminación conserva el bloque (y el diálogo sigue abierto).
    await dialog.getByRole("button", { name: "Cancelar eliminación" }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      contentEditor(page).getByText("Bloque: Chasis VIN Serie"),
    ).toBeVisible();

    // Confirmar sí elimina.
    await contentEditor(page).getByText("Bloque: Chasis VIN Serie").click();
    await page.getByRole("button", { name: "Editar bloque" }).click();
    const dialog2 = page.getByRole("dialog", { name: "Editar bloque de opciones" });
    await dialog2.getByRole("button", { name: "Eliminar bloque" }).click();
    await dialog2
      .getByRole("button", { name: "Eliminar definitivamente" })
      .click();

    await expect(
      contentEditor(page).getByText("Bloque: Chasis VIN Serie"),
    ).toHaveCount(0);
    await expect(
      previewRegion(page).getByText("CHASIS número"),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("E: a saved block survives reload", async ({ page }) => {
    await page.goto(templateUrl);
    await waitForWorkspace(page);

    const dialog = await openInsertDialog(page);
    await dialog.getByLabel("Nombre del bloque").fill("Hora");
    await dialog.getByLabel("Etiqueta de variante").fill("Hora en punto");
    await dialog.getByLabel("Contenido de variante").fill("{{hora.valor}}");
    await dialog.getByLabel("Variante predeterminada").check();
    await dialog.getByRole("button", { name: "Insertar bloque" }).click();
    await expect(dialog).not.toBeVisible();

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await waitForWorkspace(page);
    await expect(
      contentEditor(page).getByText("Bloque: Hora"),
    ).toBeVisible();
    await goToVariablesTab(page);
    await expect(
      variablesRegion(page).getByText("hora.valor"),
    ).toBeVisible();
  });
});
