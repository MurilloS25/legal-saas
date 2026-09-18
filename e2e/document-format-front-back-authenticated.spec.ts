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

async function download(page: Page, profile: "Frente" | "Vuelto") {
  await page.getByLabel("Formato de margen").selectOption({ label: profile });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar Word" }).click();
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

  test("C: exporting with Frente applies the Frente margins (default selection is Frente)", async ({
    page,
  }) => {
    await page.goto(`/documents/${docId}`);
    await expect(page.getByLabel("Formato de margen")).toHaveValue("front");

    const margins = await pageMargins(await download(page, "Frente"));
    expect(margins).toMatchObject({
      top: "1133", // 2 cm
      bottom: "1417", // 2.5 cm
      left: "1700", // 3 cm
      right: "1984", // 3.5 cm
      gutter: "0",
    });
  });

  test("D: exporting with Vuelto applies the Vuelto margins", async ({ page }) => {
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

  test("E: the documents list also offers the Frente/Vuelto choice per row", async ({
    page,
  }) => {
    await page.goto("/documents");
    const row = page.getByRole("row", { name: new RegExp(docTitle) });
    await expect(
      row.getByLabel(new RegExp(`Formato de margen — ${docTitle}`)),
    ).toHaveValue("front");
  });

  test("F: an unknown margin profile is rejected by the export endpoint", async ({
    page,
  }) => {
    const response = await page.request.post(
      `/api/documents/${docId}/docx?margins=diagonal`,
    );
    expect(response.status()).toBe(400);
  });
});
