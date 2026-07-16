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
test.setTimeout(60_000);

const registry = new CleanupRegistry();

// Module-level state shared between serial tests in this describe block.
let createdTemplateName = "";
let editedTemplateName = "";
let templateUrl = "";

const variableLabel = "Nombre del arrendatario";
const variableKey = "arrendatario.nombre";

function contentEditor(page: Page) {
  return page.getByRole("textbox", { name: "Contenido del machote" });
}

function previewRegion(page: Page) {
  return page.getByRole("region", { name: "Vista previa" });
}

function variablesRegion(page: Page) {
  return page.getByRole("region", { name: "Variables del machote" });
}

/**
 * Espera a que el workspace esté hidratado: el editor Tiptap solo se monta
 * en cliente, así que su visibilidad garantiza que React ya responde.
 */
async function waitForWorkspace(page: Page) {
  const editorVisible = await contentEditor(page)
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);

  if (editorVisible) {
    return;
  }

  await expect(async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await contentEditor(page).waitFor({ state: "visible", timeout: 5_000 });
  }).toPass({ timeout: 20_000 });
}

test.describe("templates module", () => {
  test.afterAll(async () => {
    // La creación se hace vía UI (es lo que prueba el spec); aquí se busca
    // el registro por su nombre único y se elimina junto a sus campos.
    const finalName = editedTemplateName || createdTemplateName;
    if (finalName) {
      const id = await registerCreatedViaUi(
        registry,
        "templates",
        "name",
        finalName,
      );
      if (id) {
        // template_fields se elimina en cascada con el machote.
      }
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

  test("B: new template workspace is reachable and unified", async ({
    page,
  }) => {
    await page.goto("/dashboard/templates");

    const newTemplateLink = page
      .getByRole("link", { name: /Nuevo machote|Crear machote/ })
      .first();

    await expect(newTemplateLink).toHaveAttribute(
      "href",
      "/dashboard/templates/new",
    );
    await newTemplateLink.click();
    await expect(page).toHaveURL(/\/dashboard\/templates\/new$/, {
      timeout: 30_000,
    });

    await expect(
      page.getByRole("heading", { name: "Nuevo machote", exact: true }),
    ).toBeVisible();

    // El workspace completo está presente desde la creación: información
    // básica, editor con toolbar, variables y vista previa.
    await expect(page.getByLabel("Nombre del machote")).toBeVisible();
    await expect(
      page.getByRole("toolbar", { name: "Formato del contenido" }),
    ).toBeVisible();
    await expect(contentEditor(page)).toBeVisible();
    await expect(variablesRegion(page)).toBeVisible();
    await expect(previewRegion(page)).toBeVisible();
  });

  test("C: user can create a template with formatting and a variable", async ({
    page,
  }) => {
    createdTemplateName = uniqueName("templates", "machote");

    await page.goto("/dashboard/templates/new");
    await waitForWorkspace(page);

    await page.getByLabel("Nombre del machote").fill(createdTemplateName);
    await page.getByLabel(/[Dd]escripción/).fill("Plantilla de prueba E2E");

    // ---- contenido con formato ----
    await contentEditor(page).click();
    await page.keyboard.type("CONTRATO DE ARRENDAMIENTO. ");

    const boldButton = page.getByRole("button", { name: "Negrita" });
    await boldButton.click();
    await expect(boldButton).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.type("PRIMERO.");
    await boldButton.click();

    const italicButton = page.getByRole("button", { name: "Cursiva" });
    await italicButton.click();
    await page.keyboard.type(" En la ciudad de San José ");
    await italicButton.click();

    const underlineButton = page.getByRole("button", { name: "Subrayado" });
    await underlineButton.click();
    await page.keyboard.type("comparece");
    await underlineButton.click();
    await page.keyboard.type(" el arrendatario ");

    // ---- insertar una variable nueva desde el diálogo ----
    await page.getByRole("button", { name: "Insertar variable" }).click();
    const dialog = page.getByRole("dialog", { name: "Insertar variable" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Etiqueta").fill(variableLabel);
    await dialog.getByLabel("Clave").fill(variableKey);
    await dialog.getByRole("button", { name: "Insertar variable" }).click();
    await expect(dialog).not.toBeVisible();

    // La variable queda como ficha en el editor y configurada en el panel.
    await expect(
      contentEditor(page).getByText(variableLabel),
    ).toBeVisible();
    const variableRow = variablesRegion(page)
      .locator("li")
      .filter({ hasText: variableKey });
    await expect(variableRow.getByText("Configurada")).toBeVisible();

    // ---- marcarla obligatoria ----
    await variableRow
      .getByRole("button", { name: `Editar variable ${variableKey}` })
      .click();
    await page.getByLabel("Variable obligatoria").check();
    await page.getByRole("button", { name: "Guardar variable" }).click();
    await expect(variableRow.getByText("Obligatoria")).toBeVisible();

    // ---- preview documental ----
    await expect(
      previewRegion(page).getByText(/CONTRATO DE ARRENDAMIENTO/),
    ).toBeVisible();
    await expect(previewRegion(page).getByText(variableLabel)).toBeVisible();

    // ---- guardar ----
    await expect(page.getByText("Cambios sin guardar")).toBeVisible();
    await page.getByRole("button", { name: "Crear machote" }).click();

    await expect(page).toHaveURL(/\/dashboard\/templates\/(?!new)[^/?]+/, {
      timeout: 30_000,
    });
    await expect(
      page.getByText("Machote creado.", { exact: true }),
    ).toBeVisible();
    templateUrl = new URL(page.url()).pathname;
  });

  test("D: created template persists after reload with its variable", async ({
    page,
  }) => {
    await page.goto(templateUrl);
    await page.reload();
    await waitForWorkspace(page);

    await expect(page.getByLabel("Nombre del machote")).toHaveValue(
      createdTemplateName,
    );
    await expect(contentEditor(page)).toContainText(
      "CONTRATO DE ARRENDAMIENTO",
    );
    await expect(contentEditor(page).getByText(variableLabel)).toBeVisible();

    const variableRow = variablesRegion(page)
      .locator("li")
      .filter({ hasText: variableKey });
    await expect(variableRow.getByText("Configurada")).toBeVisible();
    await expect(variableRow.getByText("Obligatoria")).toBeVisible();
  });

  test("E: user can edit the template from the same workspace", async ({
    page,
  }) => {
    await page.goto(templateUrl);
    await waitForWorkspace(page);

    editedTemplateName = `${createdTemplateName} Editado`;

    await page.getByLabel("Nombre del machote").fill(editedTemplateName);
    await page.getByLabel("Estado").selectOption("active");

    await contentEditor(page).click();
    await page.keyboard.press("End");
    await page.keyboard.insertText(" acepta las condiciones revisadas.");

    await expect(page.getByText("Cambios sin guardar")).toBeVisible();
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(
      page.getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Guardado", { exact: true })).toBeVisible();
  });

  test("F: edited template persists after page reload", async ({ page }) => {
    await page.goto(templateUrl);
    await page.reload();
    await waitForWorkspace(page);

    await expect(page.getByLabel("Nombre del machote")).toHaveValue(
      editedTemplateName,
    );
    await expect(page.getByLabel("Estado")).toHaveValue("active");
    await expect(contentEditor(page)).toContainText(
      "acepta las condiciones revisadas.",
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

    const templateRow = page
      .locator("li")
      .filter({ hasText: editedTemplateName });
    await expect(
      templateRow.getByText("Activo", { exact: true }).first(),
    ).toBeVisible();
  });

  test("H: mobile viewport switches between edit and preview", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(templateUrl);
    await waitForWorkspace(page);

    // En móvil solo se muestra una zona a la vez.
    await expect(contentEditor(page)).toBeVisible();
    await expect(previewRegion(page)).not.toBeVisible();

    await page.getByRole("button", { name: "Vista previa" }).click();
    await expect(previewRegion(page)).toBeVisible();
    await expect(contentEditor(page)).not.toBeVisible();

    await page.getByRole("button", { name: "Editar", exact: true }).click();
    await expect(contentEditor(page)).toBeVisible();
  });

  test("I: a nonexistent template returns the not-found page", async ({
    page,
  }) => {
    await page.goto("/dashboard/templates/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText("404")).toBeVisible();
  });
});
