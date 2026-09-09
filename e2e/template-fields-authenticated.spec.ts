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

  test("B: 'Guardar variable' applies the edit locally (marks the workspace dirty); the single global 'Guardar' persists it", async ({
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

    // "Guardar variable" ya no persiste por su cuenta (guardado único): solo
    // aplica el cambio al estado local, igual que cualquier otra edición —
    // la fila ya se ve "Configurada" y el workspace queda con cambios sin
    // guardar hasta el botón "Guardar" global.
    await expect(
      variableRow(page, pendingKey).getByText("Configurada"),
    ).toBeVisible();
    await expect(page.locator('p[role="status"]')).toHaveText(
      "Sin guardar",
      { timeout: 5_000 },
    );

    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.locator('p[role="status"]')).toHaveText("Guardado", {
      timeout: 15_000,
    });

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

  // El contenido es la única fuente de verdad de qué variables existen
  // (ver TemplateWorkspace.tsx): a diferencia del estado "No utilizada" que
  // existía antes, quitar la ÚLTIMA referencia de una variable poda su
  // configuración por completo — no se conserva huérfana — y recrear la
  // misma clave más tarde se comporta como una variable nueva, sin
  // resucitar la etiqueta ni la configuración previas.
  test("D: removing a variable's last reference prunes its configuration, and recreating the same key later starts fresh", async ({
    page,
  }) => {
    await openWorkspace(page);

    // Reemplaza todo el contenido por texto sin ninguna variable.
    await contentEditor(page).click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(
      "COMPRAVENTA ACTUALIZADA sin variables en el texto.",
    );

    await goToVariablesTab(page);
    await expect(variableRow(page, configuredKey)).not.toBeVisible();
    await expect(variableRow(page, pendingKey)).not.toBeVisible();

    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    // La poda persiste — no es solo un efecto visual local.
    await page.reload();
    await goToVariablesTab(page);
    await expect(variableRow(page, configuredKey)).not.toBeVisible();

    // Recrear la misma clave más tarde: aparece como pendiente, sin la
    // etiqueta ni la configuración que tenía antes de podarse.
    await page.getByRole("tab", { name: "Documento", exact: true }).click();
    await contentEditor(page).click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(`Referencia otra vez a {{${configuredKey}}}.`);

    await goToVariablesTab(page);
    const recreatedRow = variableRow(page, configuredKey);
    await expect(
      recreatedRow.getByText("Pendiente de configurar"),
    ).toBeVisible();
    await expect(recreatedRow.getByText(configuredLabel)).toHaveCount(0);

    // Deja este estado guardado — E parte de aquí (todavía referenciada,
    // todavía sin configurar).
    await page.getByRole("tab", { name: "Documento", exact: true }).click();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });

  // "Quitar configuración" es distinto de quitar la última referencia: la
  // variable sigue en el contenido, así que vuelve a "Pendiente de
  // configurar" en vez de desaparecer.
  test("E: the user can explicitly remove a variable's configuration while it's still referenced, and it becomes pending again", async ({
    page,
  }) => {
    await openWorkspace(page);

    // D dejó `configuredKey` referenciado en el contenido pero sin
    // configuración (podada y recreada) — la configura de nuevo para tener
    // algo "Configurada" que remover explícitamente.
    await goToVariablesTab(page);
    await variableRow(page, configuredKey)
      .getByRole("button", { name: `Configurar variable ${configuredKey}` })
      .click();
    await variableRow(page, configuredKey)
      .getByLabel("Etiqueta")
      .fill(configuredLabel);
    await variableRow(page, configuredKey)
      .getByRole("button", { name: "Guardar variable" })
      .click();
    await expect(
      variableRow(page, configuredKey).getByText("Configurada"),
    ).toBeVisible();

    await variableRow(page, configuredKey)
      .getByRole("button", { name: `Quitar configuración de ${configuredKey}` })
      .click();

    await expect(
      variableRow(page, configuredKey).getByText("Pendiente de configurar"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await goToVariablesTab(page);
    await expect(
      variableRow(page, configuredKey).getByText("Pendiente de configurar"),
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
    // "Guardar variable" solo aplica el cambio localmente — el guardado
    // único (botón "Guardar" global) es lo que persiste.
    await page.getByRole("button", { name: "Guardar" }).click();
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

  // "Insertar variable" pide obligatoriedad y transformación de salida
  // directamente al crear — ya no hace falta el ida y vuelta de crearla,
  // ir al paso Variables, buscarla y editarla para configurar lo mismo que
  // el resto de los flujos (pegado, Bloques de opciones) ya piden de una.
  test("G: 'Insertar variable' configures required and output transform at creation time, with no separate edit step needed", async ({
    page,
  }) => {
    const newKey = "vendedor.identificacion";
    const newLabel = "Vendedor - Identificación";

    await openWorkspace(page);
    await page.getByRole("button", { name: "Insertar variable" }).click();
    const dialog = page.getByRole("dialog", { name: "Insertar variable" });
    await dialog.getByLabel("Clave").fill(newKey);
    await dialog.getByLabel("Etiqueta").fill(newLabel);
    await dialog.getByLabel("Variable obligatoria").check();
    await dialog
      .getByLabel("Transformación de salida")
      .selectOption("digits_to_words");
    await dialog.getByRole("button", { name: "Insertar variable" }).click();
    await expect(dialog).not.toBeVisible();

    await goToVariablesTab(page);
    const row = variableRow(page, newKey);
    await expect(row.getByText("Configurada")).toBeVisible();
    await expect(row.getByText("Obligatoria")).toBeVisible();
    await expect(row.getByText("Dígitos en palabras")).toBeVisible();

    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await goToVariablesTab(page);
    const reloadedRow = variableRow(page, newKey);
    await expect(reloadedRow.getByText("Obligatoria")).toBeVisible();
    await expect(reloadedRow.getByText("Dígitos en palabras")).toBeVisible();
  });
});
