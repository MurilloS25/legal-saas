import { test, expect } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
  createTestDocument,
  createTestReceivable,
  createTestTemplate,
  runCleanup,
  uniqueName,
} from "./support/factories";

// Los tests comparten el usuario de prueba y navegan entre la misma
// Escritura y sus cuentas; modo serial para evitar carreras.
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const clientName = uniqueName("doc-receivable-nav", "cliente");
const documentTitle = uniqueName("doc-receivable-nav", "escritura");
let clientId = "";
let documentId = "";
let existingReceivableId = "";

test.describe("document ↔ receivable context navigation", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "document-receivable-context-navigation");
  });

  test("A: seed a client, a document and an existing receivable", async () => {
    const client = await createTestClient(registry, {
      full_name: clientName,
      identification_number: "6-0606-0606",
    });
    clientId = client.id;

    const template = await createTestTemplate(registry, {
      name: uniqueName("doc-receivable-nav", "machote"),
      content: "ESCRITURA de prueba.",
    });
    const doc = await createTestDocument(registry, template.id, {
      title: documentTitle,
      client_id: clientId,
      rendered_content: "ESCRITURA de prueba.",
    });
    documentId = doc.id;

    const receivable = await createTestReceivable(registry, {
      client_id: clientId,
      document_id: documentId,
      concept: uniqueName("doc-receivable-nav", "concepto-existente"),
    });
    existingReceivableId = receivable.id;
  });

  // El paso "Cobro" de la Escritura ya no manda al módulo completo de
  // Cuentas por cobrar para crear/ver una cuenta — B-E cubrían ese flujo
  // (enlace "Nueva cuenta" + "Volver a la Escritura"), reemplazado por
  // operaciones contextuales en modal que nunca navegan fuera de la
  // Escritura (ver `document-stepper-create-authenticated.spec.ts`, que
  // cubre el modal de creación end-to-end). Este spec conserva la
  // cobertura de la ruta directa `/dashboard/receivables/...?returnTo=...`
  // (F, G, H) y agrega la del resumen contextual con una cuenta que ya
  // existe.

  test("B: el paso Cobro muestra el resumen de la cuenta existente — sin la tabla ni el enlace 'Nueva cuenta' del flujo viejo — y 'Ver cuenta completa' navega de forma explícita a Cuentas por cobrar", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/${documentId}?section=cobro`);

    const cobroSection = page.getByRole("region", {
      name: "Cuentas por cobrar de la escritura",
    });
    await expect(cobroSection).toBeVisible();
    // Ya existe una cuenta: no se ofrece crear otra desde aquí.
    await expect(
      cobroSection.getByRole("button", { name: "Crear cuenta por cobrar" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Nueva cuenta" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", {
        name: "Tabla de cuentas por cobrar del cliente",
      }),
    ).toHaveCount(0);

    const viewLink = cobroSection.getByRole("link", {
      name: "Ver cuenta completa",
    });
    await expect(viewLink).toHaveAttribute(
      "href",
      `/dashboard/receivables/${existingReceivableId}`,
    );
    await viewLink.click();
    await expect(page).toHaveURL(
      new RegExp(`/dashboard/receivables/${existingReceivableId}$`),
    );
  });

  test("C: 'Registrar pago' desde Cobro abre un modal y nunca abandona la Escritura", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/${documentId}?section=cobro`);
    const cobroSection = page.getByRole("region", {
      name: "Cuentas por cobrar de la escritura",
    });

    await cobroSection
      .getByRole("button", { name: "Registrar pago" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Registrar pago" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();

    // Cancelar no navega — sigue en la misma Escritura, mismo paso.
    await expect(page).toHaveURL(
      new RegExp(`/dashboard/documents/${documentId}\\?section=cobro`),
    );
  });

  test("F: opening a receivable directly (no context) shows no back link", async ({
    page,
  }) => {
    await page.goto(`/dashboard/receivables/${existingReceivableId}`);

    await expect(
      page.getByRole("link", { name: "Volver a la Escritura" }),
    ).toHaveCount(0);
  });

  test("G: creating from the general receivables list keeps the original flow (no back link)", async ({
    page,
  }) => {
    await page.goto("/dashboard/receivables/new");

    await expect(
      page.getByRole("link", { name: "Volver a la Escritura" }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Cancelar" })).toHaveAttribute(
      "href",
      "/dashboard/receivables",
    );
  });

  test("H: malicious returnTo values are rejected and no back link is shown", async ({
    page,
  }) => {
    const malicious = [
      "https://example.com",
      "//example.com",
      "javascript:alert(1)",
      "/dashboard/settings",
      "/dashboard/documents/not-a-uuid?section=cobro",
    ];

    for (const value of malicious) {
      await page.goto(
        `/dashboard/receivables/new?returnTo=${encodeURIComponent(value)}`,
      );
      await expect(
        page.getByRole("link", { name: "Volver a la Escritura" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Cancelar" }),
      ).toHaveAttribute("href", "/dashboard/receivables");
    }

    await page.goto(
      `/dashboard/receivables/${existingReceivableId}?returnTo=${encodeURIComponent("https://example.com")}`,
    );
    await expect(
      page.getByRole("link", { name: "Volver a la Escritura" }),
    ).toHaveCount(0);
  });
});
