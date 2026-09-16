import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
  createTestReceivable,
  runCleanup,
  uniqueName,
  voidActiveTestReceivablePayments,
} from "./support/factories";

// Serial: los tests comparten una cuenta por cobrar y sus pagos.
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();
const concept = uniqueName("payments", "concepto");
let receivableId = "";

async function openReceivable(page: Page) {
  await page.goto(`/receivables/${receivableId}?section=payments`);
  await expect(
    page.getByRole("heading", { name: concept, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Pagos" }),
  ).toHaveAttribute("aria-selected", "true");
}

function paymentsSection(page: Page) {
  return page.getByRole("region", { name: "Pagos" });
}

async function openRegisterPaymentDialog(page: Page) {
  await paymentsSection(page)
    .getByRole("button", { name: "Registrar pago" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Registrar pago" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("receivable payments", () => {
  test.afterAll(async () => {
    if (receivableId) {
      await voidActiveTestReceivablePayments(receivableId);
    }
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

  test("B0: canceling the register-payment dialog leaves everything unchanged", async ({
    page,
  }) => {
    await openReceivable(page);
    const dialog = await openRegisterPaymentDialog(page);

    await dialog.getByLabel(/Monto del pago/).fill("40000");
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();

    // Ningún pago se registró: el saldo total sigue intacto.
    await expect(
      page.getByText("₡100.000,00 CRC", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Todavía no se han registrado pagos.", { exact: true }),
    ).toBeVisible();
  });

  test("B1: Escape closes the register-payment dialog too", async ({
    page,
  }) => {
    await openReceivable(page);
    const dialog = await openRegisterPaymentDialog(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("B: registering a partial payment leaves the account partial", async ({
    page,
  }) => {
    await openReceivable(page);
    const dialog = await openRegisterPaymentDialog(page);

    await dialog.getByLabel(/Monto del pago/).fill("40000");
    await dialog.getByLabel("Método").selectOption("cash");
    await dialog.getByRole("button", { name: "Registrar pago" }).click();

    await expect(page).toHaveURL(
      /\/receivables\/[0-9a-f-]{36}\?section=payments&paid=1$/,
      { timeout: 15_000 },
    );
    // El diálogo se cierra solo al redirigir tras el envío exitoso.
    await expect(dialog).toBeHidden();
    await expect(
      page.getByText("Pago registrado.", { exact: true }),
    ).toBeVisible();
    // Saldo y estado derivados reflejan el abono parcial. La URL de detalle no
    // cambia al guardar, así que se espera al re-render con un timeout amplio.
    await expect(
      page.getByText("₡60.000,00 CRC", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Parcial", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText("₡40.000,00 CRC", { exact: true }).first(),
    ).toBeVisible();
  });

  test("C: an overpayment is rejected and keeps the dialog open with the error", async ({
    page,
  }) => {
    await openReceivable(page);
    const dialog = await openRegisterPaymentDialog(page);

    await dialog.getByLabel(/Monto del pago/).fill("70000");
    await dialog.getByRole("button", { name: "Registrar pago" }).click();

    // Sin redirect: el diálogo permanece abierto con el error visible.
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("El pago supera el saldo pendiente de la cuenta."),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();

    // El saldo no cambió.
    await expect(
      page.getByText("₡60.000,00 CRC", { exact: true }).first(),
    ).toBeVisible();
  });

  test("D: paying the remaining balance settles the account", async ({
    page,
  }) => {
    await openReceivable(page);
    const dialog = await openRegisterPaymentDialog(page);

    await dialog.getByLabel(/Monto del pago/).fill("60000");
    await dialog.getByLabel("Método").selectOption("bank_transfer");
    await dialog.getByRole("button", { name: "Registrar pago" }).click();

    await expect(page).toHaveURL(
      /\/receivables\/[0-9a-f-]{36}\?section=payments&paid=1$/,
      { timeout: 15_000 },
    );
    await expect(page.getByText("Pagada", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    // Ya no se ofrece registrar pagos.
    await expect(
      page.getByText("Esta cuenta está saldada.", { exact: false }),
    ).toBeVisible();
    await expect(
      paymentsSection(page).getByRole("button", { name: "Registrar pago" }),
    ).toHaveCount(0);
  });

  test("E: voiding a payment reopens the account and the register-payment action returns", async ({
    page,
  }) => {
    await openReceivable(page);

    // Anula el pago de ₡40.000.
    const row = page
      .getByRole("row")
      .filter({ hasText: "₡40.000,00 CRC" });
    await row.getByRole("button", { name: "Anular" }).click();

    const voidDialog = page.getByRole("alertdialog");
    await voidDialog.getByLabel(/Motivo de la anulación/).fill("Pago revertido");
    await voidDialog.getByRole("button", { name: "Anular pago" }).click();

    // El diálogo se cierra al completarse la anulación y re-renderizar.
    await expect(voidDialog).toBeHidden({ timeout: 15_000 });
    // La cuenta vuelve a tener saldo y estado parcial.
    await expect(page.getByText("Parcial", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Anulado", { exact: true }).first()).toBeVisible();
    // El botón para registrar pagos vuelve a estar disponible.
    await expect(
      paymentsSection(page).getByRole("button", { name: "Registrar pago" }),
    ).toBeVisible();

    // El evento de reapertura vive en el diálogo "Historial" del encabezado.
    await page.getByRole("button", { name: "Historial" }).click();
    const historyDialog = page.getByRole("dialog", {
      name: "Historial de la cuenta",
    });
    await expect(historyDialog).toBeVisible();
    await expect(
      historyDialog.getByText("Cuenta reabierta tras anulación", {
        exact: true,
      }),
    ).toBeVisible();

    // El historial también se puede cerrar (Escape).
    await page.keyboard.press("Escape");
    await expect(historyDialog).toBeHidden();
  });
});
