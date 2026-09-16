import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestTemplate,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";

/**
 * Detección de variables `{{clave}}` escritas o pegadas en el editor del
 * machote.
 *
 * Escribir un `{{clave}}` válido (minúsculas) sigue convirtiendo de
 * inmediato, sin diálogo — igual que siempre. Pegar es distinto: TODO
 * `{{...}}` pegado, sea cual sea su mayúscula/minúscula, pasa por el
 * diálogo "Revisar variables detectadas" antes de convertirse — no hay
 * conversión silenciosa al pegar, ni siquiera para claves ya en minúsculas.
 * El diálogo expone la misma configuración que una variable creada a mano
 * (etiqueta, clave, obligatoria, transformación de salida), así que al
 * confirmar queda "Configurada" de inmediato, no "Pendiente de configurar".
 *
 * La prueba de escritura a mano (I) corre al final a propósito: es la única
 * que deja el editor en un estado alcanzado por teclado en vez de por el
 * `paste` sintético que usan las demás — mantenerla al final evita mezclar
 * ambos mecanismos sobre el mismo documento en crecimiento.
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();
const templateName = uniqueName("pasted-vars", "machote");
let templateUrl = "";

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
 * Abre el workspace del machote en el paso "Documento" — una entrada
 * normal desde la lista abre en "Información", así que el editor necesita
 * este clic explícito antes de poder interactuar con él.
 */
async function openWorkspace(page: Page) {
  await page.goto(templateUrl);
  await page.getByRole("tab", { name: "Documento", exact: true }).click();
  await expect(contentEditor(page)).toBeVisible();
}

// El preview inline usa `TemplatePreviewPanel` en modo "bare" dentro del
// stepper, así que ya no expone un `role="region"` con nombre accesible
// "Vista previa" — solo el `role="group"` sin nombre de `DocumentSheet`.
// Se escopea al panel "Documento" y se excluye el otro `group` de esa zona
// (el toggle mobile Editar/Vista previa), identificándolo por su botón
// "Editar" en vez de por su nombre accesible "Vista".
function previewRegion(page: Page) {
  return page
    .locator("#template-panel-document")
    .getByRole("group")
    .filter({ hasNot: page.getByRole("button", { name: "Editar", exact: true }) });
}

function notarialIndexRegion(page: Page) {
  return page.getByRole("region", { name: "Configuración del índice notarial" });
}

function reviewDialog(page: Page) {
  return page.getByRole("dialog", { name: "Revisar variables detectadas" });
}

async function goToTab(
  page: Page,
  name: "Documento" | "Variables" | "Índice",
) {
  await page.getByRole("tab", { name, exact: true }).click();
}

/**
 * Expande la fila colapsable del campo simple `key` dentro de la sección de
 * configuración del Índice Notarial (`idx-<key>`) — desde la reorganización
 * en filas de acordeón, el `<select>` de cada campo solo se monta mientras
 * su fila está abierta.
 */
async function openIndexRow(page: Page, key: string) {
  await page.locator(`#idx-${key}-trigger`).click();
}

/**
 * Simula pegar `text` al final del contenido mediante un evento `paste`
 * sintético — la misma mecánica que dispara un pegado real del portapapeles
 * del sistema operativo, que Playwright no puede invocar directamente en
 * este entorno.
 */
