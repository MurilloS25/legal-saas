import { test, expect } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
  createTestDocument,
  createTestReceivable,
  createTestTemplate,
  runCleanup,
  setTestDocumentStatus,
  uniqueName,
} from "./support/factories";

/**
 * Paginación server-side compartida (`TablePagination` + `src/lib/pagination`)
 * — cubierta a fondo en Escrituras (el módulo con más filtros, así que
 * también ejercita "filtro resetea página, conserva pageSize") y con un
 * smoke dirigido en Clientes/Machotes/Cuentas por cobrar, que reutilizan el
 * mismo componente y la misma lógica de query. El Índice Notarial tiene su
 * propia cobertura de paginación + expansión inline en
 * notarial-inline-review-authenticated.spec.ts.
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

test.describe("table pagination", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "table-pagination");
  });

  test("A: seed enough documents to span multiple pages at the smallest page size", async () => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("table-pagination", "machote"),
      content: "ESCRITURA de prueba de paginación.",
    });
    const client = await createTestClient(registry, {
      full_name: uniqueName("table-pagination", "cliente"),
    });

    for (let i = 0; i < 7; i += 1) {
      await createTestDocument(registry, template.id, {
        title: `${uniqueName("table-pagination", "doc")}-${i}`,
        client_id: client.id,
        status: "draft",
      });
    }

    // Una cuenta por cobrar (para el smoke de Cuentas por cobrar) y una
    // Escritura finalizada ubicada en la quincena usada por el smoke del
    // Índice Notarial (effective_index_date cae a created_at sin
    // authorized_at real, ver model/query.ts).
    await createTestReceivable(registry, {
      client_id: client.id,
      concept: uniqueName("table-pagination", "cobro"),
      currency: "CRC",
    });

    const notarialDoc = await createTestDocument(registry, template.id, {
      title: uniqueName("table-pagination", "escritura-indice"),
      client_id: client.id,
      status: "draft",
      rendered_content: "ESCRITURA de prueba de paginación.",
      created_at: "2026-07-05T12:00:00.000Z",
    });
    await setTestDocumentStatus(notarialDoc.id, "final");
  });

  test("B: default page size is 10 and the selector reflects it", async ({ page }) => {
    await page.goto("/dashboard/documents");
    await expect(page.getByLabel("Filas por página")).toHaveValue("10");
  });

  test("C: changing the page size updates the URL and resets to page 1", async ({ page }) => {
    await page.goto("/dashboard/documents?page=1");
    await page.getByLabel("Filas por página").selectOption("5");
    await expect(page).toHaveURL(/pageSize=5(?!\d)/);
    await expect(page).not.toHaveURL(/[?&]page=/);
  });

  test("D: page size persists across a filter change, but page resets to 1", async ({
    page,
  }) => {
    await page.goto("/dashboard/documents?pageSize=5&page=2");
    await page.getByLabel("Estado").selectOption("draft");
    await expect(page).toHaveURL(/status=draft/);
    await expect(page).toHaveURL(/pageSize=5/);
    await expect(page).not.toHaveURL(/[?&]page=/);
  });

  test("E: navigating to the next page keeps the chosen page size", async ({ page }) => {
    await page.goto("/dashboard/documents?pageSize=5&status=draft");
    const next = page.getByRole("link", { name: "Siguiente" });
    if (await next.isVisible()) {
      await next.click();
      await expect(page).toHaveURL(/page=2/);
      await expect(page).toHaveURL(/pageSize=5/);
    }
  });

  test("F: an out-of-range page redirects to the last valid page instead of showing an empty screen", async ({
    page,
  }) => {
    await page.goto("/dashboard/documents?status=draft&page=999999");
    await expect(page).not.toHaveURL(/page=999999/);
    await expect(
      page.getByRole("region", { name: "Paginación" }).or(page.locator("table")),
    ).toBeVisible();
  });

  test("G: the page-size options are exactly 5/10/25/50", async ({ page }) => {
    await page.goto("/dashboard/documents");
    const options = await page
      .getByLabel("Filas por página")
      .locator("option")
      .allTextContents();
    expect(options).toEqual(["5", "10", "25", "50"]);
  });

  test("H: Clientes reuses the same page-size selector", async ({ page }) => {
    await page.goto("/dashboard/clients");
    const select = page.getByLabel("Filas por página");
    await expect(select).toBeVisible();
    await select.selectOption("25");
    await expect(page).toHaveURL(/pageSize=25/);
  });

  test("I: Machotes reuses the same page-size selector", async ({ page }) => {
    await page.goto("/dashboard/templates");
    const select = page.getByLabel("Filas por página");
    await expect(select).toBeVisible();
    await select.selectOption("50");
    await expect(page).toHaveURL(/pageSize=50/);
  });

  test("J: Cuentas por cobrar reuses the same page-size selector and preserves filters", async ({
    page,
  }) => {
    await page.goto("/dashboard/receivables?currency=CRC");
    const select = page.getByLabel("Filas por página");
    await expect(select).toBeVisible();
    await select.selectOption("25");
    await expect(page).toHaveURL(/pageSize=25/);
    await expect(page).toHaveURL(/currency=CRC/);
  });

  test("K: Índice Notarial reuses the same page-size selector without disturbing the año/mes/quincena filters", async ({
    page,
  }) => {
    await page.goto("/dashboard/notarial-index?year=2026&month=7&half=FIRST_HALF");
    const select = page.getByLabel("Filas por página");
    await expect(select).toBeVisible();
    await select.selectOption("25");
    await expect(page).toHaveURL(/pageSize=25/);
    await expect(page).toHaveURL(/year=2026/);
    await expect(page).toHaveURL(/half=FIRST_HALF/);
  });
});
