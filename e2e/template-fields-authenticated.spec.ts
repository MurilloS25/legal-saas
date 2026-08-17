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

async function goToVariablesTab(page: Page) {
  await page.getByRole("tab", { name: "Variables" }).click();
  await expect(variablesRegion(page)).toBeVisible();
}

/**
 * Abre el workspace y espera a que esté hidratado: el editor Tiptap solo se
 * monta en cliente, así que su visibilidad garantiza que los handlers de
 * React ya responden.
 */
async function openWorkspace(page: Page) {
  await expect(async () => {
    await page.goto(templateUrl);
    // Una entrada normal desde la lista abre en "Información" — el editor
    // vive en "Documento".
    await page.getByRole("tab", { name: "Documento", exact: true }).click();
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
    await goToVariablesTab(page);
    await expect(
      variableRow(page, configuredKey).getByText("Configurada"),
    ).toBeVisible();
    await expect(
      variableRow(page, pendingKey).getByText("Pendiente de configurar"),
    ).toBeVisible();
  });

  test("B: 'Guardar variable' persists a pending variable immediately, with no separate 'Guardar y continuar' click needed", async ({
    page,
  }) => {
    await openWorkspace(page);
    await goToVariablesTab(page);

    await variableRow(page, pendingKey)
      .getByRole("button", { name: `Configurar variable ${pendingKey}` })
      .click();
    await page.getByLabel("Etiqueta").fill(pendingLabel);
    await page.getByLabel("Variable obligatoria").check();
    await page.getByRole("button", { name: "Guardar variable" }).click();

    await expect(
      variableRow(page, pendingKey).getByText("Configurada"),
    ).toBeVisible();
    // "Guardar variable" ya envió el formulario: sin un segundo clic en
    // "Guardar y continuar", el estado vuelve a "Guardado". "Guardar
    // variable" nunca avanza de paso (solo el botón principal lo hace), así
    // que seguimos en "Variables" tras el guardado.
    await expect(page.locator('p[role="status"]')).toHaveText("Guardado", {
      timeout: 15_000,
    });

    // Recargar ya debe mostrar la variable persistida — no fue necesario
    // ningún clic adicional en "Guardar y continuar".
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
    await goToVariablesTab(page);
    await expect(
      variableRow(page, configuredKey).getByText("No utilizada"),
    ).toBeVisible();
    await expect(
      variableRow(page, pendingKey).getByText("No utilizada"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    // Guardar desde "Variables" avanza automáticamente a "Índice"; hay que
    // volver explícitamente a "Variables" antes de revisar su contenido.
    await page.reload();
    await goToVariablesTab(page);
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
    await goToVariablesTab(page);

    await variableRow(page, pendingKey)
      .getByRole("button", {
        name: `Quitar configuración de ${pendingKey}`,
      })
      .click();

    await expect(variableRow(page, pendingKey)).not.toBeVisible();

    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    // Guardar desde "Variables" avanza automáticamente a "Índice"; hay que
    // volver explícitamente a "Variables" antes de revisar su contenido.
    await page.reload();
    await goToVariablesTab(page);
    await expect(variableRow(page, pendingKey)).not.toBeVisible();
    // La otra configuración sigue intacta.
    await expect(
      variableRow(page, configuredKey).getByText(configuredLabel),
    ).toBeVisible();
  });

  test("F: the automatic autofill suggestion is informational (not editable), and configuring output transform persists after reload", async ({
    page,
  }) => {
    const newKey = "comprador.cedula";
    const newLabel = "Comprador - Cédula";

    await openWorkspace(page);
    await page.getByRole("button", { name: "Insertar variable" }).click();
    const dialog = page.getByRole("dialog", { name: "Insertar variable" });
    await dialog.getByLabel("Etiqueta").fill(newLabel);
    await dialog.getByLabel("Clave").fill(newKey);
    await dialog.getByRole("button", { name: "Insertar variable" }).click();

    // Insertar una variable nueva la configura de inmediato (con la
    // sugerencia automática por "cedula" ya aplicada), así que aparece como
    // "Configurada" y no como pendiente.
    await goToVariablesTab(page);
    await expect(
      variableRow(page, newKey).getByText("Configurada"),
    ).toBeVisible();
    await expect(
      variableRow(page, newKey).getByText(
        "Autollenado: Identificación del Cliente",
      ),
    ).toBeVisible();

    await variableRow(page, newKey)
      .getByRole("button", { name: `Editar variable ${newKey}` })
      .click();

    // No hay selector de "Origen para autollenado": ya no es configurable
    // desde la UI, la inferencia automática es la única fuente.
    await expect(page.getByLabel("Origen para autollenado")).toHaveCount(0);

    await page
      .getByLabel("Transformación de salida")
      .selectOption("digits_to_words");
    await page.getByRole("button", { name: "Guardar variable" }).click();

    await expect(
      variableRow(page, newKey).getByText("Dígitos en palabras"),
    ).toBeVisible();
    // Persistido de inmediato, sin un segundo clic en "Guardar y continuar".
    await expect(page.locator('p[role="status"]')).toHaveText("Guardado", {
      timeout: 15_000,
    });

    await page.reload();
    const row = variableRow(page, newKey);
    await expect(
      row.getByText("Autollenado: Identificación del Cliente"),
    ).toBeVisible();
    await expect(row.getByText("Dígitos en palabras")).toBeVisible();
  });
});