async function pasteAtEnd(page: Page, text: string) {
  // Coloca el cursor con interacción real del navegador (clic + teclado) en
  // vez de la Selection API: ProseMirror sincroniza su selección interna vía
  // el evento nativo `selectionchange`, que es asíncrono. Fijar la selección
  // por Range API y despachar el `paste` en el mismo tick de JS deja
  // ProseMirror con la selección anterior — el evento `paste` sintético en
  // sí sigue siendo necesario porque Playwright no puede invocar el
  // portapapeles real del sistema operativo en este entorno.
  await contentEditor(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.evaluate((pasted) => {
    const editor = document.querySelector(".ProseMirror");
    if (!editor) throw new Error("editor not found");
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", pasted);
    const event = new ClipboardEvent("paste", {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true,
    });
    editor.dispatchEvent(event);
  }, text);
}

test.describe("template pasted/typed variable detection", () => {
  test.afterAll(async () => {
    const id = await registerCreatedViaUi(
      registry,
      "templates",
      "name",
      templateName,
    );
    if (id) {
      // template_fields se elimina en cascada con el machote.
    }
    await runCleanup(registry, "pasted-vars");
  });

  test("A: seed a template with plain content", async () => {
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "CONTRATO. ",
    });
    templateUrl = `/dashboard/templates/${template.id}`;
  });

  test("B: pasting an invalid placeholder leaves it as plain text, no dialog", async ({
    page,
  }) => {
    await openWorkspace(page);

    await pasteAtEnd(page, " {{Clave Invalida}}");

    // No hay candidatas: el diálogo ni siquiera aparece, y el texto queda
    // literal para que el usuario lo corrija a mano.
    await expect(reviewDialog(page)).toHaveCount(0);
    await expect(
      contentEditor(page).locator('[data-variable-key]'),
    ).toHaveCount(0);
    await expect(contentEditor(page)).toContainText("{{Clave Invalida}}");
  });

  test("C: pasting placeholders in any case — lowercase, uppercase or mixed — always opens the review dialog, never converts silently", async ({
    page,
  }) => {
    await openWorkspace(page);

    // Mezcla deliberada: minúsculas (ya válidas hoy sin diálogo antes de
    // este fix), mayúsculas con guion bajo, una clave con punto en
    // mayúsculas, y un token con dos puntos que no es una variable
    // reconocida (`SMART:`).
    await pasteAtEnd(
      page,
      "Comparecen {{comprador.nombre}} y {{VENDEDOR_NOMBRE}}, folio " +
        "{{Folio.Inicio}}, bloque {{SMART:block_fda924b2}}.",
    );

    // Nada se convierte todavía: el texto pegado sigue literal en el
    // documento mientras el diálogo está abierto.
    await expect(
      contentEditor(page).locator('[data-variable-key]'),
    ).toHaveCount(0);

    const dialog = reviewDialog(page);
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("Se detectaron 3 posibles variables"),
    ).toBeVisible();
    await expect(dialog.getByText("{{comprador.nombre}}")).toBeVisible();
    await expect(dialog.getByText("{{VENDEDOR_NOMBRE}}")).toBeVisible();
    await expect(dialog.getByText("{{Folio.Inicio}}")).toBeVisible();
    // El token con dos puntos no es una variable reconocida: no aparece en
    // la lista de candidatas del diálogo.
    await expect(dialog.getByText("SMART:block")).toHaveCount(0);

    await dialog.getByRole("button", { name: "Convertir" }).click();
    await expect(dialog).toBeHidden();

    // Las tres, sin importar el caso original, quedan como fichas reales
    // con la clave normalizada en minúsculas.
    await expect(
      contentEditor(page).locator('[data-variable-key="comprador.nombre"]'),
    ).toBeVisible();
    await expect(
      contentEditor(page).locator('[data-variable-key="vendedor_nombre"]'),
    ).toBeVisible();
    await expect(
      contentEditor(page).locator('[data-variable-key="folio.inicio"]'),
    ).toBeVisible();
    await expect(contentEditor(page)).toContainText(
      "{{SMART:block_fda924b2}}",
    );

    // La clave/etiqueta confirmadas en el diálogo son la configuración
    // real: las tres quedan "Configurada" de inmediato, no "Pendiente de
    // configurar" — nunca se crean dos variables distintas para el mismo
    // dato solo por diferencias de mayúsculas.
    await goToTab(page, "Variables");
    await expect(
      variableRow(page, "comprador.nombre").getByText("Configurada"),
    ).toBeVisible();
    await expect(
      variableRow(page, "vendedor_nombre").getByText("Configurada"),
    ).toBeVisible();
    await expect(
      variableRow(page, "vendedor_nombre").getByText("Vendedor nombre"),
    ).toBeVisible();
    await expect(
      variableRow(page, "folio.inicio").getByText("Configurada"),
    ).toBeVisible();
  });

  test("D: canceling the review dialog leaves the pasted text unmodified", async ({
    page,
  }) => {
    await openWorkspace(page);

    await pasteAtEnd(page, "Tomo {{tomo_numero}} folio {{FOLIO_INICIAL}}.");

    const dialog = reviewDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();

    await expect(
      contentEditor(page).locator(
        '[data-variable-key="tomo_numero"], [data-variable-key="folio_inicial"]',
      ),
    ).toHaveCount(0);
    await expect(contentEditor(page)).toContainText(
      "Tomo {{tomo_numero}} folio {{FOLIO_INICIAL}}.",
    );
  });

  test("E: excluding a candidate in the review dialog keeps it as literal text", async ({
    page,
  }) => {
    await openWorkspace(page);

    await pasteAtEnd(page, "Marca {{MARCA}} combustible {{COMBUSTIBLE}}.");

    const dialog = reviewDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("checkbox", { name: "Incluir variable MARCA" }).uncheck();
    await dialog.getByRole("button", { name: "Convertir" }).click();
    await expect(dialog).toBeHidden();

    await expect(
      contentEditor(page).locator('[data-variable-key="combustible"]'),
    ).toBeVisible();
    await expect(
      contentEditor(page).locator('[data-variable-key="marca"]'),
    ).toHaveCount(0);
    await expect(contentEditor(page)).toContainText("{{MARCA}}");

    // La incluida queda configurada; la excluida ni siquiera aparece como
    // variable (no se creó ningún nodo ni configuración para ella).
    await goToTab(page, "Variables");
    await expect(
      variableRow(page, "combustible").getByText("Configurada"),
    ).toBeVisible();
    await expect(variablesRegion(page).getByText("{{marca}}")).toHaveCount(0);
  });

  test("F: the review dialog exposes required and output transform, and the choice persists after saving and reloading", async ({
    page,
  }) => {
    await openWorkspace(page);

    await pasteAtEnd(page, "Cédula {{CEDULA_COMPARECIENTE}}.");
    const dialog = reviewDialog(page);
    await expect(dialog).toBeVisible();

    await dialog
      .getByRole("checkbox", { name: "Variable obligatoria CEDULA_COMPARECIENTE" })
      .check();
    await dialog
      .getByLabel("Transformación de salida CEDULA_COMPARECIENTE")
      .selectOption("digits_to_words");
    await dialog.getByRole("button", { name: "Convertir" }).click();
    await expect(dialog).toBeHidden();

    await goToTab(page, "Variables");
    const row = variableRow(page, "cedula_compareciente");
    await expect(row.getByText("Configurada")).toBeVisible();
    await expect(row.getByText("Obligatoria")).toBeVisible();
    await expect(row.getByText("Dígitos en palabras")).toBeVisible();

    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    // Guardar desde "Variables" avanza automáticamente a "Índice"; hay que
    // volver explícitamente a "Variables" tras cada reload para inspeccionar
    // la fila.
    await expect(async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await goToTab(page, "Variables");
      const reloadedRow = variableRow(page, "cedula_compareciente");
      await expect(reloadedRow.getByText("Obligatoria")).toBeVisible({
        timeout: 5_000,
      });
      await expect(reloadedRow.getByText("Dígitos en palabras")).toBeVisible({
        timeout: 5_000,
      });
    }).toPass({ timeout: 20_000 });
  });

  test("G: a converted variable persists after saving and reloading, and is selectable in the notarial index", async ({
    page,
  }) => {
    await openWorkspace(page);

    await pasteAtEnd(page, "Folio final {{FOLIO_FINAL}}.");
    const dialog = reviewDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Convertir" }).click();
    await expect(dialog).toBeHidden();

    // Ya queda configurada de inmediato (no hace falta un paso manual de
    // "Configurar" adicional).
    await goToTab(page, "Variables");
    const row = variableRow(page, "folio_final");
    await expect(row.getByText("Configurada")).toBeVisible();
    await expect(row.getByText("Folio final")).toBeVisible();

    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    // Guardar desde "Variables" avanza automáticamente a "Índice"; hay que
    // volver explícitamente a "Variables" tras cada reload para inspeccionar
    // la fila.
    await expect(async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await goToTab(page, "Variables");
      await expect(
        variableRow(page, "folio_final").getByText("Configurada"),
      ).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 20_000 });

    await goToTab(page, "Documento");
    await expect(
      contentEditor(page).locator('[data-variable-key="folio_final"]'),
    ).toBeVisible();

    // Ahora aparece como opción seleccionable en el Índice Notarial (se
    // alimenta de la misma configuración persistida de variables).
    // La fila colapsable de "Número de instrumento" solo expone su
    // `<select>` mientras está abierta, y el `<label>` visible de ese
    // select es el genérico "Variable sugerida" (el nombre del campo ya
    // está en el encabezado de la fila) — se ubica por su id fijo.
    await goToTab(page, "Índice");
    await openIndexRow(page, "instrument_number");
    await expect(
      notarialIndexRegion(page)
        .locator("#instrument_number_field_id")
        .locator("option", { hasText: "Folio final" }),
    ).toHaveCount(1);
  });

  test("H: editing a converted variable's label persists immediately and updates the editor chip, the preview and the notarial index", async ({
    page,
  }) => {
    await openWorkspace(page);

    await pasteAtEnd(page, "Marca del vehiculo {{MARCA_VEHICULO}}.");
    const dialog = reviewDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Convertir" }).click();
    await expect(dialog).toBeHidden();

    await expect(
      contentEditor(page).getByText("Marca vehiculo"),
    ).toBeVisible();
    await expect(
      previewRegion(page).getByText("Marca vehiculo"),
    ).toBeVisible();

    await goToTab(page, "Variables");
    const row = variableRow(page, "marca_vehiculo");
    await row
      .getByRole("button", { name: "Editar variable marca_vehiculo" })
      .click();
    await page.getByLabel("Etiqueta").fill("Marca del vehículo");
    await page.getByRole("button", { name: "Guardar variable" }).click();
    await expect(row.getByText("Marca del vehículo")).toBeVisible();
    // "Guardar variable" ya no persiste por su cuenta (guardado único):
    // solo aplica el cambio localmente — el botón "Guardar" global es el
    // que envía todo el formulario (documento + variables) y persiste tanto
    // la etiqueta como el contenido pegado antes. Tampoco avanza de paso,
    // así que seguimos en "Variables".
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.locator('p[role="status"]')).toHaveText("Guardado", {
      timeout: 15_000,
    });

    await goToTab(page, "Documento");
    await expect(
      contentEditor(page).getByText("Marca del vehículo"),
    ).toBeVisible();
    await expect(
      contentEditor(page).getByText("Marca vehiculo"),
    ).toHaveCount(0);
    await expect(
      previewRegion(page).getByText("Marca del vehículo"),
    ).toBeVisible();

    await expect(async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        contentEditor(page).getByText("Marca del vehículo"),
      ).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 20_000 });

    await goToTab(page, "Índice");
    await openIndexRow(page, "instrument_number");
    await expect(
      notarialIndexRegion(page)
        .locator("#instrument_number_field_id")
        .locator("option", { hasText: "Marca del vehículo" }),
    ).toHaveCount(1);
  });

  test("I: typing a {{clave}} character by character still converts immediately, with no dialog", async ({
    page,
  }) => {
    await openWorkspace(page);

    await contentEditor(page).click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type("Comparece {{parte.unica}}.");

    await expect(reviewDialog(page)).toHaveCount(0);
    const chip = contentEditor(page).locator(
      '[data-variable-key="parte.unica"]',
    );
    await expect(chip).toBeVisible();
    // Ningún delimitador "{{"/"}}" debe sobrevivir fuera del chip — la
    // etiqueta propia del chip ("{{parte.unica}}") es la única aparición
    // esperada. `toContainText` (no `toHaveText`): este documento acumula
    // contenido de pruebas anteriores en la misma suite serial.
    await expect(contentEditor(page)).toContainText("Comparece {{parte.unica}}.");

    // Escribir a mano sigue dejando la variable pendiente de configurar —
    // a diferencia de pegar, que ahora siempre pasa por el diálogo.
    await goToTab(page, "Variables");
    const row = variableRow(page, "parte.unica");
    await expect(row.getByText("Pendiente de configurar")).toBeVisible();

    await row
      .getByRole("button", { name: "Configurar variable parte.unica" })
      .click();
    await page.getByLabel("Etiqueta").fill("Parte única");
    await page.getByRole("button", { name: "Guardar variable" }).click();
    await expect(row.getByText("Configurada")).toBeVisible();
    // "Guardar variable" solo aplica el cambio localmente — el botón
    // "Guardar" global es el que persiste.
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.locator('p[role="status"]')).toHaveText("Guardado", {
      timeout: 15_000,
    });

    await expect(async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        variableRow(page, "parte.unica").getByText("Configurada"),
      ).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 20_000 });

    await goToTab(page, "Documento");
    await expect(contentEditor(page).getByText("Parte única")).toBeVisible();
  });

  // Regresión: el input rule dejaba "{{"/"}}" como texto literal alrededor
  // del chip convertido (usaba `nodeInputRule`, que solo reemplaza la clave
  // capturada, no los delimitadores completos — ver `tiptap.ts`). Corre
  // sobre un párrafo nuevo del mismo machote, con dos variables y una clave
  // inválida en el medio para probar que ninguna de las tres interfiere con
  // las otras.
  test("J: typing consumes both delimiters fully, with no residual braces, across multiple variables in one paragraph", async ({
    page,
  }) => {
    await openWorkspace(page);

    await contentEditor(page).click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type(
      " Comparece {{comprador.nombre}}, cédula {{comprador.identificacion}}, texto con llave inválida {{Mal}} que debe quedar literal.",
    );

    await expect(reviewDialog(page)).toHaveCount(0);
    await expect(
      contentEditor(page).locator('[data-variable-key="comprador.nombre"]'),
    ).toBeVisible();
    await expect(
      contentEditor(page).locator(
        '[data-variable-key="comprador.identificacion"]',
      ),
    ).toBeVisible();

    // El texto del editor sin el contenido propio de los chips (que sí
    // muestra "{{clave}}" a propósito como su etiqueta, ver `tiptap.ts`) no
    // debe tener ninguna llave suelta: ni delimitadores residuales de las
    // variables convertidas, ni nada roto por la clave inválida.
    const strayBraces = await contentEditor(page).evaluate((el) => {
      const clone = el.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll("[data-variable-key]")
        .forEach((chip) => chip.remove());
      return clone.textContent ?? "";
    });
    expect(strayBraces).not.toContain("{{comprador");
    expect(strayBraces).toContain("{{Mal}}");
  });

  // El contenido es la única fuente de verdad de qué variables existen (ver
  // `TemplateVariablesPanel.tsx`): una variable configurada deja de existir
  // en cuanto su última referencia se borra del documento — no queda
  // "No utilizada" acumulando configuración vieja.
  test("K: a variable disappears once its last reference is deleted, survives while any reference remains, and can be recreated without conflict", async ({
    page,
  }) => {
    await openWorkspace(page);

    // Dos referencias de la misma clave, en un párrafo nuevo.
    await contentEditor(page).click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type(" {{precio}} y otra vez {{precio}}.");

    await goToTab(page, "Variables");
    const row = variableRow(page, "precio");
    await expect(row.getByText("Pendiente de configurar")).toBeVisible();
    await row
      .getByRole("button", { name: "Configurar variable precio" })
      .click();
    await page.getByLabel("Etiqueta").fill("Precio");
    await page.getByRole("button", { name: "Guardar variable" }).click();
    await expect(row.getByText("Configurada")).toBeVisible();

    // Borra solo la PRIMERA referencia — la segunda mantiene la variable
    // viva y configurada.
    await goToTab(page, "Documento");
    const chips = contentEditor(page).locator('[data-variable-key="precio"]');
    await expect(chips).toHaveCount(2);
    await chips.first().click();
    await page.keyboard.press("Backspace");
    await expect(chips).toHaveCount(1);

    await goToTab(page, "Variables");
    await expect(row.getByText("Configurada")).toBeVisible();

    // Borra la ÚLTIMA referencia — ahora sí desaparece del panel por
    // completo (no "No utilizada").
    await goToTab(page, "Documento");
    await chips.first().click();
    await page.keyboard.press("Backspace");
    await expect(chips).toHaveCount(0);

    await goToTab(page, "Variables");
    await expect(variablesRegion(page)).toBeVisible();
    await expect(row).toHaveCount(0);

    // Recrearla con el mismo nombre funciona sin conflicto: vuelve a
    // aparecer como "Pendiente de configurar", una variable nueva, no la
    // configuración vieja resucitada (nunca se le puso etiqueta ahora). En
    // un párrafo nuevo propio — evita depender de la posición del cursor
    // que dejó el borrado del chip anterior en el párrafo previo.
    await goToTab(page, "Documento");
    await contentEditor(page).click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("{{precio}}");
    // Espera a que el input rule termine de convertir antes de cambiar de
    // paso — cambiar de pestaña mientras esa transacción sigue en curso ha
    // dejado, intermitentemente, el clic de la pestaña sin efecto.
    await expect(chips).toHaveCount(1);

    await goToTab(page, "Variables");
    await expect(variablesRegion(page)).toBeVisible();
    await expect(row.getByText("Pendiente de configurar")).toBeVisible();
  });

  // Persistencia del podado (caso E del pedido original): un machote propio,
  // pequeño y recién creado — no el documento compartido y ya muy grande de
  // A-K — porque el guardado de ESE documento se ha visto tardar más de 30s
  // en este entorno bajo carga sostenida (probablemente por su tamaño
  // acumulado, no por la lógica bajo prueba, ya validada en K sin tocar
  // guardado/recarga). Aislarlo aquí evita que la lentitud de un documento
  // gigante de prueba oscurezca la señal real: que guardar realmente poda la
  // configuración huérfana en vez de solo ocultarla en el panel.
  test("L: pruning a deleted variable's configuration actually persists — reload never resurrects it", async ({
    page,
  }) => {
    const templateName = uniqueName("pasted-vars-prune", "machote");
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "Contenido inicial.",
    });
    const url = `/dashboard/templates/${template.id}`;

    await page.goto(url);
    await page.getByRole("tab", { name: "Documento", exact: true }).click();
    await expect(contentEditor(page)).toBeVisible();
    await contentEditor(page).click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type(" {{monto}}");

    await goToTab(page, "Variables");
    const row = variableRow(page, "monto");
    await row
      .getByRole("button", { name: "Configurar variable monto" })
      .click();
    await page.getByLabel("Etiqueta").fill("Monto");
    await page.getByRole("button", { name: "Guardar variable" }).click();
    await expect(row.getByText("Configurada")).toBeVisible();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.locator('p[role="status"]')).toHaveText("Guardado", {
      timeout: 15_000,
    });

    await goToTab(page, "Documento");
    const chip = contentEditor(page).locator('[data-variable-key="monto"]');
    await chip.click();
    await page.keyboard.press("Backspace");
    await expect(chip).toHaveCount(0);

    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.locator('p[role="status"]')).toHaveText("Guardado", {
      timeout: 15_000,
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await goToTab(page, "Documento");
    await contentEditor(page).click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type(" {{monto}}");

    await goToTab(page, "Variables");
    // Si el guardado anterior solo hubiera ocultado la fila en el panel sin
    // podar `variables`, esta reaparecería ya "Configurada" con la etiqueta
    // vieja "Monto" — en vez de "Pendiente de configurar", una variable
    // nueva sin ningún rastro de la configuración eliminada.
    await expect(row.getByText("Pendiente de configurar")).toBeVisible();
  });
});
