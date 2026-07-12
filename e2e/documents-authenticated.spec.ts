import { test, expect, type Page } from "@playwright/test";

// Tests share the same user account and template. Serial mode prevents
// race conditions between tests that depend on the created template.
test.describe.configure({ mode: "serial" });

// Module-level state shared between serial tests.
let templateName = "";

const fieldLabel = "Comprador 1 - Nombre completo";
const fieldKey = "buyer_1.full_name";
const filledValue = "Cliente de Prueba Uno";

async function openDocumentsSection(page: Page) {
  await page.goto("/dashboard/documents");
  await expect(
    page.getByRole("heading", { name: "Escrituras", exact: true }),
  ).toBeVisible();
}

test.describe("documents workspace", () => {
  test("A: create a template with content and one field", async ({ page }) => {
    templateName = `E2E Escritura ${Date.now()}`;

    // Create the template.
    await page.goto("/dashboard/templates/new");
    await page.getByLabel("Nombre del machote").fill(templateName);
    await page
      .getByLabel("Contenido")
      .fill(
        "ESCRITURA DE PRUEBA. Comparece {{buyer_1.full_name}}, placa {{vehicle.plate}}.",
      );
    await page.getByRole("button", { name: "Crear machote" }).click();
    await expect(page).toHaveURL(/\/dashboard\/templates$/, {
      timeout: 15_000,
    });

    // Open its detail and define one field (vehicle.plate stays undefined
    // on purpose to exercise the unresolved-variable path).
    const templateLink = page
      .getByRole("link")
      .filter({ hasText: templateName })
      .first();
    const href = await templateLink.getAttribute("href");
    await page.goto(href!);

    const fieldsSection = page.getByRole("region", {
      name: "Campos del machote",
    });
    await fieldsSection.getByRole("button", { name: "Agregar campo" }).click();
    await fieldsSection.getByLabel("Etiqueta").fill(fieldLabel);
    await fieldsSection.getByLabel("Variable").fill(fieldKey);
    await fieldsSection.getByLabel("Campo obligatorio").check();
    await fieldsSection
      .getByRole("button", { name: "Guardar campo" })
      .click();
    await expect(
      fieldsSection.locator("li").filter({ hasText: fieldLabel }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("B: sidebar navigates to the documents section", async ({ page }) => {
    await page.goto("/dashboard");

    await page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Escrituras" })
      .click();

    await expect(page).toHaveURL(/\/dashboard\/documents$/);
    await expect(
      page.getByRole("heading", { name: "Escrituras", exact: true }),
    ).toBeVisible();
  });

  test("C: dashboard module cards navigate to their sections", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: /Machotes/ }).last().click();
    await expect(page).toHaveURL(/\/dashboard\/templates$/);

    await page.goto("/dashboard");
    await page.getByRole("link", { name: /Escrituras/ }).last().click();
    await expect(page).toHaveURL(/\/dashboard\/documents$/);

    await page.goto("/dashboard");
    await page.getByRole("link", { name: /Clientes/ }).last().click();
    await expect(page).toHaveURL(/\/dashboard\/clients$/);
  });

  test("D: documents section lists the template with a create action", async ({
    page,
  }) => {
    await openDocumentsSection(page);

    const templateCard = page.locator("li").filter({ hasText: templateName });
    await expect(templateCard).toBeVisible();
    await expect(
      templateCard.getByRole("link", { name: "Crear escritura" }),
    ).toBeVisible();
  });

  test("E: create document flow shows the shared fill form", async ({
    page,
  }) => {
    await openDocumentsSection(page);

    await page
      .locator("li")
      .filter({ hasText: templateName })
      .getByRole("link", { name: "Crear escritura" })
      .click();

    // First navigation may trigger an on-demand compile in the dev server.
    await expect(page).toHaveURL(/\/dashboard\/documents\/new\/[^/]+$/, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: "Crear escritura" }),
    ).toBeVisible();
    await expect(page.getByLabel(new RegExp(fieldLabel))).toBeVisible();
  });

  test("F: preview renders filled values and keeps missing variables visible", async ({
    page,
  }) => {
    await openDocumentsSection(page);
    await page
      .locator("li")
      .filter({ hasText: templateName })
      .getByRole("link", { name: "Crear escritura" })
      .click();
    // First navigation may trigger an on-demand compile in the dev server.
    await expect(page).toHaveURL(/\/dashboard\/documents\/new\/[^/]+$/, {
      timeout: 15_000,
    });

    await page.getByLabel(new RegExp(fieldLabel)).fill(filledValue);
    await page.getByRole("button", { name: "Preparar documento" }).click();

    const preview = page.getByRole("region", {
      name: "Vista previa del documento",
    });
    await expect(preview).toBeVisible({ timeout: 15_000 });

    // Filled variable is substituted; undefined variable stays as placeholder.
    await expect(preview.getByText(new RegExp(filledValue))).toBeVisible();
    await expect(
      preview.getByText(/\{\{vehicle\.plate\}\}/).first(),
    ).toBeVisible();
  });

  test("G: required field validation blocks empty submissions", async ({
    page,
  }) => {
    await openDocumentsSection(page);
    await page
      .locator("li")
      .filter({ hasText: templateName })
      .getByRole("link", { name: "Crear escritura" })
      .click();
    // First navigation may trigger an on-demand compile in the dev server.
    await expect(page).toHaveURL(/\/dashboard\/documents\/new\/[^/]+$/, {
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Preparar documento" }).click();

    await expect(page.getByText(`${fieldLabel} es requerido`)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("H: template detail links to the same shared flow", async ({ page }) => {
    await page.goto("/dashboard/templates");

    const templateLink = page
      .getByRole("link")
      .filter({ hasText: templateName })
      .first();
    const href = await templateLink.getAttribute("href");
    await page.goto(href!);

    await page.getByRole("link", { name: "Crear escritura" }).click();

    // First navigation may trigger an on-demand compile in the dev server.
    await expect(page).toHaveURL(/\/dashboard\/documents\/new\/[^/]+$/, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: "Crear escritura" }),
    ).toBeVisible();
  });
});
