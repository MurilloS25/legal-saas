import { test, expect } from "@playwright/test";
import {
  CleanupRegistry,
  cleanupNotarialExports,
  createTestDocument,
  createTestNotarialMetadata,
  createTestTemplate,
  createTestTemplateField,
  runCleanup,
  setTestDocumentStatus,
  uniqueName,
} from "./support/factories";

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const token = uniqueName("nix", "t").split("-").pop() as string;
const templateName = uniqueName("nix", "machote");
const instrument = 700_000 + Math.floor(Math.random() * 100_000);
const actType = `Poder ${token}`;
const parties = ` =PARTES-${token}`;
const secretNote = `SECRETO-${token}`;

test.describe("notarial index CSV export", () => {
  test.afterAll(async () => {
    // Las filas de auditoría de exportación no cascadean con documents.
    await cleanupNotarialExports();
    await runCleanup(registry, "nix");
  });

  test("A: seed a finalized document with notarial metadata", async () => {
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "ESCRITURA {{parte.nombre}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "parte.nombre",
      label: "Parte",
      required: true,
    });
    const doc = await createTestDocument(registry, template.id, {
      title: `${token} Final`,
      field_values: { "parte.nombre": "Persona" },
      rendered_content: "x",
    });
    await createTestNotarialMetadata(doc.id, {
      instrument_number: instrument,
      authorized_at: "2026-07-15T16:35:00.000Z",
      act_type: actType,
      appearing_parties_summary: parties,
      notes: secretNote,
    });
    await setTestDocumentStatus(doc.id, "final");
  });

  test("B: exports a safe CSV honoring the search filter", async ({ page }) => {
    const response = await page.request.get(
      `/api/notarial-index/export?search=${token}`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    expect(response.headers()["content-disposition"]).toContain("attachment");
    expect(response.headers()["content-disposition"]).toContain(".csv");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");

    const body = await response.text();
    // BOM UTF-8 al inicio.
    expect(body.charCodeAt(0)).toBe(0xfeff);
    // Encabezado.
    expect(body).toContain("Número,Fecha,Hora,Tipo de acto");
    // Contenido esperado.
    expect(body).toContain(actType);
    expect(body).toContain(parties);
    expect(body).toContain(String(instrument));
    // CSV injection neutralizada: la celda de texto con '=' se antepone con apóstrofo.
    expect(body).toContain(`' =PARTES-${token}`);
    // Las notas internas NO se exportan.
    expect(body).not.toContain(secretNote);
    // No se exponen UUIDs.
    expect(body).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i);
  });

  test("C: the export is recorded and shown as last export", async ({
    page,
  }) => {
    await page.goto("/dashboard/notarial-index");
    await expect(page.getByText(/Última exportación:/)).toBeVisible();
  });

  test("D: the export button is present in the workspace", async ({ page }) => {
    await page.goto("/dashboard/notarial-index");
    await expect(
      page.getByRole("link", { name: "Exportar CSV" }),
    ).toBeVisible();
  });

  test("E: an empty filter still returns a valid CSV with only the header", async ({
    page,
  }) => {
    const response = await page.request.get(
      `/api/notarial-index/export?search=zzz-no-match-${token}`,
    );
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("Número,Fecha,Hora");
    expect(body).not.toContain(actType);
  });

  test("F: anonymous requests are rejected", async ({ browser, baseURL }) => {
    const anon = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const response = await anon.request.get(
      `${baseURL}/api/notarial-index/export`,
    );
    expect(response.status()).toBe(401);
    await anon.close();
  });
});
