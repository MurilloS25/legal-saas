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

// El preview inline usa `TemplatePreviewPanel` en modo "bare" dentro del
// stepper, así que ya no expone un `role="region"` con nombre accesible
// "Vista previa" — solo el `role="group"` sin nombre de `DocumentSheet`.
// Se escopea al panel "Documento" y se excluye el otro `group` de esa zona
// (el toggle mobile Editar/Vista previa), identificándolo por su botón
// "Editar" en vez de por su nombre accesible "Vista" — así también
// funciona cuando ese grupo está oculto (`display:none` lo saca del árbol
// de accesibilidad).
function previewRegion(page: Page) {
  return page
    .locator("#template-panel-document")
    .getByRole("group")
    .filter({ hasNot: page.getByRole("button", { name: "Editar", exact: true }) });
}

function variablesRegion(page: Page) {
  return page.getByRole("region", { name: "Variables del machote" });
}

async function waitForWorkspace(page: Page) {
  // Una entrada normal desde la lista abre en "Información" — el editor
  // vive en "Documento".
  await page.getByRole("tab", { name: "Documento", exact: true }).click();
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
    // K: el diálogo ya no pregunta por "Tipo de salida estructurada" — ese
    // mapeo se configura ahora desde el Índice Notarial
    // (`OptionBlockTimeMappingEditor`), no aquí. Ver test E para la
    // cobertura completa del nuevo flujo.
    await expect(
      dialog.getByLabel("Tipo de salida estructurada"),
    ).toHaveCount(0);
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

    // El bloque se inserta con 4 variables nuevas (una por variante, más
    // dos en la segunda) — el mismo flujo del Item 1 se dispara también al
    // insertar, no solo al editar, así que hay que resolver esta
    // configuración antes de seguir interactuando con el resto de la
    // página.
    const newVariableDialog = page.getByRole("dialog", {
      name: "Configurar variables nuevas del bloque",
    });
    await expect(newVariableDialog).toBeVisible();
    await newVariableDialog.getByRole("button", { name: "Convertir" }).click();
    await expect(newVariableDialog).not.toBeVisible();

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

    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
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

    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
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

    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("E: a saved block survives reload", async ({ page }) => {
    await page.goto(templateUrl);
    await waitForWorkspace(page);

    const dialog = await openInsertDialog(page);
    await dialog.getByLabel("Nombre del bloque").fill("Hora");
    await dialog.getByLabel("Etiqueta de variante").fill("Hora en punto");
    await dialog
      .getByLabel("Contenido de variante")
      .fill("a las {{hora.valor}} horas");
    await dialog.getByLabel("Variante predeterminada").check();
    await dialog.getByRole("button", { name: "Agregar variante" }).click();
    await dialog
      .getByLabel("Etiqueta de variante")
      .nth(1)
      .fill("Hora y minutos");
    await dialog
      .getByLabel("Contenido de variante")
      .nth(1)
      .fill("a las {{hora.valor}} horas con {{hora.minutos}} minutos");
    await dialog.getByRole("button", { name: "Insertar bloque" }).click();
    await expect(dialog).not.toBeVisible();

    const newVariableDialog = page.getByRole("dialog", {
      name: "Configurar variables nuevas del bloque",
    });
    await expect(newVariableDialog).toBeVisible();
    await newVariableDialog.getByRole("button", { name: "Convertir" }).click();
    await expect(newVariableDialog).not.toBeVisible();

    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    // "Guardar y continuar" avanza al siguiente paso (Variables) — vuelve a
    // Documento para poder ver el chip, que sigue montado pero oculto.
    await page.getByRole("tab", { name: "Documento", exact: true }).click();
    await expect(
      contentEditor(page).getByText("Bloque: Hora"),
    ).toBeVisible();
  });

  // El mapeo Hora/Minutos ya no se configura en el diálogo del bloque — se
  // configura desde el Índice Notarial (`OptionBlockTimeMappingEditor`),
  // que escribe en vivo sobre el mismo documento del editor y persiste con
  // el guardado normal del Machote, no con un RPC propio. Corre después de
  // E porque depende del bloque "Hora" que esa prueba deja guardado.
  test("F: the Índice Notarial's Hora de autorización configures and persists the option block's hour/minute mapping", async ({
    page,
  }) => {
    await page.goto(templateUrl);
    await page.getByRole("tab", { name: "Índice", exact: true }).click();
    const configSection = page.getByRole("region", {
      name: "Configuración del índice notarial",
    });
    await expect(configSection).toBeVisible();

    await page.locator("#idx-authorized_time-trigger").click();
    await configSection
      .getByLabel("Variable sugerida")
      .selectOption({ label: "Hora" });

    const mappingEditor = configSection.getByRole("group", {
      name: /Hora de otorgamiento — Hora/,
    });
    await expect(mappingEditor).toBeVisible();

    await mappingEditor
      .getByLabel("Hora", { exact: true })
      .nth(0)
      .selectOption("hora.valor");
    await mappingEditor
      .getByLabel("Minutos", { exact: true })
      .nth(0)
      .selectOption("__zero__");
    await mappingEditor
      .getByLabel("Hora", { exact: true })
      .nth(1)
      .selectOption("hora.valor");
    await mappingEditor
      .getByLabel("Minutos", { exact: true })
      .nth(1)
      .selectOption("hora.minutos");
    await mappingEditor
      .getByRole("button", { name: "Aplicar mapeo de hora" })
      .click();
    await expect(
      mappingEditor.getByText(/Aplicado al machote/),
    ).toBeVisible();

    // El RPC de guardado del Índice exige que el bloque YA tenga
    // `structuredOutput.type: "time"` persistido en `content_json` antes de
    // poder seleccionarlo como fuente (ver
    // `save_template_index_mapping_with_block_source` — `option_block_not_found`
    // si no) — el orden real es: aplicar el mapeo, guardar el MACHOTE
    // primero, y solo entonces guardar la configuración del Índice.
    await page.getByRole("tab", { name: "Documento", exact: true }).click();
    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("tab", { name: "Índice", exact: true }).click();
    await expect(configSection).toBeVisible();
    await page.locator("#idx-authorized_time-trigger").click();
    await expect(
      configSection.getByText(/todavía no tiene mapeo de hora guardado/),
    ).toHaveCount(0);

    // El formulario de configuración del Índice es uno solo para todos sus
    // campos: "Partes" sin resolver (ni variables ni confirmación vacía)
    // bloquea el guardado completo, sin relación con lo que esta prueba
    // cubre — se confirma vacío para poder aislar la parte que sí importa.
    await page.locator("#idx-parties-trigger").click();
    await configSection
      .getByLabel("Confirmo que este machote no requiere Partes para el índice.")
      .check();

    await configSection
      .getByRole("button", { name: "Guardar configuración" })
      .click();
    await expect(page.getByText("Configuración guardada.")).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await page.getByRole("tab", { name: "Índice", exact: true }).click();
    await expect(configSection).toBeVisible();
    await page.locator("#idx-authorized_time-trigger").click();
    await expect(configSection.getByLabel("Variable sugerida")).toHaveValue(
      /^block:/,
    );

    const reloadedMappingEditor = configSection.getByRole("group", {
      name: /Hora de otorgamiento — Hora/,
    });
    await expect(reloadedMappingEditor).toBeVisible();
    await expect(
      reloadedMappingEditor.getByLabel("Hora", { exact: true }).nth(0),
    ).toHaveValue("hora.valor");
    await expect(
      reloadedMappingEditor.getByLabel("Minutos", { exact: true }).nth(1),
    ).toHaveValue("hora.minutos");
  });

  // Item 1 del ajuste de PR #189: escribir una variable nueva dentro de una
  // variante de un Bloque de opciones y guardar el bloque debe ofrecer de
  // inmediato el mismo flujo de configuración que las variables detectadas
  // en texto pegado — sin obligar a ir aparte al paso Variables.
  test("G: saving an option block variant with a brand-new variable immediately opens its configuration, reusing the pasted-variable review flow", async ({
    page,
  }) => {
    await page.goto(templateUrl);
    await waitForWorkspace(page);

    await contentEditor(page).getByText("Bloque: Hora").click();
    await page.getByRole("button", { name: "Editar bloque" }).click();
    const editDialog = page.getByRole("dialog", { name: "Editar bloque de opciones" });
    await expect(editDialog).toBeVisible();

    // Agrega una variable nueva ("lugar.ciudad") a la primera variante,
    // junto a la ya configurada "hora.valor".
    await editDialog
      .getByLabel("Contenido de variante")
      .nth(0)
      .fill("a las {{hora.valor}} horas en {{lugar.ciudad}}");
    await editDialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(editDialog).not.toBeVisible();

    // El bloque se guarda de inmediato (no hay modal por cada "}}" mientras
    // se escribe) y solo AL GUARDAR el bloque se abre la configuración de
    // la variable nueva detectada.
    const newVariableDialog = page.getByRole("dialog", {
      name: "Configurar variables nuevas del bloque",
    });
    await expect(newVariableDialog).toBeVisible();
    await expect(
      newVariableDialog.getByLabel("Incluir variable lugar.ciudad"),
    ).toBeChecked();
    // "hora.valor" ya estaba configurada — no se vuelve a pedir.
    await expect(
      newVariableDialog.getByLabel(/Incluir variable hora\.valor/),
    ).toHaveCount(0);

    await newVariableDialog.getByRole("button", { name: "Convertir" }).click();
    await expect(newVariableDialog).not.toBeVisible();

    // El bloque sigue ahí con el contenido nuevo, y la variable queda
    // configurada de inmediato (mismo camino que "Insertar variable").
    await expect(
      contentEditor(page).getByText("Bloque: Hora"),
    ).toBeVisible();
    await goToVariablesTab(page);
    const cityRow = variablesRegion(page)
      .locator("li")
      .filter({ hasText: "lugar.ciudad" });
    await expect(cityRow.getByText("Configurada")).toBeVisible();

    await page.getByRole("tab", { name: "Documento", exact: true }).click();
    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });

  // Cancelar la configuración no debe perder el bloque ni las variables ya
  // guardadas en el documento — quedan pendientes de configurar, igual que
  // cualquier otra variable sin configuración.
  test("H: canceling the new-variable configuration keeps the option block and content, leaving the variable pending instead of lost", async ({
    page,
  }) => {
    await page.goto(templateUrl);
    await waitForWorkspace(page);

    await contentEditor(page).getByText("Bloque: Hora").click();
    await page.getByRole("button", { name: "Editar bloque" }).click();
    const editDialog = page.getByRole("dialog", { name: "Editar bloque de opciones" });
    await editDialog
      .getByLabel("Contenido de variante")
      .nth(0)
      .fill("a las {{hora.valor}} horas en {{lugar.provincia}}");
    await editDialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(editDialog).not.toBeVisible();

    const newVariableDialog = page.getByRole("dialog", {
      name: "Configurar variables nuevas del bloque",
    });
    await expect(newVariableDialog).toBeVisible();
    await newVariableDialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(newVariableDialog).not.toBeVisible();

    // El bloque y el nuevo texto de la variante se conservan.
    await expect(
      contentEditor(page).getByText("Bloque: Hora"),
    ).toBeVisible();
    await goToVariablesTab(page);
    const provinceRow = variablesRegion(page)
      .locator("li")
      .filter({ hasText: "lugar.provincia" });
    await expect(
      provinceRow.getByText("Pendiente de configurar"),
    ).toBeVisible();
  });

  // ---------------------------------------------------------------------
  // Cada variante tiene su propio botón "Insertar variable" (reutiliza el
  // mismo diálogo que la barra de herramientas principal) para no depender
  // de escribir `{{clave}}` a mano — insertar sigue funcionando también.
  // ---------------------------------------------------------------------

  test("I: the per-variant 'Insertar variable' button inserts an existing variable at the cursor, without asking to configure it again", async ({
    page,
  }) => {
    await page.goto(templateUrl);
    await waitForWorkspace(page);

    const dialog = await openInsertDialog(page);
    await dialog.getByLabel("Nombre del bloque").fill("Bloque I");
    await dialog.getByLabel("Etiqueta de variante").fill("V1");

    // Deja el cursor justo después de "A las " (6 caracteres) para
    // confirmar que la inserción respeta la posición, no solo el final.
    const before = "A las ";
    const after = " horas";
    const contentField = dialog.getByLabel("Contenido de variante");
    await contentField.fill(before + after);
    await contentField.click();
    await page.keyboard.press("Home");
    for (let i = 0; i < before.length; i++) {
      await page.keyboard.press("ArrowRight");
    }

    await dialog.getByRole("button", { name: "Insertar variable" }).click();
    const insertVarDialog = page.getByRole("dialog", { name: "Insertar variable" });
    await expect(insertVarDialog).toBeVisible();
    // "hora.valor" ya está configurada (test E) — se elige de la lista, no
    // se vuelve a crear.
    await insertVarDialog
      .locator("li")
      .filter({ hasText: "hora.valor" })
      .getByRole("button")
      .click();
    await expect(insertVarDialog).not.toBeVisible();
    await expect(contentField).toHaveValue("A las {{hora.valor}} horas");

    await dialog.getByRole("button", { name: "Insertar bloque" }).click();
    await expect(dialog).not.toBeVisible();
    // Ninguna clave nueva: el diálogo de revisión post-guardado no debe
    // abrirse.
    await expect(
      page.getByRole("dialog", { name: "Configurar variables nuevas del bloque" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("J: the per-variant 'Insertar variable' button can create a new variable with full configuration (required + output transform) in one step", async ({
    page,
  }) => {
    await page.goto(templateUrl);
    await waitForWorkspace(page);

    await contentEditor(page).getByText("Bloque: Hora").click();
    await page.getByRole("button", { name: "Editar bloque" }).click();
    const editDialog = page.getByRole("dialog", { name: "Editar bloque de opciones" });
    await expect(editDialog).toBeVisible();

    const contentField = editDialog.getByLabel("Contenido de variante").nth(1);
    await contentField.click();
    await page.keyboard.press("End");
    await editDialog.getByRole("button", { name: "Insertar variable" }).nth(1).click();

    const insertVarDialog = page.getByRole("dialog", { name: "Insertar variable" });
    await expect(insertVarDialog).toBeVisible();
    await insertVarDialog.getByLabel("Clave").fill("hora.segundos");
    await insertVarDialog.getByLabel("Etiqueta").fill("Segundos");
    await insertVarDialog.getByLabel("Variable obligatoria").check();
    await insertVarDialog
      .getByLabel("Transformación de salida")
      .selectOption("digits_to_words");
    await insertVarDialog.getByRole("button", { name: "Insertar variable" }).click();
    await expect(insertVarDialog).not.toBeVisible();
    await expect(contentField).toHaveValue(/\{\{hora\.segundos\}\}$/);

    await editDialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(editDialog).not.toBeVisible();
    // Ya quedó configurada al crearla desde el botón — el diálogo de
    // revisión post-guardado no debe pedirla otra vez.
    await expect(
      page.getByRole("dialog", { name: "Configurar variables nuevas del bloque" }),
    ).toHaveCount(0);

    await goToVariablesTab(page);
    const secondsRow = variablesRegion(page)
      .locator("li")
      .filter({ hasText: "hora.segundos" });
    await expect(secondsRow.getByText("Configurada")).toBeVisible();
    await expect(secondsRow.getByText("Obligatoria")).toBeVisible();
    await expect(secondsRow.getByText("Dígitos en palabras")).toBeVisible();

    await page.getByRole("tab", { name: "Documento", exact: true }).click();
    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
