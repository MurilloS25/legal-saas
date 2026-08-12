import { test, expect } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
  createTestDocument,
  createTestReceivable,
  createTestTemplate,
  registerCreatedViaUi,
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

  test("B: creating a receivable from the document's tab shows a back link to it, and creation lands on the new receivable without an auto-redirect", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/${documentId}?section=cobro`);

    const newLink = page.getByRole("link", { name: "Nueva cuenta" });
    const newHref = await newLink.getAttribute("href");
    expect(newHref).toContain(`document=${documentId}`);
    expect(newHref).toContain(
      `returnTo=${encodeURIComponent(`/dashboard/documents/${documentId}?section=cobro`)}`,
    );

    await newLink.click();
    await expect(page).toHaveURL(/\/dashboard\/receivables\/new/);
    await expect(
      page.getByRole("link", { name: "Volver a la Escritura" }),
    ).toHaveAttribute(
      "href",
      `/dashboard/documents/${documentId}?section=cobro`,
    );

    const concept = uniqueName("doc-receivable-nav", "concepto-nuevo");
    await page.getByLabel("Concepto").fill(concept);
    await page.getByLabel("Monto total").fill("1000");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    // No debe haber redirect automático de vuelta a la Escritura: el
    // usuario debe quedar viendo la cuenta recién creada.
    await expect(page).toHaveURL(/\/dashboard\/receivables\/[0-9a-f-]{36}/, {
      timeout: 15_000,
    });
    await expect(page.getByText(concept)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Volver a la Escritura" }),
    ).toHaveAttribute(
      "href",
      `/dashboard/documents/${documentId}?section=cobro`,
    );

    // El receivable se creó vía UI (no por factory): se registra para que
    // el cleanup lo borre antes que el cliente y no viole la FK.
    await registerCreatedViaUi(registry, "receivables", "concept", concept);
  });

  test("C: the back link returns to the same document, on the receivables tab", async ({
    page,
  }) => {
    await page.goto(
      `/dashboard/documents/${documentId}?section=cobro`,
    );
    await page.getByRole("link", { name: "Nueva cuenta" }).click();
    await page.getByRole("link", { name: "Volver a la Escritura" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/dashboard/documents/${documentId}\\?section=cobro`),
    );
    // Se confirma la sección activa por su contenido (el paso "Cobro" del
    // stepper), no navegando el `role="tab"` directamente.
    await expect(page.getByRole("link", { name: "Nueva cuenta" })).toBeVisible();
  });

  test("D: cancelling the new-receivable form returns to the same document and tab", async ({
    page,
  }) => {
    await page.goto(
      `/dashboard/documents/${documentId}?section=cobro`,
    );
    await page.getByRole("link", { name: "Nueva cuenta" }).click();
    await expect(page).toHaveURL(/\/dashboard\/receivables\/new/);

    await page.getByRole("link", { name: "Cancelar" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/dashboard/documents/${documentId}\\?section=cobro`),
    );
  });

  test("E: opening an existing receivable from the document's tab shows the back link too", async ({
    page,
  }) => {
    await page.goto(
      `/dashboard/documents/${documentId}?section=cobro`,
    );

    const row = page.getByRole("region", {
      name: "Tabla de cuentas por cobrar del cliente",
    });
    await row.getByRole("link", { name: "Ver" }).first().click();

    await expect(page).toHaveURL(/\/dashboard\/receivables\/[0-9a-f-]{36}/);
    await expect(
      page.getByRole("link", { name: "Volver a la Escritura" }),
    ).toHaveAttribute(
      "href",
      `/dashboard/documents/${documentId}?section=cobro`,
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
