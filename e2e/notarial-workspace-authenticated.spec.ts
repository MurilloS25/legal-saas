import { test, expect, type Page, type Locator } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
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

const token = uniqueName("niw", "t").split("-").pop() as string;
const templateName = uniqueName("niw", "machote");
const instrument = 600_000 + Math.floor(Math.random() * 100_000);
const actType = `Compraventa ${token}`;
const clientName = `Cliente ${token}`;
const authorizedAt = "2026-07-15T16:35:00.000Z"; // 10:35 CR el 2026-07-15
const liveSearchTerm = `Objetivo Dinámico ${token}`;

let completeId = "";
let incompleteId = "";
let missingId = "";
let secondHalfId = "";
let draftId = "";
let liveSearchId = "";

async function seedFinal(
  templateId: string,
  title: string,
  metadata: Parameters<typeof createTestNotarialMetadata>[1] | null,
): Promise<string> {
  const doc = await createTestDocument(registry, templateId, {
    title,
    field_values: { "parte.nombre": "Persona" },
    rendered_content: "x",
  });
  if (metadata) await createTestNotarialMetadata(doc.id, metadata);
  await setTestDocumentStatus(doc.id, "final");
  return doc.id;
}

async function search(page: Page, term: string, extra = "") {
  await page.goto(
    `/dashboard/notarial-index?year=2026&month=7&half=FIRST_HALF&search=${encodeURIComponent(term)}${extra}`,
  );
  await expect(
    page.getByRole("heading", { name: "Índice notarial", exact: true }),
  ).toBeVisible();
}

function rowFor(page: Page, docId: string): Locator {
  return page
    .locator("tr")
    .filter({ has: page.locator(`a[href="/dashboard/documents/${docId}"]`) });
}

