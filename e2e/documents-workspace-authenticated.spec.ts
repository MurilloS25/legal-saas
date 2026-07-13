import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
  createTestDocument,
  createTestTemplate,
  createTestTemplateField,
  runCleanup,
  uniqueName,
} from "./support/factories";

// Serial: comparten el conjunto sembrado del mismo usuario.
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

// Token único para que búsqueda/filtros sean deterministas frente a otros datos.
const token = uniqueName("ws", "tok").split("-").pop() as string;
const clientAlpha = `ClienteAlpha ${token}`;
const clientBeta = `ClienteBeta ${token}`;
const templateUno = `MachoteUno ${token}`;
const templateDos = `MachoteDos ${token}`;
const titleAlpha = `Alpha Uno ${token}`;
const titleBeta = `Beta Dos ${token}`;
const titleGamma = `Gamma Uno ${token}`;

let clientAlphaId = "";
let templateDosId = "";

function row(page: Page, title: string) {
  return page.locator("li").filter({ hasText: title });
}

async function search(page: Page, term: string) {
  await page.goto("/dashboard/documents");
  await page.getByLabel("Buscar").fill(term);
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page).toHaveURL(/search=/, { timeout: 15_000 });
}

test.describe("documents workspace management", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "ws");
  });

  test("A: seed clients, templates and documents", async () => {
    const a = await createTestClient(registry, { full_name: clientAlpha });
    clientAlphaId = a.id;
    const b = await createTestClient(registry, { full_name: clientBeta });

    const t1 = await createTestTemplate(registry, {
      name: templateUno,
      content: "Uno {{parte.nombre}}.",
    });
    await createTestTemplateField(registry, t1.id, {
      field_key: "parte.nombre",
      label: "Parte",
      required: true,
    });
    const t2 = await createTestTemplate(registry, {
      name: templateDos,
      content: "Dos {{parte.nombre}}.",
    });
    templateDosId = t2.id;
    await createTestTemplateField(registry, t2.id, {
      field_key: "parte.nombre",
      label: "Parte",
      required: true,
    });

    await createTestDocument(registry, t1.id, {
      title: titleAlpha,
      client_id: a.id,
      field_values: { "parte.nombre": "Persona A" },
      rendered_content: "Uno Persona A.",
    });
    await createTestDocument(registry, t2.id, {
      title: titleBeta,
      client_id: b.id,
      field_values: { "parte.nombre": "Persona B" },
      rendered_content: "Dos Persona B.",
    });
    await createTestDocument(registry, t1.id, {
      title: titleGamma,
      field_values: {},
      rendered_content: "Uno {{parte.nombre}}.",
    });
  });

  test("B: searching by title finds a single document", async ({ page }) => {
    await search(page, titleAlpha);
    await expect(row(page, titleAlpha)).toBeVisible();
    await expect(row(page, titleBeta)).toHaveCount(0);
  });

  test("C: searching by client name matches its documents", async ({ page }) => {
    await search(page, clientBeta);
    await expect(row(page, titleBeta)).toBeVisible();
    await expect(row(page, titleAlpha)).toHaveCount(0);
  });

  test("D: searching by template name matches its documents", async ({
    page,
  }) => {
    await search(page, templateUno);
    await expect(row(page, titleAlpha)).toBeVisible();
    await expect(row(page, titleGamma)).toBeVisible();
    await expect(row(page, titleBeta)).toHaveCount(0);
  });

  test("E: filtering by client narrows results and survives reload", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents?client=${clientAlphaId}`);
    await expect(row(page, titleAlpha)).toBeVisible();
    await expect(row(page, titleBeta)).toHaveCount(0);

    await page.reload();
    await expect(row(page, titleAlpha)).toBeVisible();
    await expect(page.getByLabel("Cliente")).toHaveValue(clientAlphaId);
  });

  test("F: filtering by template works", async ({ page }) => {
    await page.goto(`/dashboard/documents?template=${templateDosId}`);
    await expect(row(page, titleBeta)).toBeVisible();
    await expect(row(page, titleAlpha)).toHaveCount(0);
  });

  test("G: sorting by title A–Z orders the seeded rows", async ({ page }) => {
    await search(page, token);
    await page.getByLabel("Orden").selectOption("title_az");
    await expect(page).toHaveURL(/sort=title_az/, { timeout: 15_000 });

    // Solo las filas sembradas contienen el token; se leen en orden del DOM.
    const seeded = await page
      .locator("li")
      .filter({ hasText: token })
      .locator("p.font-medium")
      .allInnerTexts();
    expect(seeded).toEqual([titleAlpha, titleBeta, titleGamma]);
  });

  test("H: clear filters resets the workspace", async ({ page }) => {
    await page.goto(`/dashboard/documents?client=${clientAlphaId}`);
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page).toHaveURL(/\/dashboard\/documents$/, { timeout: 15_000 });
    await expect(row(page, titleBeta)).toBeVisible();
  });

  test("I: a search with no matches shows the no-results state", async ({
    page,
  }) => {
    await search(page, `zzz-no-match-${token}`);
    await expect(
      page.getByText("No encontramos escrituras con esos filtros"),
    ).toBeVisible();
    await page.getByRole("link", { name: "Limpiar filtros" }).click();
    await expect(page).toHaveURL(/\/dashboard\/documents$/, { timeout: 15_000 });
  });

  test("J: invalid query params are ignored safely", async ({ page }) => {
    await page.goto(
      "/dashboard/documents?sort=DROP%20TABLE&status=bogus&page=-3&client=notauuid",
    );
    // La página sigue funcionando con defaults.
    await expect(
      page.getByRole("heading", { name: "Escrituras", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Orden")).toHaveValue("recent");
    await expect(page.getByLabel("Estado")).toHaveValue("");
  });

  test("K: user can download a Word file from the list", async ({ page }) => {
    await search(page, titleAlpha);
    const downloadPromise = page.waitForEvent("download");
    await row(page, titleAlpha)
      .getByRole("button", { name: `Descargar Word de ${titleAlpha}` })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.docx$/);
  });

  test("L: the toolbar is usable on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard/documents");
    await expect(page.getByLabel("Buscar")).toBeVisible();
    await expect(page.getByLabel("Estado")).toBeVisible();
    await page.getByLabel("Buscar").fill(titleGamma);
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(row(page, titleGamma)).toBeVisible();
  });
});
