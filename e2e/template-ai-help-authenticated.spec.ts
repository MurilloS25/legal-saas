import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestTemplate,
  runCleanup,
  uniqueName,
} from "./support/factories";

/**
 * Ayuda para crear un machote con una herramienta de IA externa.
 *
 * Puramente informativo: el modal copia un prompt estático al portapapeles
 * y no llama ninguna API ni modifica el machote. Esta cobertura verifica el
 * botón/modal en sí (visibilidad, apertura/cierre, contenido, copiar) y que
 * abrir/cerrar el modal no toca el editor ni las variables ya configuradas
 * — no hay integración con ningún proveedor de IA que probar.
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const templateName = uniqueName("template-ai-help", "machote");
let templateUrl = "";

function contentEditor(page: Page) {
  return page.getByRole("textbox", { name: "Contenido del machote" });
}

function aiHelpButton(page: Page) {
  return page.getByRole("button", { name: "Ayuda para crear con IA" });
}

function aiHelpDialog(page: Page) {
  return page.getByRole("dialog", { name: "Crea tu machote con ayuda de IA" });
}

async function openWorkspace(page: Page) {
  await expect(async () => {
    await page.goto(templateUrl);
    await expect(contentEditor(page)).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 20_000 });
}

test.describe("ayuda para crear un machote con IA", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "Contenido {{comprador.nombre}} de prueba.",
    });
    templateUrl = `/dashboard/templates/${template.id}`;
    await page.close();
  });

  test.afterAll(async () => {
    await runCleanup(registry, "template-ai-help");
  });

  test("A: el botón aparece en el paso Documento, junto al editor", async ({
    page,
  }) => {
    await openWorkspace(page);
    await expect(aiHelpButton(page)).toBeVisible();
  });

  test("B: abre el modal con el contenido esperado, y Escape lo cierra devolviendo el foco al botón", async ({
    page,
  }) => {
    await openWorkspace(page);
    await aiHelpButton(page).click();

    const dialog = aiHelpDialog(page);
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Crea tu machote con ayuda de IA" }),
    ).toBeVisible();
    await expect(dialog.getByText("Copia este prompt")).toBeVisible();
    await expect(dialog.getByText("Ábrelo en tu IA favorita")).toBeVisible();
    await expect(dialog.getByText("Trae el resultado a LexCR")).toBeVisible();
    await expect(
      dialog.getByText(/LexCR no envía documentos ni datos/),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Copiar prompt" }),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(aiHelpButton(page)).toBeFocused();
  });

  test("C: el botón Cerrar también cierra el modal", async ({ page }) => {
    await openWorkspace(page);
    await aiHelpButton(page).click();
    await expect(aiHelpDialog(page)).toBeVisible();

    await aiHelpDialog(page).getByRole("button", { name: "Cerrar" }).click();
    await expect(aiHelpDialog(page)).not.toBeVisible();
  });

  test("D: copiar el prompt lo coloca en el portapapeles, usa la sintaxis real de variables de LexCR, y muestra el feedback 'Prompt copiado'", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openWorkspace(page);
    await aiHelpButton(page).click();

    const dialog = aiHelpDialog(page);
    await dialog.getByRole("button", { name: "Copiar prompt" }).click();
    await expect(dialog.getByText("Prompt copiado")).toBeVisible();

    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    // Sintaxis real que entiende el editor (src/lib/editor/variable-key.ts):
    // {{clave}}, minúsculas/dígitos/"_"/"." — sin lista cerrada de roles.
    expect(clipboardText).toContain("{{comprador.nombre}}");
    expect(clipboardText).toContain("{{monto}}");
    expect(clipboardText).not.toMatch(/\{\{[A-Z]/);
  });

  test("E: abrir y cerrar el modal no modifica el contenido del editor ni las variables ya configuradas", async ({
    page,
  }) => {
    await openWorkspace(page);
    const before = await contentEditor(page).textContent();
    expect(before).toContain("comprador.nombre");

    await aiHelpButton(page).click();
    await expect(aiHelpDialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(aiHelpDialog(page)).not.toBeVisible();

    const after = await contentEditor(page).textContent();
    expect(after).toBe(before);
  });
});
