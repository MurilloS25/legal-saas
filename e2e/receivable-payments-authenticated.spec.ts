import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
  createTestReceivable,
  runCleanup,
  uniqueName,
} from "./support/factories";

// Serial: los tests comparten una cuenta por cobrar y sus pagos.
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();
const concept = uniqueName("payments", "concepto");
let receivableId = "";

async function openReceivable(page: Page) {
  await page.goto(`/dashboard/receivables/${receivableId}`);
  await expect(
    page.getByRole("heading", { name: concept, exact: true }),
  ).toBeVisible();
}

function paymentsSection(page: Page) {
  return page.getByRole("region", { name: "Pagos" });
}

test.describe("receivable payments", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "payments");
  });

  test("A: seed a client and a receivable of ₡100.000", async () => {
    const client = await createTestClient(registry, {
      full_name: uniqueName("payments", "cliente"),
      identification_number: "6-0606-0606",
    });
    const receivable = await createTestReceivable(registry, {
      client_id: client.id,
      concept,
      currency: "CRC",
      amount_total: "100000.00",
    });
    receivableId = receivable.id;
  });

  test("B: registering a partial payment leaves the account partial", async ({
    page,
  }) => {
    await openReceivable(page);
    const section = paymentsSection(page);

    await section.getByLabel(/Monto del pago/).fill("40000");
    await section.getByLabel("Método").selectOption("cash");
    await section.getByRole("button", { name: "Registrar pago" }).click();

    await expect(page).toHaveURL(/\/dashboard\/receivables\/[0-9a-f-]{36}$/, {
      timeout: 15_000,
    });
    // Saldo y estado derivados reflejan el abono parcial.
    await expect(
      page.getByText("₡60.000,00 CRC", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Parcial", { exact: true })).toBeVisible();
    await expect(
      page.getByText("₡40.000,00 CRC", { exact: true }).first(),
    ).toBeVisible();
  });

  test("C: an overpayment is rejected", async ({ page }) => {
    await openReceivable(page);
    const section = paymentsSection(page);

    await section.getByLabel(/Monto del pago/).fill("70000");
    await section.getByRole("button", { name: "Registrar pago" }).click();

    await expect(
      page.getByText("El pago supera el saldo pendiente de la cuenta."),
    ).toBeVisible();
    // El saldo no cambió.
    await expect(
      page.getByText("₡60.000,00 CRC", { exact: true }).first(),
    ).toBeVisible();
  });

  test("D: paying the remaining balance settles the account", async ({
    page,
  }) => {
    await openReceivable(page);
    const section = paymentsSection(page);

    await section.getByLabel(/Monto del pago/).fill("60000");
    await section
      .getByLabel("Método")
      .selectOption("bank_transfer");
    await section.getByRole("button", { name: "Registrar pago" }).click();

    await expect(page).toHaveURL(/\/dashboard\/receivables\/[0-9a-f-]{36}$/, {
      timeout: 15_000,
    });
    await expect(page.getByText("Pagada", { exact: true })).toBeVisible();
    // Ya no se ofrece registrar pagos.
    await expect(
      page.getByText("Esta cuenta está saldada.", { exact: false }),
    ).toBeVisible();
  });

  test("E: voiding a payment reopens the account", async ({ page }) => {
    await openReceivable(page);

    // Anula el pago de ₡40.000.
    const row = page
      .getByRole("listitem")
      .filter({ hasText: "₡40.000,00 CRC" });
    await row.getByRole("button", { name: "Anular" }).click();

    const dialog = page.getByRole("alertdialog");
    await dialog.getByLabel(/Motivo de la anulación/).fill("Pago revertido");
    await dialog.getByRole("button", { name: "Anular pago" }).click();

    await expect(page).toHaveURL(/\/dashboard\/receivables\/[0-9a-f-]{36}$/, {
      timeout: 15_000,
    });
    // La cuenta vuelve a tener saldo y estado parcial.
    await expect(page.getByText("Parcial", { exact: true })).toBeVisible();
    await expect(page.getByText("Anulado", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText("Cuenta reabierta tras anulación", { exact: true }),
    ).toBeVisible();
  });
});
