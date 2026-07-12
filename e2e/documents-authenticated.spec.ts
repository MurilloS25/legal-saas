import { test, expect, type Page } from "@playwright/test";

// Tests share the same user account, template and draft. Serial mode keeps
// the workflow consistent between tests.
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

// Module-level state shared between serial tests.
let templateName = "";
let draftTitle = "";
let editedDraftTitle = "";

const fieldLabel = "Comprador 1 - Nombre completo";
const fieldKey = "buyer_1.full_name";
const filledValue = "Cliente de Prueba Uno";
const editedValue = "Cliente Editado 007 (cero inicial: 012)";

async function openDocumentsHome(page: Page) {
  await page.goto("/dashboard/documents");
  await expect(
    page.getByRole("heading", { name: "Escrituras", exact: true }),
  ).toBeVisible();
}

function draftRow(page: Page, title: string) {
  return page.locator("li").filter({ hasText: title });
}

test.describe("document drafts workspace", () => {
  test("A: create a template with content and one field", async ({ page }) => {
    templateName = `E2E Borrador ${Date.now()}`;
    draftTitle = `${templateName} — Borrador`;

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

  test("B: documents home offers the new-document action", async ({ page }) => {
    await openDocumentsHome(page);

    await expect(
      page
        .getByRole("link", { name: /Nueva escritura|Crear primera escritura/ })
        .first(),
    ).toBeVisible();
  });

  test("C: user can create and save a draft with preview", async ({ page }) => {
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

    // The title is pre-generated from the template name.
    await expect(page.getByLabel("Título de la escritura")).toHaveValue(
      draftTitle,
    );

    await page.getByLabel(new RegExp(fieldLabel)).fill(filledValue);
    await page.getByRole("button", { name: "Guardar borrador" }).click();

    // Saving redirects to the edit view with a confirmation. The first hit
    // compiles the route on demand while other projects run in parallel,
    // so this navigation gets a generous timeout.
    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/]+/, {
      timeout: 30_000,
    });
    await expect(
      page.getByText("Borrador guardado.", { exact: true }),
    ).toBeVisible();

    const preview = page.getByRole("region", {
      name: "Vista previa del documento",
    });
    await expect(preview).toBeVisible();
    await expect(preview.getByText(new RegExp(filledValue))).toBeVisible();
    // The undefined variable stays visible as a placeholder.
    await expect(
      preview.getByText(/\{\{vehicle\.plate\}\}/).first(),
    ).toBeVisible();
  });

  test("D: the saved draft appears in the documents list", async ({ page }) => {
    await openDocumentsHome(page);

    const row = draftRow(page, draftTitle);
    await expect(row).toBeVisible();
    await expect(row.getByText("Borrador", { exact: true })).toBeVisible();
    await expect(row.getByRole("link", { name: "Continuar" })).toBeVisible();
  });

  test("E: user can edit the draft and the preview updates", async ({
    page,
  }) => {
    await openDocumentsHome(page);
    await draftRow(page, draftTitle)
      .getByRole("link", { name: "Continuar" })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/]+/, {
      timeout: 15_000,
    });

    // Existing values are loaded into the form.
    await expect(page.getByLabel(new RegExp(fieldLabel))).toHaveValue(
      filledValue,
    );

    editedDraftTitle = `${templateName} — Editado`;
    await page.getByLabel("Título de la escritura").fill(editedDraftTitle);
    await page.getByLabel(new RegExp(fieldLabel)).fill(editedValue);
    await page.getByRole("button", { name: "Guardar borrador" }).click();

    await expect(
      page.getByText("Borrador guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    const preview = page.getByRole("region", {
      name: "Vista previa del documento",
    });
    await expect(
      preview.getByText(/Cliente Editado 007 \(cero inicial: 012\)/),
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
    await expect(page.getByLabel(new RegExp(fieldLabel))).toHaveValue(
      editedValue,
    );
    const preview = page.getByRole("region", {
      name: "Vista previa del documento",
    });
    await expect(
      preview.getByText(/Cliente Editado 007 \(cero inicial: 012\)/),
    ).toBeVisible();
  });

  test("G: an empty required field blocks saving", async ({ page }) => {
    await openDocumentsHome(page);
    await draftRow(page, editedDraftTitle)
      .getByRole("link", { name: "Continuar" })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/]+/, {
      timeout: 15_000,
    });

    await page.getByLabel(new RegExp(fieldLabel)).fill("");
    await page.getByRole("button", { name: "Guardar borrador" }).click();

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