test.describe("notarial index workspace", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "niw");
  });

  test("A: seed finalized documents with varying completeness", async () => {
    const client = await createTestClient(registry, { full_name: clientName });
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "ESCRITURA {{parte.nombre}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "parte.nombre",
      label: "Parte",
      required: true,
    });

    const complete = await createTestDocument(registry, template.id, {
      title: `${token} Completo`,
      client_id: client.id,
      field_values: { "parte.nombre": "Persona" },
      rendered_content: "x",
    });
    await createTestNotarialMetadata(complete.id, {
      instrument_number: instrument,
      authorized_at: authorizedAt,
      act_type: actType,
      appearing_parties_summary: `Comparecientes ${token}`,
    });
    await setTestDocumentStatus(complete.id, "final");
    completeId = complete.id;
    incompleteId = await seedFinal(template.id, `${token} Incompleto`, {
      authorized_at: "2026-07-15T17:00:00.000Z",
      appearing_parties_summary: `Solo partes ${token}`,
    });
    missingId = await seedFinal(template.id, `${token} SinDatos`, null);
    secondHalfId = await seedFinal(template.id, `${token} SegundaQuincena`, {
      instrument_number: instrument + 1,
      authorized_at: "2026-07-16T16:35:00.000Z",
      act_type: actType,
      appearing_parties_summary: `Segunda quincena ${token}`,
    });

    const draft = await createTestDocument(registry, template.id, {
      title: `${token} Borrador`,
      field_values: { "parte.nombre": "Persona" },
      rendered_content: "x",
    });
    draftId = draft.id;

    // Más de una página de resultados para probar que la búsqueda se aplica
    // en servidor antes de paginar, no solo sobre las filas visibles.
    const liveInstrumentBase = 200_000 + Math.floor(Math.random() * 10_000);
    for (let index = 0; index < 16; index += 1) {
      const document = await createTestDocument(registry, template.id, {
        title: index === 15 ? liveSearchTerm : `Registro auxiliar ${index}`,
        field_values: { "parte.nombre": `Persona ${index}` },
        rendered_content: `Contenido auxiliar ${index}`,
      });
      await createTestNotarialMetadata(document.id, {
        instrument_number: liveInstrumentBase + index,
        authorized_at: `2026-07-${String((index % 15) + 1).padStart(2, "0")}T16:00:00.000Z`,
        act_type: "Donación de prueba",
        appearing_parties_summary: `Parte auxiliar ${index}`,
      });
      await setTestDocumentStatus(document.id, "final");
      if (index === 15) liveSearchId = document.id;
    }
  });

  test("B: shows finalized entries with the disclaimer, excludes drafts", async ({
    page,
  }) => {
    await search(page, token);
    await expect(
      page.getByText(/No sustituye el índice oficial/),
    ).toBeVisible();
    await expect(rowFor(page, completeId)).toBeVisible();
    await expect(rowFor(page, incompleteId)).toBeVisible();
    await expect(rowFor(page, missingId)).toHaveCount(0);
    await expect(rowFor(page, secondHalfId)).toHaveCount(0);
    // Un borrador no aparece en el índice.
    await expect(rowFor(page, draftId)).toHaveCount(0);
  });

  test("C: distinguishes complete and incomplete entries in the fortnight", async ({ page }) => {
    await search(page, token);
    await expect(
      rowFor(page, completeId).getByText("Completo", { exact: true }),
    ).toBeVisible();
    await expect(
      rowFor(page, incompleteId).getByText("Incompleto", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("alert").filter({ hasText: "registro incompleto" }),
    ).toBeVisible();
  });

  test("C2: renders an accessible table with locally visible context columns", async ({
    page,
  }) => {
    await search(page, token);

    const table = page.getByRole("table", {
      name: "Escrituras finalizadas incluidas en el índice notarial interno",
    });
    await expect(table.getByRole("columnheader", { name: "Número" })).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Número" }),
    ).toHaveAttribute("aria-sort", "ascending");
    await expect(table.getByRole("columnheader", { name: "Cliente" })).toHaveCount(0);

    await page.getByText("Columnas", { exact: true }).click();
    await page.getByLabel("Cliente", { exact: true }).check();
    await page.getByLabel("Escritura", { exact: true }).check();

    await expect(table.getByRole("columnheader", { name: "Cliente" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Escritura" })).toBeVisible();
    await expect(rowFor(page, completeId).getByText(clientName)).toBeVisible();
    await expect(
      rowFor(page, completeId).getByText(`${token} Completo`, { exact: true }),
    ).toBeVisible();
  });

  test("D: filter by completeness = complete", async ({ page }) => {
    await search(page, token, "&completeness=complete");
    await expect(rowFor(page, completeId)).toBeVisible();
    await expect(rowFor(page, incompleteId)).toHaveCount(0);
    await expect(rowFor(page, missingId)).toHaveCount(0);
  });

  test("E: missing metadata cannot be assigned to a fortnight", async ({ page }) => {
    await search(page, token, "&completeness=missing");
    await expect(rowFor(page, missingId)).toHaveCount(0);
    await expect(rowFor(page, completeId)).toHaveCount(0);
  });

  test("F: filter by act type", async ({ page }) => {
    await search(page, token, `&act_type=${encodeURIComponent(actType)}`);
    await expect(rowFor(page, completeId)).toBeVisible();
    await expect(rowFor(page, incompleteId)).toHaveCount(0);
  });

  test("G: day 15 and day 16 belong to different fortnights", async ({ page }) => {
    await search(page, token);
    await expect(rowFor(page, completeId)).toBeVisible();
    await expect(rowFor(page, secondHalfId)).toHaveCount(0);
    await page.goto(
      `/dashboard/notarial-index?year=2026&month=7&half=SECOND_HALF&search=${token}`,
    );
    await expect(rowFor(page, completeId)).toHaveCount(0);
    await expect(rowFor(page, secondHalfId)).toBeVisible();
  });

  test("H: search by instrument number", async ({ page }) => {
    await search(page, String(instrument));
    await expect(rowFor(page, completeId)).toBeVisible();
    await expect(rowFor(page, missingId)).toHaveCount(0);
  });

  test("H2: live search queries all server rows, resets page and preserves filters", async ({
    page,
  }) => {
    await page.goto(
      "/dashboard/notarial-index?year=2026&month=7&half=FIRST_HALF&completeness=complete&page=2",
    );
    await expect(page.getByLabel("Buscar")).toBeVisible();

    const input = page.getByLabel("Buscar");
    await input.fill("Objetivo");
    await input.fill(liveSearchTerm);

    await expect
      .poll(() => new URL(page.url()).searchParams.get("search"), {
        timeout: 15_000,
      })
      .toBe(liveSearchTerm);
    const appliedUrl = new URL(page.url());
    expect(appliedUrl.searchParams.get("page")).toBeNull();
    expect(appliedUrl.searchParams.get("year")).toBe("2026");
    expect(appliedUrl.searchParams.get("month")).toBe("7");
    expect(appliedUrl.searchParams.get("half")).toBe("FIRST_HALF");
    expect(appliedUrl.searchParams.get("completeness")).toBe("complete");
    await expect(rowFor(page, liveSearchId)).toBeVisible();

    const filters = page.getByRole("group", {
      name: "Filtros del índice notarial",
    });
    await expect(filters).toHaveAttribute("aria-busy", "false");
    const exportUrl = new URL(
      (await page
        .getByRole("button", { name: "Exportar Word" })
        .getAttribute("data-export-href")) ?? "",
      "http://localhost:3000",
    );
    expect(exportUrl.searchParams.get("search")).toBe(liveSearchTerm);
    expect(exportUrl.searchParams.get("completeness")).toBe("complete");

    await page.getByLabel("Completitud").selectOption("");
    await expect(page).not.toHaveURL(/completeness=complete/);
    await page.goBack();
    await expect(page.getByLabel("Buscar")).toHaveValue(liveSearchTerm);
    await expect(page.getByLabel("Completitud")).toHaveValue("complete");
    await page.goForward();
    await expect(page.getByLabel("Buscar")).toHaveValue(liveSearchTerm);
    await expect(page.getByLabel("Completitud")).toHaveValue("");
    await page.goBack();
    await expect(page.getByLabel("Completitud")).toHaveValue("complete");

    await page.getByRole("button", { name: "Limpiar búsqueda" }).click();
    await expect(page).not.toHaveURL(/(?:\?|&)search=/, { timeout: 15_000 });
    expect(new URL(page.url()).searchParams.get("completeness")).toBe("complete");
  });

  test("I: special-character-only search does not broaden results", async ({
    page,
  }) => {
    await search(page, "%_(),'\"\\");
    await expect(
      page.getByText("No hay escrituras finalizadas con esos filtros"),
    ).toBeVisible();
    await expect(rowFor(page, completeId)).toHaveCount(0);
  });

  test("J: out-of-range page redirects to a valid page", async ({ page }) => {
    await search(page, token, "&page=999999");
    await expect(page).not.toHaveURL(/page=999999/);
    await expect(rowFor(page, completeId)).toBeVisible();
  });

  test("K: invalid query params are handled safely", async ({ page }) => {
    await page.goto(
      "/dashboard/notarial-index?year=bad&month=99&half=hack&completeness=x&page=-1",
    );
    await expect(
      page.getByRole("heading", { name: "Índice notarial", exact: true }),
    ).toBeVisible();
  });

  test("L: the sidebar link opens the index", async ({ page }) => {
    await page.goto("/dashboard");
    await page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Índice Notarial" })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/notarial-index/, {
      timeout: 15_000,
    });
  });

  test("M: the toolbar is usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard/notarial-index?year=2026&month=7&half=FIRST_HALF");
    await expect(page.getByLabel("Año")).toBeVisible();
    await expect(page.getByLabel("Mes")).toBeVisible();
    await expect(page.getByLabel("Quincena")).toBeVisible();
    await expect(page.getByLabel("Buscar")).toBeVisible();
    await expect(page.getByLabel("Completitud")).toBeVisible();
    await expect(
      page.getByRole("table", {
        name: "Escrituras finalizadas incluidas en el índice notarial interno",
      }),
    ).toBeVisible();
    const tableRegion = page.getByRole("region", {
      name: "Tabla del índice notarial",
    });
    await expect(tableRegion).toBeVisible();
    const box = await tableRegion.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
  });
});
