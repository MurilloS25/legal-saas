import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestTemplate,
  createTestTemplateField,
  runCleanup,
  uniqueName,
} from "./support/factories";

/**
 * Variables del machote en el workspace unificado.
 *
 * Cubre la carga de machotes legacy (texto con {{variables}}), los estados
 * Configurada / Pendiente de configurar / No utilizada y la administración
 * de la configuración desde el panel.
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const templateName = uniqueName("template-fields", "machote");
let templateUrl = "";

const configuredKey = "buyer_1.full_name";
const configuredLabel = "Comprador 1 - Nombre completo";
const pendingKey = "vehicle.plate";
const pendingLabel = "Placa del vehículo";

function contentEditor(page: Page) {
  return page.getByRole("textbox", { name: "Contenido del machote" });
}

function variablesRegion(page: Page) {
  return page.getByRole("region", { name: "Variables del machote" });
}

function variableRow(page: Page, key: string) {
  return variablesRegion(page).locator("li").filter({ hasText: key });
}

/**
 * Abre el workspace y espera a que esté hidratado: el editor Tiptap solo se
 * monta en cliente, así que su visibilidad garantiza que los handlers de
 * React ya responden.
 */
async function openWorkspace(page: Page) {
  await expect(async () => {
    await page.goto(templateUrl);
    await expect(contentEditor(page)).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 20_000 });
}

test.describe("template variables workspace", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "template-fields");
  });

  test("A: a legacy template loads converted with unified variable states", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: templateName,
      content:
        "COMPRAVENTA DE PRUEBA. El comprador {{buyer_1.full_name}} adquiere el vehículo placa {{vehicle.plate}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: configuredKey,
      label: configuredLabel,
      required: true,
    });
    templateUrl = `/dashboard/templates/${template.id}`;

    await openWorkspace(page);

    // El contenido legacy se convierte: el texto y las fichas de variables
    // aparecen en el editor enriquecido.
    await expect(contentEditor(page)).toContainText("COMPRAVENTA DE PRUEBA");
    await expect(
      contentEditor(page).getByText(configuredLabel),
    ).toBeVisible();

    // Estados unificados: configurada y usada vs. pendiente de configurar.
    await expect(
      variableRow(page, configuredKey).getByText("Configurada"),
    ).toBeVisible();
    await expect(
      variableRow(page, pendingKey).getByText("Pendiente de configurar"),
    ).toBeVisible();
  });

  test("B: a pending variable can be configured and persists", async ({
    page,
  }) => {
    await openWorkspace(page);

    await variableRow(page, pendingKey)
      .getByRole("button", { name: `Configurar variable ${pendingKey}` })
      .click();
    await page.getByLabel("Etiqueta").fill(pendingLabel);
    await page.getByLabel("Variable obligatoria").check();
    await page.getByRole("button", { name: "Guardar variable" }).click();

    await expect(
      variableRow(page, pendingKey).getByText("Configurada"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    const row = variableRow(page, pendingKey);
    await expect(row.getByText(pendingLabel)).toBeVisible();
    await expect(row.getByText("Configurada")).toBeVisible();
    await expect(row.getByText("Obligatoria")).toBeVisible();
  });

  test("C: an invalid variable key shows a visible validation error", async ({
    page,
  }) => {
    await openWorkspace(page);

    await page.getByRole("button", { name: "Insertar variable" }).click();
    const dialog = page.getByRole("dialog", { name: "Insertar variable" });
    await dialog.getByLabel("Etiqueta").fill("Clave inválida");
    await dialog.getByLabel("Clave").fill("Clave Con Espacios");
    await dialog.getByRole("button", { name: "Insertar variable" }).click();

    await expect(
      dialog.getByText(/Usa minúsculas, números, guion bajo/),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
  });

  test("D: removing a variable from the content keeps its configuration", async ({
    page,
  }) => {
    await openWorkspace(page);

    // Reemplaza todo el contenido por texto sin la variable configurada.
    await contentEditor(page).click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(
      "COMPRAVENTA ACTUALIZADA sin variables en el texto.",
    );

    // La configuración no se borra: la variable pasa a "No utilizada".
    await expect(
      variableRow(page, configuredKey).getByText("No utilizada"),
    ).toBeVisible();
    await expect(
      variableRow(page, pendingKey).getByText("No utilizada"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(
      variableRow(page, configuredKey).getByText("No utilizada"),
    ).toBeVisible();
    await expect(
      variableRow(page, configuredKey).getByText(configuredLabel),
    ).toBeVisible();
  });

  test("E: the user can explicitly remove a variable configuration", async ({
    page,
  }) => {
    await openWorkspace(page);

    await variableRow(page, pendingKey)
      .getByRole("button", {
        name: `Quitar configuración de ${pendingKey}`,
      })
      .click();

    await expect(variableRow(page, pendingKey)).not.toBeVisible();

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(variableRow(page, pendingKey)).not.toBeVisible();
    // La otra configuración sigue intacta.
    await expect(
      variableRow(page, configuredKey).getByText(configuredLabel),
    ).toBeVisible();
  });
});
