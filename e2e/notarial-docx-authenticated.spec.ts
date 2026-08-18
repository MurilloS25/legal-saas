import { expect, test } from "@playwright/test";
import { extractDocxText, readDocx } from "../test/support/docx";
import {
  CleanupRegistry,
  cleanupNotarialExports,
  createTestDocument,
  createTestNotarialMetadata,
  createTestTemplate,
  replaceTestLawyerProfile,
  removeTestLawyerProfile,
  restoreTestLawyerProfile,
  runCleanup,
  setTestDocumentStatus,
  type TestLawyerProfile,
  uniqueName,
} from "./support/factories";

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();
const token = uniqueName("notarial-docx", "flow");
const selection = "year=2026&month=7&half=FIRST_HALF";
let previousProfile: TestLawyerProfile | null = null;

test.describe("notarial index DOCX export", () => {
  test.beforeAll(async () => {
    previousProfile = await replaceTestLawyerProfile("Notaria Prueba E2E");
    const template = await createTestTemplate(registry, {
      name: `${token} Machote`,
      content: "ESCRITURA FAKE.",
    });
    for (const input of [
      {
        instrument: 2,
        authorizedAt: "2026-07-15T16:00:00.000Z",
        parties: null,
      },
      {
        instrument: 1,
        authorizedAt: "2026-07-01T16:00:00.000Z",
        parties: `${token} PARTE COMPLETA`,
      },
      {
        instrument: 3,
        authorizedAt: "2026-07-16T16:00:00.000Z",
        parties: `${token} OTRA QUINCENA`,
      },
    ]) {
      const document = await createTestDocument(registry, template.id, {
        title: `${token} ${input.instrument}`,
        rendered_content: "Contenido fake",
      });
      await createTestNotarialMetadata(document.id, {
        instrument_number: 800_000 + input.instrument,
        authorized_at: input.authorizedAt,
        act_type: `${token} ACTO`,
        appearing_parties_summary: input.parties ?? undefined,
      });
      await setTestDocumentStatus(document.id, "final");
    }
  });

  test.afterAll(async () => {
    await cleanupNotarialExports();
    await runCleanup(registry, "notarial-docx");
    await restoreTestLawyerProfile(previousProfile);
  });

  test("selects a fortnight and warns without blocking export", async ({ page }) => {
    await page.goto(`/dashboard/notarial-index?${selection}&search=${token}`);
    await expect(page.getByLabel("Año")).toHaveValue("2026");
    await expect(page.getByLabel("Mes")).toHaveValue("7");
    await expect(page.getByLabel("Quincena")).toHaveValue("FIRST_HALF");
    const warning = page
      .getByRole("alert")
      .filter({ hasText: "1 registro incompleto" });
    await expect(warning).toBeVisible();
    await expect(warning).toContainText("Partes");
    await expect(page.getByRole("button", { name: "Exportar Word" })).toBeVisible();
  });

  // Regresión: "Exportar Word" generaba el archivo de inmediato, sin avisar
  // al usuario que los datos incompletos aparecerían con campos faltantes.
  test("clicking Exportar Word opens a confirmation dialog; Cancelar closes it without exporting", async ({
    page,
  }) => {
    await page.goto(`/dashboard/notarial-index?${selection}&search=${token}`);
    await page.getByRole("button", { name: "Exportar Word" }).click();

    const dialog = page.getByRole("alertdialog", {
      name: "¿Exportar Índice Notarial a Word?",
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/se generará con la información actualmente configurada/),
    ).toBeVisible();

    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("confirming the dialog downloads the Word file and stays on the Índice", async ({
    page,
  }) => {
    await page.goto(`/dashboard/notarial-index?${selection}&search=${token}`);
    await page.getByRole("button", { name: "Exportar Word" }).click();
    const dialog = page.getByRole("alertdialog", {
      name: "¿Exportar Índice Notarial a Word?",
    });

    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Exportar Word" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(
      "indice-notarial-primera-quincena-julio-2026.docx",
    );

    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Índice notarial", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Índice notarial exportado.", { exact: true }),
    ).toBeVisible();
  });

  test("downloads all selected rows as an ordered DOCX", async ({ page }) => {
    const response = await page.request.get(`/api/notarial-index/export?${selection}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(response.headers()["content-disposition"]).toContain(
      "indice-notarial-primera-quincena-julio-2026.docx",
    );
    const text = extractDocxText((await readDocx(await response.body())).documentXml);
    const first = text.indexOf("800001");
    const second = text.indexOf("800002");
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
    expect(text).not.toContain("800003");
    expect(text).toContain("NOTARIA PRUEBA E2E");
  });

  test("applies the visible server filters to the exported DOCX", async ({
    request,
  }) => {
    const response = await request.get(
      `/api/notarial-index/export?${selection}&search=800001`,
    );
    expect(response.status()).toBe(200);
    const text = extractDocxText(
      (await readDocx(await response.body())).documentXml,
    );
    expect(text).toContain("800001");
    expect(text).not.toContain("800002");
  });

  test("removes CSV from the user-facing workflow", async ({ page }) => {
    await page.goto(`/dashboard/notarial-index?${selection}`);
    await expect(page.getByText(/CSV/i)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /CSV/i })).toHaveCount(0);
  });

  test("generates a valid empty-period Word", async ({ request }) => {
    const response = await request.get(
      "/api/notarial-index/export?year=2026&month=1&half=FIRST_HALF",
    );
    expect(response.status()).toBe(200);
    const text = extractDocxText((await readDocx(await response.body())).documentXml);
    expect(text).toContain("No hay instrumentos registrados para esta quincena.");
  });

  test("requires a notary name without exposing internals", async ({ request }) => {
    await removeTestLawyerProfile();
    try {
      const response = await request.get(`/api/notarial-index/export?${selection}`);
      expect(response.status()).toBe(400);
      expect(await response.text()).toContain("Completa tu nombre");
    } finally {
      await replaceTestLawyerProfile("Notaria Prueba E2E");
    }
  });

  // Regresión: cuando faltaba el nombre del notario, el enlace de exportación
  // navegaba de lleno al endpoint y el navegador terminaba mostrando el JSON
  // crudo del error como si fuera la página. Ahora la descarga va por fetch,
  // así que un 400 debe quedarse en el Índice y mostrarse como toast.
  test("missing notary profile keeps the user on the Índice with a friendly toast, no raw error page", async ({
    page,
  }) => {
    await removeTestLawyerProfile();
    try {
      await page.goto(`/dashboard/notarial-index?${selection}&search=${token}`);
      await page.getByRole("button", { name: "Exportar Word" }).click();
      const dialog = page.getByRole("alertdialog", {
        name: "¿Exportar Índice Notarial a Word?",
      });
      await dialog.getByRole("button", { name: "Exportar Word" }).click();

      // El mensaje real del servidor para este caso específico — no un
      // genérico inventado ni el JSON crudo de la respuesta.
      await expect(
        page.getByText(
          "Completa tu nombre en Configuración antes de generar el índice.",
          { exact: true },
        ),
      ).toBeVisible({ timeout: 15_000 });

      // Sigue en el Índice: nunca navegó a una página de error ni mostró el
      // JSON crudo `{"error": ...}` como contenido de la página.
      await expect(
        page.getByRole("heading", { name: "Índice notarial", exact: true }),
      ).toBeVisible();
      await expect(page.getByText('{"error"', { exact: false })).toHaveCount(0);
    } finally {
      await replaceTestLawyerProfile("Notaria Prueba E2E");
    }
  });

  test("rejects invalid selection and anonymous access", async ({
    browser,
    baseURL,
    request,
  }) => {
    expect(
      (await request.get("/api/notarial-index/export?year=x")).status(),
    ).toBe(400);
    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const response = await anonymous.request.get(
      `${baseURL}/api/notarial-index/export?${selection}`,
    );
    expect(response.status()).toBe(401);
    await anonymous.close();
  });
});
