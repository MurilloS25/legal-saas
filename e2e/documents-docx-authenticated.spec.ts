import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import {
  CleanupRegistry,
  createTestDocument,
  createTestTemplate,
  createTestTemplateField,
  runCleanup,
  updateTestTemplateContent,
  uniqueName,
} from "./support/factories";

// Serial: comparten machote y borradores del mismo usuario.
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const templateName = uniqueName("docx", "machote");
const completeTitle = `${templateName} — Completo`;
const pendingTitle = `${templateName} — Pendiente`;
const fieldKey = "comprador.nombre";
const fieldLabel = "Nombre del comprador";

let completeDocId = "";
let pendingDocId = "";

/** Verifica que el buffer es un .docx OOXML válido (ZIP con sus partes). */
async function assertValidDocx(buffer: Buffer): Promise<void> {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files);
  expect(names).toContain("[Content_Types].xml");
  expect(names).toContain("_rels/.rels");
  expect(names).toContain("word/document.xml");
}

/** Texto plano de word/document.xml (concatena los nodos de texto). */
async function docxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")!.async("string");
  return [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((m) =>
      m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
    )
    .join("");
}

async function openComposer(page: Page, docId: string) {
  await page.goto(`/dashboard/documents/${docId}`);
  await expect(
    page.getByRole("region", { name: "Datos de la escritura" }),
  ).toBeVisible();
}

test.describe("document docx download", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "docx");
  });

  test("A: seed a template and two persisted drafts", async () => {
    const template = await createTestTemplate(registry, {
      name: templateName,
      content:
        "ESCRITURA. Comparece {{comprador.nombre}}, placa {{vehiculo.placa}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: fieldKey,
      label: fieldLabel,
      required: true,
    });

    // Un borrador con ambas variables resueltas.
    const complete = await createTestDocument(registry, template.id, {
      title: completeTitle,
      field_values: {
        "comprador.nombre": "Cliente Uno",
        "vehiculo.placa": "ABC-123",
      },
      rendered_content: "ESCRITURA. Comparece Cliente Uno, placa ABC-123.",
    });
    completeDocId = complete.id;

    // Un borrador con una variable pendiente.
    const pending = await createTestDocument(registry, template.id, {
      title: pendingTitle,
      field_values: { "comprador.nombre": "Cliente Dos" },
      rendered_content:
        "ESCRITURA. Comparece Cliente Dos, placa {{vehiculo.placa}}.",
    });
    pendingDocId = pending.id;
  });

  test("B: the download button appears on a saved draft", async ({ page }) => {
    await openComposer(page, completeDocId);
    await expect(
      page.getByRole("button", { name: "Descargar Word" }),
    ).toBeVisible();
    await expect(
      page.getByText("El archivo se genera con la última versión guardada."),
    ).toBeVisible();
  });

  test("C: unsaved changes disable the download until saved", async ({
    page,
  }) => {
    await openComposer(page, completeDocId);

    // Provoca un cambio local sin guardar.
    await page
      .getByRole("region", { name: "Datos de la escritura" })
      .getByLabel(new RegExp(fieldLabel))
      .fill("Cliente Uno Editado");

    const button = page.getByRole("button", { name: "Descargar Word" });
    await expect(button).toBeDisabled();
    await expect(
      page.getByText("Guarda los cambios antes de descargar el Word."),
    ).toBeVisible();

    // Guardar reactiva la descarga.
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(
      page.getByText("Borrador guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(button).toBeEnabled();
  });

  test("D: downloads a valid docx with the resolved content", async ({
    page,
  }) => {
    await openComposer(page, completeDocId);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar Word" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.docx$/);
    const buffer = readFileSync(await download.path());

    await assertValidDocx(buffer);
    const text = await docxText(buffer);
    expect(text).toContain("Cliente Uno Editado");
    expect(text).toContain("ABC-123");
  });

  test("D2: exports the saved snapshot if the template changed later", async ({
    page,
  }) => {
    const snapshotTemplate = await createTestTemplate(registry, {
      name: uniqueName("docx-snapshot", "machote"),
      content: "VERSION GUARDADA {{parte.nombre}}.",
    });
    const snapshotDoc = await createTestDocument(registry, snapshotTemplate.id, {
      title: uniqueName("docx-snapshot", "documento"),
      field_values: { "parte.nombre": "Cliente Snapshot" },
      rendered_content: "VERSION GUARDADA Cliente Snapshot.",
    });

    await updateTestTemplateContent(
      snapshotTemplate.id,
      "VERSION CAMBIADA {{parte.nombre}}.",
    );

    const response = await page.request.get(
      `/api/documents/${snapshotDoc.id}/docx`,
    );
    expect(response.status()).toBe(200);

    const text = await docxText(await response.body());
    expect(text).toContain("VERSION GUARDADA Cliente Snapshot.");
    expect(text).not.toContain("VERSION CAMBIADA Cliente Snapshot.");
  });

  test("E: the endpoint returns the correct MIME and disposition", async ({
    page,
  }) => {
    const response = await page.request.get(
      `/api/documents/${completeDocId}/docx`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain(
      "officedocument.wordprocessingml.document",
    );
    expect(response.headers()["content-disposition"]).toContain("attachment");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    const body = await response.body();
    expect(body.byteLength).toBeGreaterThan(0);
    // Firma de un ZIP ("PK").
    expect(body[0]).toBe(0x50);
    expect(body[1]).toBe(0x4b);
  });

  test("F: pending variables trigger a confirmation before downloading", async ({
    page,
  }) => {
    await openComposer(page, pendingDocId);

    await page.getByRole("button", { name: "Descargar Word" }).click();

    const dialog = page.getByRole("dialog", {
      name: "Hay variables sin completar",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/1 variable pendiente/)).toBeVisible();

    // Cancelar no descarga.
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("G: 'download anyway' produces a docx with the pending placeholder", async ({
    page,
  }) => {
    await openComposer(page, pendingDocId);
    await page.getByRole("button", { name: "Descargar Word" }).click();

    const dialog = page.getByRole("dialog", {
      name: "Hay variables sin completar",
    });
    const downloadPromise = page.waitForEvent("download");
    await dialog
      .getByRole("button", { name: "Descargar de todas formas" })
      .click();
    const download = await downloadPromise;

    const buffer = readFileSync(await download.path());
    const text = await docxText(buffer);
    expect(text).toContain("Cliente Dos");
    // La variable sin valor permanece visible.
    expect(text).toContain("{{vehiculo.placa}}");
  });

  test("H: a nonexistent or foreign document returns 404", async ({ page }) => {
    const response = await page.request.get(
      "/api/documents/00000000-0000-0000-0000-000000000000/docx",
    );
    expect(response.status()).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("No fue posible generar el documento.");
  });

  test("I: an invalid id returns 404", async ({ page }) => {
    const response = await page.request.get("/api/documents/not-a-uuid/docx");
    expect(response.status()).toBe(404);
  });

  test("J: anonymous requests are rejected", async ({ browser, baseURL }) => {
    // storageState explícitamente vacío: el contexto no debe heredar la
    // sesión del proyecto autenticado.
    const anon = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const response = await anon.request.get(
      `${baseURL}/api/documents/${completeDocId}/docx`,
    );
    expect(response.status()).toBe(401);
    await anon.close();
  });

  test("K: the download button works on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openComposer(page, completeDocId);

    const button = page.getByRole("button", { name: "Descargar Word" });
    await expect(button).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await button.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.docx$/);
  });
});
