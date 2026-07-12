import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";

// Tests share the same user account. Serial mode prevents race conditions
// between tests that write to the same template records.
test.describe.configure({ mode: "serial" });

const registry = new CleanupRegistry();

// Module-level state shared between serial tests in this describe block.
let createdTemplateName = "";
let editedTemplateName = "";
let templateUrl = "";

async function openTemplateFromList(page: Page, name: string) {
  if (templateUrl) {
    await page.goto(templateUrl);
    await expect(page).toHaveURL(/\/dashboard\/templates\/[^/]+$/);
    return;
  }

  const templateLink = page
    .getByRole("link")
    .filter({ hasText: name })
    .first();
  await expect(templateLink).toBeVisible({ timeout: 15_000 });

  const href = await templateLink.getAttribute("href");
  expect(href).toMatch(/^\/dashboard\/templates\/[^/]+$/);

  templateUrl = href!;
  await page.goto(href!);
  await expect(page).toHaveURL(/\/dashboard\/templates\/[^/]+$/);
}

test.describe("templates module", () => {
  test.afterAll(async () => {
    // La creación se hace vía UI (es lo que prueba el spec); aquí se busca
    // el registro por su nombre único y se elimina.
    const finalName = editedTemplateName || createdTemplateName;
    if (finalName) {
      await registerCreatedViaUi(registry, "templates", "name", finalName);
    }
    await runCleanup(registry, "templates");
  });

  test("A: templates list page is accessible from the sidebar", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Machotes", exact: true })
      .click();

    await expect(page).toHaveURL(/\/dashboard\/templates/, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: "Machotes", exact: true }),
    ).toBeVisible();
  });

  test("B: new template page is reachable", async ({ page }) => {
    await page.goto("/dashboard/templates");

    await page
      .getByRole("link", { name: /Nuevo machote|Crear machote/ })
      .first()
      .click();

    await expect(page).toHaveURL(/\/dashboard\/templates\/new$/);
    await expect(
      page.getByRole("heading", { name: "Nuevo machote", exact: true }),
    ).toBeVisible();
  });

  test("C: user can create a new template", async ({ page }) => {
    createdTemplateName = uniqueName("templates", "machote");

    await page.goto("/dashboard/templates/new");

    await page.getByLabel("Nombre del machote").fill(createdTemplateName);
    await page.getByLabel(/[Dd]escripción/).fill("Plantilla de prueba E2E");
    await page
      .getByLabel("Contenido")
      .fill(
        "CONTRATO DE PRUEBA. Las partes acuerdan lo siguiente: el arrendatario acepta las condiciones del presente instrumento.",
      );
    // status defaults to "draft" — no change needed

    await page.getByRole("button", { name: "Crear machote" }).click();

    // Successful create redirects to /dashboard/templates (the list).
    await expect(page).toHaveURL(/\/dashboard\/templates$/, {
      timeout: 15_000,
    });
    await expect(page.getByText(createdTemplateName).first()).toBeVisible();

    const templateLink = page
      .getByRole("link")
      .filter({ hasText: createdTemplateName })
      .first();
    await expect(templateLink).toBeVisible({ timeout: 15_000 });

    const href = await templateLink.getAttribute("href");
    expect(href).toMatch(/^\/dashboard\/templates\/[^/]+$/);
    templateUrl = href!;
  });

  test("D: created template appears in the list", async ({ page }) => {
    await page.goto("/dashboard/templates");
    await expect(
      page.getByRole("heading", { name: "Machotes", exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText(createdTemplateName).first()).toBeVisible();
  });

  test("E: user can edit an existing template", async ({ page }) => {
    await page.goto("/dashboard/templates");

    await openTemplateFromList(page, createdTemplateName);

    editedTemplateName = `${createdTemplateName} Editado`;

    await page.getByLabel("Nombre del machote").fill(editedTemplateName);
    await page
      .getByLabel("Contenido")
      .fill(
        "CONTRATO ACTUALIZADO. Versión editada. El arrendatario acepta las condiciones revisadas del presente instrumento.",
      );
    await page.getByLabel("Estado").selectOption("active");

    await page.getByRole("button", { name: "Guardar cambios" }).click();

    // After save, redirects back to the list.
    await expect(page).toHaveURL(/\/dashboard\/templates$/, {
      timeout: 15_000,
    });
  });

  test("F: edited template fields persist after page reload", async ({
    page,
  }) => {
    await page.goto("/dashboard/templates");

    await openTemplateFromList(page, editedTemplateName);

    await page.reload();

    await expect(page.getByLabel("Nombre del machote")).toHaveValue(
      editedTemplateName,
    );
    await expect(page.getByLabel("Estado")).toHaveValue("active");
    await expect(page.getByLabel("Contenido")).toHaveValue(
      /CONTRATO ACTUALIZADO/,
    );
  });

  test("G: edited template appears in the list with updated status", async ({
    page,
  }) => {
    await page.goto("/dashboard/templates");
    await expect(
      page.getByRole("heading", { name: "Machotes", exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText(editedTemplateName).first()).toBeVisible();

    // The Activo badge (span, exact text) should be visible within the row.
    const templateRow = page
      .locator("li")
      .filter({ hasText: editedTemplateName });
    await expect(templateRow.getByText("Activo", { exact: true }).first()).toBeVisible();
  });
});
