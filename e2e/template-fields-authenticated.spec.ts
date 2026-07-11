import { test, expect, type Page } from "@playwright/test";

// Tests share the same user account and the same template record.
// Serial mode prevents race conditions between tests that write to it.
test.describe.configure({ mode: "serial" });

// Module-level state shared between serial tests in this describe block.
let templateName = "";
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
  test("A: create a template to attach fields to", async ({ page }) => {
    templateName = `E2E Campos ${Date.now()}`;

    await page.goto("/dashboard/templates/new");

    await page.getByLabel("Nombre del machote").fill(templateName);
    await page
      .getByLabel("Contenido")
      .fill(
        "COMPRAVENTA DE PRUEBA. El comprador {{buyer_1.full_name}} acepta las condiciones del presente instrumento.",
      );

    await page.getByRole("button", { name: "Crear machote" }).click();

    await expect(page).toHaveURL(/\/dashboard\/templates$/, {
      timeout: 15_000,
    });

    // Open the detail page and remember its URL for the rest of the suite.
    const templateLink = page
      .getByRole("link")
      .filter({ hasText: templateName })
      .first();
    await expect(templateLink).toBeVisible();

    const href = await templateLink.getAttribute("href");
    expect(href).toMatch(/^\/dashboard\/templates\/(?!new)[^/]+$/);
    templateUrl = href!;
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

    await page.getByLabel("Etiqueta").fill(fieldLabel);
    await page.getByLabel("Variable").fill(fieldKey);
    await page.getByLabel("Tipo de campo").selectOption("text");
    await page.getByLabel("Campo obligatorio").check();

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

    await page.getByLabel("Etiqueta").fill("Campo inválido");
    await page.getByLabel("Variable").fill("Comprador 1 nombre");

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
    await page.getByLabel("Tipo de campo").selectOption("textarea");

    await page.getByRole("button", { name: "Guardar campo" }).click();

    const fieldRow = fieldsSection(page)
      .locator("li")
      .filter({ hasText: editedFieldLabel });
    await expect(fieldRow).toBeVisible({ timeout: 15_000 });
    await expect(fieldRow.getByText("Área de texto")).toBeVisible();
  });

  test("F: edited field persists after page reload", async ({ page }) => {
    await gotoTemplateDetail(page);

    await page.reload();

    const fieldRow = fieldsSection(page)
      .locator("li")
      .filter({ hasText: editedFieldLabel });
    await expect(fieldRow).toBeVisible();
    await expect(fieldRow.getByText(`{{${fieldKey}}}`)).toBeVisible();
    await expect(fieldRow.getByText("Área de texto")).toBeVisible();
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
