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
import { restRpc, restSelect, restUpdate } from "./support/supabase-api";
import { openAndConfirmWordDownload } from "./support/word-download";

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();
const templateName = uniqueName("document-snapshot", "machote");
const v1TemplateName = `${templateName} V1`;
const v2TemplateName = `${templateName} V2`;
const v1Title = `${v1TemplateName} — Borrador`;
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
  await openAndConfirmWordDownload(
    page,
    page.getByRole("button", { name: "Descargar Word" }),
  );
  const zip = await JSZip.loadAsync(readFileSync(await (await downloadPromise).path()));
  const xml = await zip.file("word/document.xml")!.async("string");
  return [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join("");
}

async function configureNotarialParties(
  templateId: string,
  templateFieldId: string,
  fixedSuffix: string,
) {
  await restRpc("save_template_index_mapping_with_block_source", {
    p_template_id: templateId,
    p_simple_fields: {
      instrument_number: null,
      authorized_date: null,
      authorized_time: null,
      protocol_book: null,
      initial_folio: null,
      final_folio: null,
    },
    p_authorized_time_option_block_id: null,
    p_party_separator: " Y ",
    p_fixed_suffix: fixedSuffix,
    p_allow_empty: false,
    p_party_fields: [{ template_field_id: templateFieldId, sort_order: 0 }],
  });
}

async function expectNotarialSnapshot(
  page: Page,
  templateName: string,
  parties: string,
) {
  await page.getByRole("tab", { name: "Índice" }).click();
  await expect(page.getByRole("button", { name: /Acto o contrato/ })).toContainText(
    templateName,
  );
  await page.getByRole("button", { name: /^Partes/ }).click();
  await expect(page.getByRole("textbox", { name: "Partes" })).toHaveAttribute(
    "placeholder",
    parties,
  );
}

test.describe("document template snapshot", () => {
  test.afterAll(async () => runCleanup(registry, "document-snapshot"));

  test("A-B: creates and saves an Escritura from structured Machote v1", async ({ page }) => {
    const template = await createTestTemplate(registry, {
      name: v1TemplateName,
      content: "VERSION UNO: {{persona.nombre}}",
      doc: v1,
    });
    templateId = template.id;
    const v1Field = await createTestTemplateField(registry, templateId, {
      field_key: "persona.nombre",
      label: "Nombre v1",
      required: true,
    });
    await configureNotarialParties(templateId, v1Field.id, "VERSION V1");

    await page.goto(`/documents/new/${templateId}`);
    await fillInlineVariable(page, "persona.nombre", "Ana V1");
    await page.getByRole("button", { name: /Cambiar variante de Modalidad v1/ }).click();
    await page.getByRole("radio", { name: "Por poder" }).click();
    await page.getByRole("button", { name: "Crear escritura" }).click();
    await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}/, { timeout: 15_000 });
    v1DocumentUrl = page.url();
    await registerCreatedViaUi(registry, "documents", "title", v1Title);
    await expect(documentRegion(page).getByText("VERSION UNO:", { exact: true })).toBeVisible();
    await expect(documentRegion(page).getByText("POR PODER v1", { exact: true })).toBeVisible();
  });

  test("C-F: a later Machote v2 does not alter preview, edit, lifecycle, duplication or DOCX", async ({ page }) => {
    await updateTestTemplateContent(templateId, "VERSION DOS: {{parte.nombre}}", v2);
    await restUpdate("templates", templateId, { name: v2TemplateName });
    const v2Field = await createTestTemplateField(registry, templateId, {
      field_key: "parte.nombre",
      label: "Nombre v2",
      required: true,
    });
    await configureNotarialParties(templateId, v2Field.id, "VERSION V2");
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
    await expectNotarialSnapshot(page, v1TemplateName, "ANA V1 EDITADA Y VERSION V1");
    await page.getByRole("button", { name: /Número de instrumento/ }).click();
    await page.getByRole("spinbutton", { name: "Número de instrumento" }).fill("101");
    await page.locator("[data-workspace-action-dock]").getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText("Cambios del índice guardados.", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    const v1DocumentId = new URL(v1DocumentUrl).pathname.split("/").pop();
    const [v1Metadata] = await restSelect<{
      act_name_snapshot: string | null;
      generated_parties: string | null;
    }>(
      `document_notarial_metadata?document_id=eq.${v1DocumentId}&select=act_name_snapshot,generated_parties`,
    );
    expect(v1Metadata).toMatchObject({
      act_name_snapshot: v1TemplateName,
      generated_parties: "ANA V1 EDITADA Y VERSION V1",
    });
    await page.getByRole("button", { name: "Reabrir escritura" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Reabrir escritura" }).click();
    await expect(page.getByRole("button", { name: "Finalizar escritura" })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Duplicar" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Duplicar" }).click();
    await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}/, { timeout: 15_000 });
    const duplicateId = new URL(page.url()).pathname.split("/").pop();
    if (duplicateId) registry.register("documents", duplicateId);
    await expect(documentRegion(page).getByText("VERSION UNO:", { exact: true })).toBeVisible();
    await expect(documentRegion(page).getByText("POR PODER v1", { exact: true })).toBeVisible();
  });

  test("G-H: a new Escritura created after the edit uses Machote v2", async ({ page }) => {
    await page.goto(`/documents/new/${templateId}`);
    await expect(documentRegion(page).getByText("VERSION DOS:", { exact: true })).toBeVisible();
    await expect(documentRegion(page).getByText("VERSION UNO:", { exact: true })).toHaveCount(0);
    await fillInlineVariable(page, "parte.nombre", "Beatriz V2");
    await page.getByRole("button", { name: "Crear escritura" }).click();
    await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}/, { timeout: 15_000 });
    const newDocumentId = new URL(page.url()).pathname.split("/").pop();
    if (newDocumentId) registry.register("documents", newDocumentId);
    expect(await downloadedText(page)).toContain("VERSION DOS: Beatriz V2 DIRECTA v2");
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Finalizar escritura" }).click();
    await expect(page.getByRole("button", { name: "Reabrir escritura" })).toBeVisible({ timeout: 15_000 });
    await expectNotarialSnapshot(page, v2TemplateName, "BEATRIZ V2 Y VERSION V2");
    await page.getByRole("button", { name: /Número de instrumento/ }).click();
    await page.getByRole("spinbutton", { name: "Número de instrumento" }).fill("102");
    await page.locator("[data-workspace-action-dock]").getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText("Cambios del índice guardados.", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    const [v2Metadata] = await restSelect<{
      act_name_snapshot: string | null;
      generated_parties: string | null;
    }>(
      `document_notarial_metadata?document_id=eq.${newDocumentId}&select=act_name_snapshot,generated_parties`,
    );
    expect(v2Metadata).toMatchObject({
      act_name_snapshot: v2TemplateName,
      generated_parties: "BEATRIZ V2 Y VERSION V2",
    });
  });
});
