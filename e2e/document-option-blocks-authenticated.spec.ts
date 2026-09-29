import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import {
  CleanupRegistry,
  createTestTemplate,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";
import { openAndConfirmWordDownload } from "./support/word-download";

/**
 * Uso de Bloques de opciones en la Escritura: seleccionar una variante
 * desde el popover, ver el documento/preview/DOCX actualizarse de
 * inmediato, y que la selección persista a través de guardado, recarga y
 * finalización.
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const templateName = uniqueName("document-option-blocks", "machote");
let templateId = "";
let documentUrl = "";

const optionBlockDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Comparece con " },
        {
          type: "optionBlock",
          attrs: {
            blockId: "block-1",
            name: "Chasis, VIN y Serie",
            defaultVariantId: "iguales",
            variants: [
              {
                id: "iguales",
                label: "Todos iguales",
                content: [
                  { type: "text", text: "número " },
                  { type: "templateVariable", attrs: { key: "vehiculo.numero" } },
                ],
              },
              {
                id: "distintos",
                label: "Todos distintos",
                content: [
                  { type: "text", text: "CHASIS " },
                  { type: "templateVariable", attrs: { key: "vehiculo.chasis" } },
                  { type: "text", text: ", VIN " },
                  { type: "templateVariable", attrs: { key: "vehiculo.vin" } },
                ],
              },
            ],
          },
        },
        { type: "text", text: "." },
      ],
    },
  ],
};

function documentRegion(page: Page) {
  return page.getByRole("region", { name: "Documento", exact: true });
}

async function docxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")!.async("string");
  return [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((m) => m[1])
    .join("");
}

test.describe("document option blocks", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "document-option-blocks");
  });

  test("A: seed a template with a two-variant option block", async ({ page }) => {
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "placeholder",
      doc: optionBlockDoc,
    });
    templateId = template.id;
    void page;
  });

  test("B: switching variants updates the document immediately, shows only the active variant's fields, and preserves the other variant's values", async ({
    page,
  }) => {
    await page.goto(`/documents/new/${templateId}`);
    await expect(documentRegion(page).getByText("número")).toBeVisible();
    await expect(documentRegion(page).getByText("CHASIS", { exact: true })).toHaveCount(0);

    // Completa la variante predeterminada.
    await documentRegion(page)
      .locator('[data-variable-key="vehiculo.numero"]')
      .click();
    await documentRegion(page)
      .locator('input[data-variable-key="vehiculo.numero"]')
      .fill("999");
    await documentRegion(page)
      .locator('input[data-variable-key="vehiculo.numero"]')
      .blur();

    // Cambia a "Todos distintos" vía el popover del bloque.
    await page
      .getByRole("button", { name: /Cambiar variante de Chasis, VIN y Serie/ })
      .click();
    await page.getByRole("radio", { name: "Todos distintos" }).click();

    await expect(documentRegion(page).getByText("CHASIS", { exact: true })).toBeVisible();
    // El campo de la variante anterior ya no aparece en el documento.
    await expect(
      documentRegion(page).locator('[data-variable-key="vehiculo.numero"]'),
    ).toHaveCount(0);

    await documentRegion(page)
      .locator('[data-variable-key="vehiculo.chasis"]')
      .click();
    await documentRegion(page)
      .locator('input[data-variable-key="vehiculo.chasis"]')
      .fill("ABC123");
    await documentRegion(page)
      .locator('input[data-variable-key="vehiculo.chasis"]')
      .blur();

    // Vuelve a "Todos iguales": el valor cargado antes sigue ahí.
    await page
      .getByRole("button", { name: /Cambiar variante de Chasis, VIN y Serie/ })
      .click();
    await page.getByRole("radio", { name: "Todos iguales" }).click();
    await expect(
      documentRegion(page).getByText("número 999"),
    ).toBeVisible();
  });

  test("C: the selection and both variants' values persist after saving and reloading", async ({
    page,
  }) => {
    await page.goto(`/documents/new/${templateId}`);

    await page
      .getByRole("button", { name: /Cambiar variante de Chasis, VIN y Serie/ })
      .click();
    await page.getByRole("radio", { name: "Todos distintos" }).click();
    await documentRegion(page)
      .locator('[data-variable-key="vehiculo.chasis"]')
      .click();
    await documentRegion(page)
      .locator('input[data-variable-key="vehiculo.chasis"]')
      .fill("ABC123");
    await documentRegion(page)
      .locator('input[data-variable-key="vehiculo.chasis"]')
      .blur();
    await documentRegion(page)
      .locator('[data-variable-key="vehiculo.vin"]')
      .click();
    await documentRegion(page)
      .locator('input[data-variable-key="vehiculo.vin"]')
      .fill("VIN999");
    await documentRegion(page)
      .locator('input[data-variable-key="vehiculo.vin"]')
      .blur();

    await page.getByRole("button", { name: "Crear escritura" }).click();
    // El primer guardado compila /documents/[id] en el dev server (~10 s en frío
    // con un solo worker; más con varios en paralelo): 15 s era el límite justo.
    await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}/, {
      timeout: 45_000,
    });
    documentUrl = page.url();
    await registerCreatedViaUi(
      registry,
      "documents",
      "title",
      `${templateName} — Borrador`,
    );

    // El primer guardado ya deja al usuario en "Completar" (no navega) —
    // recargar preserva ese mismo paso.
    await page.reload();
    await page.getByRole("tab", { name: "Completar", exact: true }).click();
    await expect(documentRegion(page).getByText("CHASIS", { exact: true })).toBeVisible();
    await expect(
      documentRegion(page).getByText("ABC123"),
    ).toBeVisible();
    await expect(
      documentRegion(page).getByText("VIN999"),
    ).toBeVisible();
  });

  test("D: preview and DOCX show the same selected variant and values", async ({
    page,
  }) => {
    await page.goto(documentUrl);
    // "Descargar Word" vive directo en el encabezado del workspace —
    // alcanzable sin importar el paso activo.
    const downloadPromise = page.waitForEvent("download");
    await openAndConfirmWordDownload(
      page,
      page.getByRole("button", { name: "Descargar Word" }),
    );
    const download = await downloadPromise;
    const buffer = readFileSync(await download.path());
    const text = await docxText(buffer);

    expect(text).toContain("CHASIS");
    expect(text).toContain("ABC123");
    expect(text).toContain("VIN999");
    expect(text).not.toContain("número 999");
  });

  test("F: the variant trigger is an accessible, keyboard-operable button with open/closed state", async ({
    page,
  }) => {
    await page.goto(`/documents/new/${templateId}`);
    const trigger = page.getByRole("button", {
      name: /Cambiar variante de Chasis, VIN y Serie/,
    });
    await expect(trigger).toBeVisible();
    // Ícono real (SVG), no el carácter suelto.
    await expect(trigger.locator("svg")).toHaveCount(1);
    await expect(trigger).not.toContainText("▾");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    const box = await trigger.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(24);
    expect(box!.height).toBeGreaterThanOrEqual(24);

    // Teclado: Enter abre, Escape cierra.
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("radiogroup", { name: /Variantes de Chasis, VIN y Serie/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("radiogroup")).toHaveCount(0);

    // Elegir una variante sigue funcionando.
    await trigger.click();
    await page.getByRole("radio", { name: "Todos distintos" }).click();
    await expect(documentRegion(page).getByText("CHASIS", { exact: true })).toBeVisible();
  });

  test("E: a finalized document is read-only — no variant switcher is offered", async ({
    page,
  }) => {
    await page.goto(documentUrl);
    // `documentUrl` aterriza en "Completar" (paso por defecto) — Finalizar
    // vive ahí; Reabrir vive en el encabezado del workspace (global).
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Finalizar escritura" })
      .click();
    // Finalizar redirige de verdad y avanza el paso a "Cobro".
    await expect(
      page.getByRole("button", { name: "Reabrir escritura" }),
    ).toBeVisible({ timeout: 15_000 });

    // La hoja documental solo se renderiza en el paso Completar (los demás
    // pasos son paneles independientes, ocultos con `hidden`).
    await page.getByRole("tab", { name: "Completar" }).click();
    await expect(
      documentRegion(page).getByRole("button", { name: /Cambiar variante de/ }),
    ).toHaveCount(0);
    await expect(documentRegion(page).getByText("CHASIS", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Reabrir escritura" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Reabrir escritura" })
      .click();
    await expect(
      page.getByRole("button", { name: "Finalizar escritura" }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
