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

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();
let clientId = "";

test.describe("server-side table page size", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "table-pagination");
  });

  test("seeds an isolated result set with a final partial page", async () => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("table-pagination", "machote"),
      content: "ESCRITURA de prueba de paginación.",
    });
    const client = await createTestClient(registry, {
      full_name: uniqueName("table-pagination", "cliente"),
    });
    clientId = client.id;

    for (let index = 0; index < 7; index += 1) {
      await createTestDocument(registry, template.id, {
        title: `${uniqueName("table-pagination", "doc")}-${index}`,
        client_id: client.id,
        status: "draft",
      });
    }

    await createTestReceivable(registry, {
      client_id: client.id,
      concept: uniqueName("table-pagination", "cobro"),
      currency: "CRC",
    });

    const notarialDocument = await createTestDocument(registry, template.id, {
      title: uniqueName("table-pagination", "indice"),
      client_id: client.id,
      status: "draft",
      rendered_content: "ESCRITURA de prueba de paginación.",
      created_at: "2026-07-05T12:00:00.000Z",
    });
    await setTestDocumentStatus(notarialDocument.id, "final");
  });

  test("defaults to 10 and exposes exactly 5, 10, 25 and 50", async ({ page }) => {
    await page.goto("/dashboard/documents");
    const select = page.getByLabel("Filas por página");
    await expect(select).toHaveValue("10");
    await expect(select.locator("option")).toHaveText(["5", "10", "25", "50"]);
  });

  test("accepts every page size and preserves it on reload", async ({ page }) => {
    for (const pageSize of ["5", "10", "25", "50"]) {
      await page.goto(`/dashboard/documents?pageSize=${pageSize}`);
      await expect(page.getByLabel("Filas por página")).toHaveValue(pageSize);
      await page.reload();
      await expect(page.getByLabel("Filas por página")).toHaveValue(pageSize);
    }
  });

  test("normalizes invalid page and pageSize values safely", async ({ page }) => {
    await page.goto("/dashboard/documents?page=invalid&pageSize=999");
    await expect(page.getByLabel("Filas por página")).toHaveValue("10");
    await expect(page.locator("table")).toBeVisible();
  });

  test("changing pageSize resets page while preserving filters and order", async ({ page }) => {
    await page.goto(
      `/dashboard/documents?client=${clientId}&status=draft&sort=oldest&pageSize=5&page=2`,
    );
    await page.getByLabel("Filas por página").selectOption("25");
    await expect(page).toHaveURL(/pageSize=25/);
    await expect(page).toHaveURL(new RegExp(`client=${clientId}`));
    await expect(page).toHaveURL(/status=draft/);
    await expect(page).toHaveURL(/sort=oldest/);
    await expect(page).not.toHaveURL(/[?&]page=/);
  });

  test("filter changes reset page and preserve pageSize", async ({ page }) => {
    await page.goto(`/dashboard/documents?client=${clientId}&pageSize=5&page=2`);
    await page.getByLabel("Estado").selectOption("draft");
    await expect(page).toHaveURL(/pageSize=5/);
    await expect(page).toHaveURL(/status=draft/);
    await expect(page).not.toHaveURL(/[?&]page=/);
  });

  test("next/previous preserve pageSize and the last page reports its exact range", async ({ page }) => {
    await page.goto(
      `/dashboard/documents?client=${clientId}&status=draft&pageSize=5`,
    );
    await page.getByRole("link", { name: "Siguiente" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/pageSize=5/);
    await expect(page.getByText("6–7 de 7", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Anterior" }).click();
    await expect(page).not.toHaveURL(/[?&]page=/);
    await expect(page).toHaveURL(/pageSize=5/);
  });

  test("out-of-range pages retain the safe redirect behavior", async ({ page }) => {
    await page.goto(
      `/dashboard/documents?client=${clientId}&status=draft&pageSize=5&page=999999`,
    );
    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/pageSize=5/);
  });

  test("all five workspaces use the selector and preserve their query", async ({ page }) => {
    const cases = [
      ["/dashboard/clients", "25", ""],
      ["/dashboard/templates", "50", ""],
      ["/dashboard/documents?status=draft", "5", "status=draft"],
      [
        "/dashboard/notarial-index?year=2026&month=7&half=FIRST_HALF",
        "25",
        "half=FIRST_HALF",
      ],
      ["/dashboard/receivables?currency=CRC", "50", "currency=CRC"],
    ] as const;

    for (const [url, value, preserved] of cases) {
      await page.goto(url);
      await page.getByLabel("Filas por página").selectOption(value);
      await expect(page).toHaveURL(new RegExp(`pageSize=${value}`));
      if (preserved) await expect(page).toHaveURL(new RegExp(preserved));
    }
  });
});
