import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import {
  CleanupRegistry,
  createTestDocument,
  createTestTemplate,
  runCleanup,
  uniqueName,
} from "./support/factories";
import { restSelect, restUpdate } from "./support/supabase-admin";
import { getTestUserAuth } from "./support/supabase-api";
import {
  confirmWordDownload,
  wordDownloadDialog,
  type MarginProfileLabel,
} from "./support/word-download";

// Serial: comparten los mismos `document_settings` del usuario de prueba.
test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

const registry = new CleanupRegistry();
const templateName = uniqueName("fmt", "machote");
const docTitle = `${templateName} — Formato`;
let docId = "";

type SettingsRow = Record<string, number | string | null>;
let originalSettings: SettingsRow | null = null;

const SETTINGS_COLUMNS =
  "font_family,font_size,margin_top_cm,margin_bottom_cm,margin_left_cm,margin_right_cm,back_margin_top_cm,back_margin_bottom_cm,back_margin_left_cm,back_margin_right_cm";

/** Atributos de `<w:pgMar .../>` en word/document.xml del .docx descargado. */
async function pageMargins(buffer: Buffer): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")!.async("string");
  const match = /<w:pgMar\s([^>]*?)\/?>/.exec(xml);
  if (!match) throw new Error("pgMar not found");
  return Object.fromEntries(
    [...match[1].matchAll(/w:(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]),
  );
}

/** Descarga vía el flujo real: botón → diálogo → perfil → confirmar. */
async function download(page: Page, profile?: MarginProfileLabel) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar Word" }).click();
  await confirmWordDownload(page, profile);
  const file = await downloadPromise;
  expect(file.suggestedFilename()).toMatch(/\.docx$/);
  return readFileSync(await file.path());
}

test.describe("document format: Frente / Vuelto", () => {
  test.afterAll(async () => {
    try {
      if (originalSettings) {
        await restUpdate(
          "document_settings",
          `workspace_id=eq.${getTestUserAuth().userId}`,
          originalSettings,
        );
      }
    } finally {
      await runCleanup(registry, "fmt");
    }
  });

  test("A: seed a template and a persisted draft", async () => {
    const rows = await restSelect<SettingsRow>(
      "document_settings",
      `select=${SETTINGS_COLUMNS}&workspace_id=eq.${getTestUserAuth().userId}`,
    );
    originalSettings = rows[0] ?? null;

    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "ESCRITURA de formato.",
    });
    const doc = await createTestDocument(registry, template.id, {
      title: docTitle,
      field_values: {},
      rendered_content: "ESCRITURA de formato.",
    });
    docId = doc.id;
  });

  test("B: Settings edits Frente and Vuelto independently and both persist", async ({
    page,
  }) => {
    await page.goto("/settings?tab=document");

    await expect(page.getByRole("tab", { name: "Frente" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByLabel("Interlineado")).toHaveCount(0);

    const front = page.getByRole("tabpanel");
    await front.getByLabel("Superior").fill("2");
    await front.getByLabel("Inferior").fill("2.5");
    await front.getByLabel("Izquierdo").fill("3");
    await front.getByLabel("Derecho").fill("3.5");

    await page.getByRole("tab", { name: "Vuelto" }).click();
    const back = page.getByRole("tabpanel");
    await back.getByLabel("Superior").fill("4");
    await back.getByLabel("Inferior").fill("4.5");
    await back.getByLabel("Izquierdo").fill("5");
    await back.getByLabel("Derecho").fill("5.5");

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByRole("status").getByText("Configuración de documento guardada."),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByRole("tabpanel").getByLabel("Superior")).toHaveValue("2");
    await page.getByRole("tab", { name: "Vuelto" }).click();
    await expect(page.getByRole("tabpanel").getByLabel("Superior")).toHaveValue("4");
    await expect(page.getByRole("tabpanel").getByLabel("Derecho")).toHaveValue("5.5");
  });

  test("C: Descargar Word opens a dialog with Frente selected by default", async ({
    page,
  }) => {
    await page.goto(`/documents/${docId}`);
    await page.getByRole("button", { name: "Descargar Word" }).click();

    const dialog = wordDownloadDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("radio", { name: "Frente" })).toBeChecked();
    await expect(dialog.getByRole("radio", { name: "Vuelto" })).not.toBeChecked();
    // El foco cae dentro del diálogo, en la opción seleccionada.
    await expect(dialog.getByRole("radio", { name: "Frente" })).toBeFocused();
  });

  test("D: cancelling downloads nothing, and the choice is not remembered", async ({
    page,
  }) => {
    await page.goto(`/documents/${docId}`);
    let downloads = 0;
    page.on("download", () => downloads++);

    await page.getByRole("button", { name: "Descargar Word" }).click();
    const dialog = wordDownloadDialog(page);
    await dialog.getByText("Vuelto", { exact: true }).click();
    await expect(dialog.getByRole("radio", { name: "Vuelto" })).toBeChecked();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).not.toBeVisible();
    // El foco vuelve al botón que abrió el diálogo.
    await expect(
      page.getByRole("button", { name: "Descargar Word" }),
    ).toBeFocused();
    expect(downloads).toBe(0);

    // Al reabrir vuelve a Frente (la elección no se recuerda).
    await page.getByRole("button", { name: "Descargar Word" }).click();
    await expect(
      wordDownloadDialog(page).getByRole("radio", { name: "Frente" }),
    ).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(wordDownloadDialog(page)).not.toBeVisible();
  });

  test("E: confirming Frente generates the document with the Frente margins", async ({
    page,
  }) => {
    await page.goto(`/documents/${docId}`);
    const margins = await pageMargins(await download(page));
    expect(margins).toMatchObject({
      top: "1133", // 2 cm
      bottom: "1417", // 2.5 cm
      left: "1700", // 3 cm
      right: "1984", // 3.5 cm
      gutter: "0",
    });
  });

  test("F: confirming Vuelto generates the document with the Vuelto margins", async ({
    page,
  }) => {
    await page.goto(`/documents/${docId}`);
    const margins = await pageMargins(await download(page, "Vuelto"));
    expect(margins).toMatchObject({
      top: "2267", // 4 cm
      bottom: "2551", // 4.5 cm
      left: "2834", // 5 cm
      right: "3118", // 5.5 cm
      gutter: "0",
    });
  });

  test("G: the documents list keeps a clean Descargar Word action (no inline selector) that opens the dialog", async ({
    page,
  }) => {
    await page.goto("/documents");
    const row = page.getByRole("row", { name: new RegExp(docTitle) });
    await expect(row.getByRole("combobox")).toHaveCount(0);
    await expect(row.getByLabel(/Formato de margen/)).toHaveCount(0);

    await row
      .getByRole("button", { name: `Descargar Word de ${docTitle}` })
      .click();
    await expect(
      wordDownloadDialog(page).getByRole("radio", { name: "Frente" }),
    ).toBeChecked();
  });

  test("H: an unknown margin profile is rejected by the export endpoint", async ({
    page,
  }) => {
    const response = await page.request.post(
      `/api/documents/${docId}/docx?margins=diagonal`,
    );
    expect(response.status()).toBe(400);
  });
});
