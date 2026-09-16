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
const receivableConcept = uniqueName("doc-receivable-nav", "concepto-existente");
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
      concept: receivableConcept,
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
    const returnTo = `/dashboard/documents/${documentId}?section=cobro`;
    await expect(viewLink).toHaveAttribute(
      "href",
      `/dashboard/receivables/${existingReceivableId}?returnTo=${encodeURIComponent(returnTo)}`,
    );
    await viewLink.click();
    await expect(page.getByRole("link", { name: "Volver a la Escritura" })).toHaveAttribute(
      "href",
      returnTo,
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

  test("D: editar, pagar y anular conservan el retorno contextual", async ({
    page,
  }) => {
    const returnTo = `/dashboard/documents/${documentId}?section=cobro`;
    const detailUrl = `/dashboard/receivables/${existingReceivableId}?returnTo=${encodeURIComponent(returnTo)}`;
    await page.goto(detailUrl);

    await page
      .getByRole("textbox", { name: "Concepto", exact: true })
      .fill(`${receivableConcept} editado`);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("link", { name: "Volver a la Escritura" })).toHaveAttribute(
      "href",
      returnTo,
    );
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe(returnTo);

    await page.getByRole("tab", { name: "Pagos" }).click();
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe(returnTo);
    const paymentDialog = page.getByRole("dialog", { name: "Registrar pago" });
    await page.getByRole("button", { name: "Registrar pago" }).click();
    await paymentDialog.getByLabel(/Monto del pago/).fill("1000");
    await paymentDialog.getByRole("button", { name: "Registrar pago" }).click();
    await expect(page.getByText("Pago registrado.", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe(returnTo);

    const paymentRow = page.getByRole("row").filter({ hasText: "₡1.000,00 CRC" });
    await paymentRow.getByRole("button", { name: "Anular" }).click();
    const voidDialog = page.getByRole("alertdialog");
    await voidDialog.getByLabel(/Motivo de la anulación/).fill("Prueba de retorno");
    await voidDialog.getByRole("button", { name: "Anular pago" }).click();
    await expect(page.getByText("Anulado", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe(returnTo);

    await page.getByRole("link", { name: "Volver a la Escritura" }).click();
    await expect(page).toHaveURL(returnTo);
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
