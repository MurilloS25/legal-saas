import { randomInt } from "node:crypto";
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

/**
 * Búsqueda server-side del directorio de Clientes (`?q=`) y resumen escalable
 * del detalle de un Cliente con mucha actividad.
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const personName = uniqueName("clients-search", "persona");
const companyName = uniqueName("clients-search", "sociedad");
const personId = `1-${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`;
const companyId = `3-101-${randomInt(100000, 999999)}`;
// Los dígitos 1-2-3-4 aparecen en este orden pero NO contiguos: una búsqueda
// aproximada ("%1%2%3%4%") la devolvería; la normalizada no.
const scatteredName = uniqueName("clients-search", "dispersa");
const scatteredId = "1-0203-0400";
const contiguousName = uniqueName("clients-search", "contigua");
const contiguousId = "9-1234-5678";
const batchToken = uniqueName("clients-search", "lote");
const busyName = uniqueName("clients-search", "activo");
let busyClientId = "";

function rows(page: Page) {
  return page.getByRole("region", { name: "Tabla de clientes" }).locator("tbody tr");
}

async function search(page: Page, text: string) {
  await page.getByLabel("Buscar", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
}

test.describe("clients search and detail summary", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "clients-search");
  });

  test("A: seed clients, a batch for pagination and a busy client", async () => {
    await createTestClient(registry, {
      full_name: personName,
      identification_number: personId,
    });
    await createTestClient(registry, {
      full_name: companyName,
      identification_type: "cedula_juridica",
      identification_number: companyId,
    });
    await createTestClient(registry, {
      full_name: scatteredName,
      identification_number: scatteredId,
    });
    await createTestClient(registry, {
      full_name: contiguousName,
      identification_number: contiguousId,
    });
    for (let i = 0; i < 12; i++) {
      await createTestClient(registry, {
        full_name: `${batchToken}-${String(i).padStart(2, "0")}`,
      });
    }
    const busy = await createTestClient(registry, { full_name: busyName });
    busyClientId = busy.id;
    const template = await createTestTemplate(registry, {
      name: uniqueName("clients-search", "machote"),
      content: "ESCRITURA de prueba.",
    });
    for (let i = 0; i < 7; i++) {
      await createTestDocument(registry, template.id, {
        title: `${busyName} escritura ${i}`,
        client_id: busyClientId,
      });
      await createTestReceivable(registry, {
        client_id: busyClientId,
        concept: `${busyName} cobro ${i}`,
        amount_total: "100000.00",
      });
    }
  });

  test("B: searching by name filters on the server and keeps q in the URL", async ({ page }) => {
    await page.goto("/clients");
    await search(page, personName);
    await expect(page).toHaveURL(new RegExp(`[?&]q=${personName}`));
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText(personName);
    await expect(page.getByLabel("Buscar", { exact: true })).toHaveValue(personName);
  });

  test("C: searching by identification works with and without hyphens, for personas and sociedades", async ({
    page,
  }) => {
    await page.goto("/clients");
    await search(page, personId);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText(personName);

    await search(page, personId.replace(/-/g, ""));
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText(personName);

    // Sociedad por razón social y por cédula jurídica sin guiones.
    await search(page, companyName);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText(companyName);
    await search(page, companyId.replace(/-/g, ""));
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText(companyName);
  });

  test("C2: identification search is exact on the normalized number — spaces work and scattered digits never match", async ({
    page,
  }) => {
    await page.goto("/clients");
    await search(page, companyId.replace(/-/g, " "));
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText(companyName);

    // "1234" está contiguo solo en la cédula contigua, nunca en la dispersa.
    await search(page, "1234");
    await expect(rows(page).filter({ hasText: contiguousName })).toHaveCount(1);
    await expect(rows(page).filter({ hasText: scatteredName })).toHaveCount(0);

    // Con guiones tal como está guardada, la dispersa sí se encuentra.
    await search(page, scatteredId);
    await expect(rows(page).filter({ hasText: scatteredName })).toHaveCount(1);
  });

  test("D: no results shows an empty state and 'Limpiar búsqueda' restores the directory", async ({
    page,
  }) => {
    await page.goto("/clients");
    await search(page, "zzz-no-existe-nadie");
    await expect(page.getByText("Sin resultados para «zzz-no-existe-nadie»")).toBeVisible();
    await expect(page.getByRole("region", { name: "Tabla de clientes" })).toHaveCount(0);

    await page.getByRole("main").getByRole("link", { name: "Limpiar búsqueda" }).last().click();
    await expect(page).toHaveURL(/\/clients$/);
    await expect(rows(page).first()).toBeVisible();
    await expect(page.getByLabel("Buscar", { exact: true })).toHaveValue("");
  });

  test("E: pagination keeps the search and a new search resets to page 1", async ({ page }) => {
    await page.goto(`/clients?q=${batchToken}`);
    await expect(rows(page)).toHaveCount(10);
    await expect(page.getByText("1–10 de 12")).toBeVisible();

    await page.getByRole("link", { name: "Siguiente" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(new RegExp(`q=${batchToken}`));
    await expect(rows(page)).toHaveCount(2);

    await search(page, `${batchToken}-03`);
    await expect(page).not.toHaveURL(/page=/);
    await expect(rows(page)).toHaveCount(1);
  });

  test("F: the detail summarizes activity — at most 5 recent rows, real totals, Ver todas and pending balance", async ({
    page,
  }) => {
    await page.goto(`/clients/${busyClientId}`);

    const documents = page.locator('section[aria-labelledby="client-documents-heading"]');
    await expect(documents).toContainText("7 en total");
    await expect(documents.locator("tbody tr")).toHaveCount(5);
    await expect(documents.getByRole("link", { name: "Ver todas" })).toHaveAttribute(
      "href",
      `/documents?client=${busyClientId}`,
    );

    const receivables = page.getByRole("region", { name: "Cuentas por cobrar del cliente", exact: true });
    await expect(receivables).toContainText("7 cuentas en total");
    await expect(receivables).toContainText("Saldo pendiente: ₡700.000,00 CRC");
    await expect(receivables.locator("tbody tr")).toHaveCount(5);
    await expect(receivables.getByRole("link", { name: "Ver todas" })).toHaveAttribute(
      "href",
      `/receivables?client=${busyClientId}`,
    );
  });
});
