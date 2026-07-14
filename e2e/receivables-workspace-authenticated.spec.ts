import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
  createTestDocument,
  createTestReceivable,
  createTestTemplate,
  runCleanup,
  uniqueName,
} from "./support/factories";

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const conceptCrc = uniqueName("rec-ws", "colones");
const conceptUsd = uniqueName("rec-ws", "dolares");
let clientId = "";
let documentId = "";

async function gotoWorkspace(page: Page, params = "") {
  await page.goto(`/dashboard/receivables${params}`);
  await expect(
    page.getByRole("heading", { name: "Cuentas por cobrar", exact: true }),
  ).toBeVisible();
}

test.describe("receivables workspace", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "rec-ws");
  });

  test("A: seed a CRC and a USD receivable", async () => {
    const client = await createTestClient(registry, {
      full_name: uniqueName("rec-ws", "cliente"),
      identification_number: "7-0707-0707",
    });
    clientId = client.id;

    const template = await createTestTemplate(registry, {
      name: uniqueName("rec-ws", "machote"),
      content: "ESCRITURA.",
    });
    const doc = await createTestDocument(registry, template.id, {
      title: uniqueName("rec-ws", "escritura"),
      client_id: clientId,
      rendered_content: "ESCRITURA.",
    });
    documentId = doc.id;

    await createTestReceivable(registry, {
      client_id: clientId,
      concept: conceptCrc,
      currency: "CRC",
      amount_total: "100000.00",
    });
    await createTestReceivable(registry, {
      client_id: clientId,
      concept: conceptUsd,
      currency: "USD",
      amount_total: "500.00",
      document_id: documentId,
    });
  });

  test("B: per-currency totals never mix currencies", async ({ page }) => {
    // Filtra por el propio cliente para aislar de datos de otras corridas.
    await gotoWorkspace(page, `?client=${clientId}`);

    const totals = page.getByRole("region", { name: "Totales por moneda" });
    await expect(totals).toBeVisible();
    await expect(totals.getByText("₡100.000,00 CRC").first()).toBeVisible();
    await expect(totals.getByText("$500,00 USD").first()).toBeVisible();
  });

  test("C: the currency filter narrows results and totals", async ({ page }) => {
    await gotoWorkspace(page, `?client=${clientId}`);
    await page.getByLabel("Moneda", { exact: true }).selectOption("USD");

    await expect(page).toHaveURL(/currency=USD/, { timeout: 15_000 });
    await expect(page.getByText(conceptUsd).first()).toBeVisible();
    await expect(page.getByText(conceptCrc)).toHaveCount(0);

    const totals = page.getByRole("region", { name: "Totales por moneda" });
    await expect(totals.getByText("$500,00 USD").first()).toBeVisible();
    await expect(totals.getByText("₡100.000,00 CRC")).toHaveCount(0);
  });

  test("D: the search filter matches the concept", async ({ page }) => {
    await gotoWorkspace(page, `?client=${clientId}`);
    await page.getByLabel("Buscar").fill(conceptCrc);
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page.getByText(conceptCrc).first()).toBeVisible();
    await expect(page.getByText(conceptUsd)).toHaveCount(0);
  });

  test("E: special-character-only search does not broaden results", async ({
    page,
  }) => {
    await gotoWorkspace(
      page,
      `?client=${clientId}&search=${encodeURIComponent("%_(),'\"\\")}`,
    );
    await expect(
      page.getByText("Ninguna cuenta coincide con los filtros"),
    ).toBeVisible();
    await expect(page.getByText(conceptCrc)).toHaveCount(0);
    await expect(page.getByText(conceptUsd)).toHaveCount(0);
  });

  test("F: out-of-range page redirects to a valid page", async ({ page }) => {
    await gotoWorkspace(page, `?client=${clientId}&page=999999`);
    await expect(page).not.toHaveURL(/page=999999/);
    await expect(page.getByText(conceptCrc).first()).toBeVisible();
    await expect(page.getByText(conceptUsd).first()).toBeVisible();
  });

  test("G: the 'without document' filter excludes linked receivables", async ({
    page,
  }) => {
    await gotoWorkspace(page, `?client=${clientId}`);
    await page.getByLabel("Escritura", { exact: true }).selectOption("without");

    await expect(page).toHaveURL(/doc=without/, { timeout: 15_000 });
    // El de CRC no tiene escritura; el de USD sí.
    await expect(page.getByText(conceptCrc).first()).toBeVisible();
    await expect(page.getByText(conceptUsd)).toHaveCount(0);
  });

  test("H: the client detail lists its receivables", async ({ page }) => {
    await page.goto(`/dashboard/clients/${clientId}`);
    const section = page.getByRole("region", {
      name: "Cuentas por cobrar del cliente",
    });
    await expect(section.getByText(conceptCrc).first()).toBeVisible();
    await expect(section.getByText(conceptUsd).first()).toBeVisible();
  });
});
