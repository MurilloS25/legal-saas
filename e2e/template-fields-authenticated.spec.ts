import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestTemplate,
  runCleanup,
  uniqueName,
} from "./support/factories";

// Tests share the same user account and the same template record.
// Serial mode prevents race conditions between tests that write to it.
test.describe.configure({ mode: "serial" });

const registry = new CleanupRegistry();

// Module-level state shared between serial tests in this describe block.
// Los campos creados vía UI se limpian en cascada al borrar el machote.
const templateName = uniqueName("template-fields", "machote");
let templateUrl = "";

const fieldLabel = "Comprador 1 - Nombre completo";
const editedFieldLabel = "Comprador 1 - Nombre y apellidos";
const fieldKey = "buyer_1.full_name";

async function gotoTemplateDetail(page: Page) {
  await page.goto(templateUrl);
  await expect(page).toHaveURL(/\/dashboard\/templates\/(?!new)[^/]+$/);
  await expect(
    page.getByRole("heading", { name: "Campos del machote" }),
  ).toBeVisible();
}

// La sección de campos como región accesible. Evita colisiones de strict mode
// con el textarea de contenido del machote, que también menciona la variable.
function fieldsSection(page: Page) {
  return page.getByRole("region", { name: "Campos del machote" });
}

test.describe("template fields module", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "template-fields");
  });

  test("A: seed a template to attach fields to", async ({ page }) => {
    const template = await createTestTemplate(registry, {
      name: templateName,
      content:
        "COMPRAVENTA DE PRUEBA. El comprador {{buyer_1.full_name}} acepta las condiciones del presente instrumento.",
    });
    templateUrl = `/dashboard/templates/${template.id}`;

    // Sanity check: the seeded template's detail page renders.
    await gotoTemplateDetail(page);
  });

  test("B: template detail shows the empty fields state", async ({ page }) => {
    await gotoTemplateDetail(page);

    await expect(
      page.getByText("Este machote aún no tiene campos definidos."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Agregar campo" }),
    ).toBeVisible();
  });

  test("C: user can add a field to the template", async ({ page }) => {
    await gotoTemplateDetail(page);

    await page.getByRole("button", { name: "Agregar campo" }).click();

    const section = fieldsSection(page);
    await section.getByLabel("Etiqueta").fill(fieldLabel);
    await section.getByLabel("Variable").fill(fieldKey);
    // No type selector anymore — every field is stored as text.
    await expect(section.getByLabel("Tipo de campo")).toHaveCount(0);
    await section.getByLabel("Campo obligatorio").check();

    await page.getByRole("button", { name: "Guardar campo" }).click();

    // The new field appears in the list once the server action succeeds.
    const fieldRow = fieldsSection(page)
      .locator("li")
      .filter({ hasText: fieldLabel });
    await expect(fieldRow).toBeVisible({ timeout: 15_000 });
    await expect(fieldRow.getByText(`{{${fieldKey}}}`)).toBeVisible();
    await expect(fieldRow.getByText("Obligatorio", { exact: true })).toBeVisible();
  });

  test("D: invalid field_key shows a visible validation error", async ({
    page,
  }) => {
    await gotoTemplateDetail(page);

    await page.getByRole("button", { name: "Agregar campo" }).click();

    const section = fieldsSection(page);
    await section.getByLabel("Etiqueta").fill("Campo inválido");
    await section.getByLabel("Variable").fill("Comprador 1 nombre");

    await page.getByRole("button", { name: "Guardar campo" }).click();

    await expect(
      page.getByText(/minúsculas, números, guion bajo/),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Cancelar" }).click();
  });

  test("E: user can edit an existing field", async ({ page }) => {
    await gotoTemplateDetail(page);

    await page.getByRole("button", { name: `Editar ${fieldLabel}` }).click();

    await page.getByLabel("Etiqueta").fill(editedFieldLabel);

    await page.getByRole("button", { name: "Guardar campo" }).click();

    const fieldRow = fieldsSection(page)
      .locator("li")
      .filter({ hasText: editedFieldLabel });
    await expect(fieldRow).toBeVisible({ timeout: 15_000 });
    await expect(fieldRow.getByText(`{{${fieldKey}}}`)).toBeVisible();
  });

  test("F: edited field persists after page reload", async ({ page }) => {
    await gotoTemplateDetail(page);

    await page.reload();

    const fieldRow = fieldsSection(page)
      .locator("li")
      .filter({ hasText: editedFieldLabel });
    await expect(fieldRow).toBeVisible();
    await expect(fieldRow.getByText(`{{${fieldKey}}}`)).toBeVisible();
  });

  test("G: user can delete a field with confirmation", async ({ page }) => {
    await gotoTemplateDetail(page);

    await page
      .getByRole("button", { name: `Eliminar ${editedFieldLabel}` })
      .click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Eliminar" }).click();

    // Back to the empty state once the field is gone.
    await expect(
      page.getByText("Este machote aún no tiene campos definidos."),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(editedFieldLabel)).not.toBeVisible();
  });
});
