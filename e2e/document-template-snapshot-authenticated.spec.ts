import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import {
  CleanupRegistry,
  createTestTemplate,
  createTestTemplateField,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
  updateTestTemplateContent,
} from "./support/factories";

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();
const templateName = uniqueName("document-snapshot", "machote");
const v1Title = `${templateName} — Borrador`;
let templateId = "";
let v1DocumentUrl = "";

const optionBlock = (version: "v1" | "v2") => ({
  type: "optionBlock",
  attrs: {
    blockId: `modalidad-${version}`,
    name: `Modalidad ${version}`,
    defaultVariantId: "directa",
    variants: [
      { id: "directa", label: "Directa", content: [{ type: "text", text: ` DIRECTA ${version}` }] },
      { id: "poder", label: "Por poder", content: [{ type: "text", text: ` POR PODER ${version}` }] },
    ],
  },
});

const v1 = {
  type: "doc",
  content: [{
    type: "paragraph",
    content: [
      { type: "text", text: "VERSION UNO: " },
      { type: "templateVariable", attrs: { key: "persona.nombre" } },
      optionBlock("v1"),
    ],
  }],
};

const v2 = {
  type: "doc",
  content: [{
    type: "paragraph",
    content: [
      { type: "text", text: "VERSION DOS: " },
      { type: "templateVariable", attrs: { key: "parte.nombre" } },
      optionBlock("v2"),
    ],
  }],
};

function documentRegion(page: Page) {
  return page.getByRole("region", { name: "Documento", exact: true });
}

async function fillInlineVariable(page: Page, key: string, value: string) {
  await documentRegion(page).locator(`[data-variable-key="${key}"]`).first().click();
  const input = documentRegion(page).locator(`input[data-variable-key="${key}"]`);
  await input.fill(value);
  await input.blur();
}

async function downloadedText(page: Page): Promise<string> {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar Word" }).click();
  const zip = await JSZip.loadAsync(readFileSync(await (await downloadPromise).path()));
  const xml = await zip.file("word/document.xml")!.async("string");
  return [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join("");
}

test.describe("document template snapshot", () => {
  test.afterAll(async () => runCleanup(registry, "document-snapshot"));

  test("A-B: creates and saves an Escritura from structured Machote v1", async ({ page }) => {
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "VERSION UNO: {{persona.nombre}}",
      doc: v1,
    });
    templateId = template.id;
    await createTestTemplateField(registry, templateId, {
      field_key: "persona.nombre",
      label: "Nombre v1",
      required: true,
    });

    await page.goto(`/dashboard/documents/new/${templateId}`);
    await fillInlineVariable(page, "persona.nombre", "Ana V1");
    await page.getByRole("button", { name: /Cambiar variante de Modalidad v1/ }).click();
    await page.getByRole("radio", { name: "Por poder" }).click();
    await page.getByRole("button", { name: "Crear escritura" }).click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/[0-9a-f-]{36}/, { timeout: 15_000 });
    v1DocumentUrl = page.url();
    await registerCreatedViaUi(registry, "documents", "title", v1Title);
    await expect(documentRegion(page).getByText("VERSION UNO:", { exact: true })).toBeVisible();
    await expect(documentRegion(page).getByText("POR PODER v1", { exact: true })).toBeVisible();
  });

  test("C-F: a later Machote v2 does not alter preview, edit, lifecycle, duplication or DOCX", async ({ page }) => {
    await updateTestTemplateContent(templateId, "VERSION DOS: {{parte.nombre}}", v2);
    await page.goto(v1DocumentUrl);
    await expect(documentRegion(page).getByText("VERSION UNO:", { exact: true })).toBeVisible();
    await expect(documentRegion(page).getByText("VERSION DOS:", { exact: true })).toHaveCount(0);
    await expect(documentRegion(page).getByText("POR PODER v1", { exact: true })).toBeVisible();

    await fillInlineVariable(page, "persona.nombre", "Ana V1 editada");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByRole("status").getByText("Escritura guardada.")).toBeVisible({ timeout: 15_000 });
    expect(await downloadedText(page)).toContain("VERSION UNO: Ana V1 editada POR PODER v1");

    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Finalizar escritura" }).click();
    await expect(page.getByRole("button", { name: "Reabrir escritura" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Reabrir escritura" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Reabrir escritura" }).click();
    await expect(page.getByRole("button", { name: "Finalizar escritura" })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Duplicar" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Duplicar" }).click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/[0-9a-f-]{36}/, { timeout: 15_000 });
    const duplicateId = new URL(page.url()).pathname.split("/").pop();
    if (duplicateId) registry.register("documents", duplicateId);
    await expect(documentRegion(page).getByText("VERSION UNO:", { exact: true })).toBeVisible();
    await expect(documentRegion(page).getByText("POR PODER v1", { exact: true })).toBeVisible();
  });

  test("G-H: a new Escritura created after the edit uses Machote v2", async ({ page }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);
    await expect(documentRegion(page).getByText("VERSION DOS:", { exact: true })).toBeVisible();
    await expect(documentRegion(page).getByText("VERSION UNO:", { exact: true })).toHaveCount(0);
    await fillInlineVariable(page, "parte.nombre", "Beatriz V2");
    await page.getByRole("button", { name: "Crear escritura" }).click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/[0-9a-f-]{36}/, { timeout: 15_000 });
    const newDocumentId = new URL(page.url()).pathname.split("/").pop();
    if (newDocumentId) registry.register("documents", newDocumentId);
    expect(await downloadedText(page)).toContain("VERSION DOS: Beatriz V2 DIRECTA v2");
  });
});
