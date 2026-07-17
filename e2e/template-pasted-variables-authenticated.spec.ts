import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestTemplate,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";

/**
 * Detección automática de variables `{{clave}}` escritas o pegadas en el
 * editor del machote, sin pasar por el diálogo "Insertar variable".
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

async function goToTab(page: Page, name: "Documento" | "Variables") {
  await page.getByRole("tab", { name }).click();
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

  test("B: pasting a full block of text with several placeholders detects them all", async ({
    page,
  }) => {
    await page.goto(templateUrl);
    await expect(contentEditor(page)).toBeVisible();

    await pasteAtEnd(
      page,
      "Comparecen {{comprador.nombre}} y {{vendedor.nombre}}, folio {{folio.inicio}}.",
    );

    // Cada placeholder queda representado como una ficha real en el editor,
    // no como texto plano.
    await expect(
      contentEditor(page).locator('[data-variable-key="comprador.nombre"]'),
    ).toBeVisible();
    await expect(
      contentEditor(page).locator('[data-variable-key="vendedor.nombre"]'),
    ).toBeVisible();
    await expect(
      contentEditor(page).locator('[data-variable-key="folio.inicio"]'),
    ).toBeVisible();

    await goToTab(page, "Variables");
    await expect(
      variableRow(page, "comprador.nombre").getByText("Pendiente de configurar"),
    ).toBeVisible();
    await expect(
      variableRow(page, "vendedor.nombre").getByText("Pendiente de configurar"),
    ).toBeVisible();
    await expect(
      variableRow(page, "folio.inicio").getByText("Pendiente de configurar"),
    ).toBeVisible();
  });

  test("C: pasting an invalid placeholder leaves it as plain text", async ({
    page,
  }) => {
    await page.goto(templateUrl);
    await expect(contentEditor(page)).toBeVisible();

    await pasteAtEnd(page, " {{Clave Invalida}}");

    // No se crea ninguna ficha nueva para la clave inválida: el texto queda
    // literal, visible para que el usuario lo corrija a mano.
    await expect(
      contentEditor(page).locator('[data-variable-key]'),
    ).toHaveCount(0);
    await expect(contentEditor(page)).toContainText("{{Clave Invalida}}");
  });

  test("D: configuring a detected variable, saving and reloading persists it", async ({
    page,
  }) => {
    await page.goto(templateUrl);
    await expect(contentEditor(page)).toBeVisible();

    await pasteAtEnd(page, "Comparece {{parte.unica}}.");
    await goToTab(page, "Variables");

    const row = variableRow(page, "parte.unica");
    await expect(row.getByText("Pendiente de configurar")).toBeVisible();
    await row
      .getByRole("button", { name: "Configurar variable parte.unica" })
      .click();
    await page.getByLabel("Etiqueta").fill("Parte única");
    await page.getByRole("button", { name: "Guardar variable" }).click();
    await expect(row.getByText("Configurada")).toBeVisible();

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    // La sección activa (Variables, en este punto) viaja en la URL vía
    // pushState, así que un reload la conserva -- correcto: recargar no debe
    // devolver al usuario a Documento. Se confirma primero aquí...
    await expect(async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        variableRow(page, "parte.unica").getByText("Configurada"),
      ).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 20_000 });

    // ...y se confirma también en Documento, para probar que la ficha con
    // la etiqueta configurada persistió en el propio contenido del machote.
    await goToTab(page, "Documento");
    await expect(
      contentEditor(page).getByText("Parte única"),
    ).toBeVisible();
  });

  test("E: pasting a legacy uppercase block shows a review dialog and converts on confirm", async ({
    page,
  }) => {
    await page.goto(templateUrl);
    await expect(contentEditor(page)).toBeVisible();

    // Muestra de un machote antiguo real: variables en mayúsculas con la
    // misma delimitación `{{ }}`, una clave con mayúsculas y punto, un
    // token con dos puntos que no es una variable de datos (`SMART:`), y
    // una variable ya válida en el mismo bloque pegado.
    await pasteAtEnd(
      page,
      "Comparece {{NOMBRE_COMPARECIENTE}}, placas {{PLACAS}}, tomo " +
        "{{NUMERO_ESCRITURA.numero}}, bloque {{SMART:block_fda924b2}} y " +
        "{{comprador.nombre}}.",
    );

    const dialog = page.getByRole("dialog", {
      name: "Revisar variables detectadas",
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("Se detectaron 3 posibles variables"),
    ).toBeVisible();
    await expect(dialog.getByText("{{NOMBRE_COMPARECIENTE}}")).toBeVisible();
    await expect(dialog.getByText("{{PLACAS}}")).toBeVisible();
    await expect(
      dialog.getByText("{{NUMERO_ESCRITURA.numero}}"),
    ).toBeVisible();
    // El token con dos puntos no es una variable reconocida: no aparece en
    // la lista de candidatas del diálogo.
    await expect(dialog.getByText("SMART:block")).toHaveCount(0);

    await dialog.getByRole("button", { name: "Convertir" }).click();
    await expect(dialog).toBeHidden();

    // La variable ya válida se convierte igual que siempre (sin diálogo),
    // y las tres variables legacy quedan como fichas reales normalizadas.
    await expect(
      contentEditor(page).locator('[data-variable-key="comprador.nombre"]'),
    ).toBeVisible();
    await expect(
      contentEditor(page).locator(
        '[data-variable-key="nombre_compareciente"]',
      ),
    ).toBeVisible();
    await expect(
      contentEditor(page).locator('[data-variable-key="placas"]'),
    ).toBeVisible();
    await expect(
      contentEditor(page).locator(
        '[data-variable-key="numero_escritura.numero"]',
      ),
    ).toBeVisible();
    // El token no reconocido queda literal, sin convertirse.
    await expect(contentEditor(page)).toContainText(
      "{{SMART:block_fda924b2}}",
    );

    await goToTab(page, "Variables");
    await expect(
      variableRow(page, "nombre_compareciente").getByText(
        "Pendiente de configurar",
      ),
    ).toBeVisible();
    await expect(
      variableRow(page, "placas").getByText("Pendiente de configurar"),
    ).toBeVisible();
  });

  test("F: canceling the legacy review dialog leaves the pasted text unmodified", async ({
    page,
  }) => {
    await page.goto(templateUrl);
    await expect(contentEditor(page)).toBeVisible();

    await pasteAtEnd(page, "Tomo {{TOMO_NUMERO}} folio {{FOLIO_INICIAL}}.");

    const dialog = page.getByRole("dialog", {
      name: "Revisar variables detectadas",
    });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();

    await expect(
      contentEditor(page).locator(
        '[data-variable-key="tomo_numero"], [data-variable-key="folio_inicial"]',
      ),
    ).toHaveCount(0);
    await expect(contentEditor(page)).toContainText(
      "Tomo {{TOMO_NUMERO}} folio {{FOLIO_INICIAL}}.",
    );
  });

  test("G: excluding a candidate in the review dialog keeps it as literal text", async ({
    page,
  }) => {
    await page.goto(templateUrl);
    await expect(contentEditor(page)).toBeVisible();

    await pasteAtEnd(page, "Marca {{MARCA}} combustible {{COMBUSTIBLE}}.");

    const dialog = page.getByRole("dialog", {
      name: "Revisar variables detectadas",
    });
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
  });

  test("H: a converted legacy variable persists after saving and reloading", async ({
    page,
  }) => {
    await page.goto(templateUrl);
    await expect(contentEditor(page)).toBeVisible();

    await pasteAtEnd(page, "Folio final {{FOLIO_FINAL}}.");
    const dialog = page.getByRole("dialog", {
      name: "Revisar variables detectadas",
    });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Convertir" }).click();
    await expect(dialog).toBeHidden();

    await goToTab(page, "Variables");
    const row = variableRow(page, "folio_final");
    await expect(row.getByText("Pendiente de configurar")).toBeVisible();
    await row
      .getByRole("button", { name: "Configurar variable folio_final" })
      .click();
    await page.getByLabel("Etiqueta").fill("Folio final");
    await page.getByRole("button", { name: "Guardar variable" }).click();
    await expect(row.getByText("Configurada")).toBeVisible();

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        variableRow(page, "folio_final").getByText("Configurada"),
      ).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 20_000 });

    await goToTab(page, "Documento");
    await expect(
      contentEditor(page).locator('[data-variable-key="folio_final"]'),
    ).toBeVisible();
  });
});
