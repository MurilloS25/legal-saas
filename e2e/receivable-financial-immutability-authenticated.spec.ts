import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
  createTestReceivable,
  registerCreatedViaUi,
  registerTestReceivablePayment,
  runCleanup,
  uniqueName,
  voidActiveTestReceivablePayments,
} from "./support/factories";

// Serial: los tests avanzan el estado de la MISMA cuenta (sin pago -> con
// pago activo -> con pago anulado), así que el orden importa.
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const clientNameA = uniqueName("recv-immut", "cliente-a");
const clientNameB = uniqueName("recv-immut", "cliente-b");
const concept = uniqueName("recv-immut", "concepto");
let clientIdA = "";
let clientIdB = "";
let receivableId = "";
let paymentId = "";

async function openReceivable(page: Page, id: string) {
  await page.goto(`/receivables/${id}`);
  await expect(page.getByLabel("Monto total")).toBeVisible();
}

const lockedNoticeText =
  "Esta cuenta ya tiene pagos registrados. El monto, la moneda, el cliente y la escritura relacionada no se pueden modificar";

test.describe("receivable financial immutability", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "recv-immut");
  });

  test("A: seed two clients and a receivable with no payments", async () => {
    const a = await createTestClient(registry, {
      full_name: clientNameA,
      identification_number: "6-0606-0606",
    });
    clientIdA = a.id;
    const b = await createTestClient(registry, {
      full_name: clientNameB,
      identification_number: "7-0707-0707",
    });
    clientIdB = b.id;

    const receivable = await createTestReceivable(registry, {
      client_id: clientIdA,
      concept,
      amount_total: "100000.00",
    });
    receivableId = receivable.id;
  });

  test("B: without payment history, every field is editable", async ({
    page,
  }) => {
    await openReceivable(page, receivableId);

    await expect(page.getByText(lockedNoticeText)).toHaveCount(0);
    await expect(page.getByLabel("Monto total")).toBeEnabled();
    await expect(page.getByLabel("Moneda")).toBeEnabled();
    await expect(page.getByLabel("Cliente", { exact: true })).toBeEnabled();

    await page.getByLabel("Monto total").fill("120000.00");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page).toHaveURL(/\/receivables\/[0-9a-f-]{36}$/, {
      timeout: 15_000,
    });
    await expect(
      page.getByText("₡120.000,00 CRC", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("C: registering a payment locks amount, currency, client and document in the UI", async ({
    page,
  }) => {
    paymentId = await registerTestReceivablePayment(receivableId, {
      amount: 30000,
      reference: "primer pago",
    });
    expect(paymentId).toBeTruthy();

    await openReceivable(page, receivableId);

    await expect(page.getByText(lockedNoticeText)).toBeVisible();
    await expect(page.getByLabel("Monto total")).toHaveAttribute("readonly", "");
    await expect(page.getByLabel("Moneda")).toBeDisabled();
    await expect(page.getByLabel("Cliente", { exact: true })).toBeDisabled();
    await expect(page.getByLabel("Escritura")).toBeDisabled();
  });

  test("D: non-financial fields (concept, due date, notes) remain editable and save", async ({
    page,
  }) => {
    await openReceivable(page, receivableId);

    // `getByLabel("Concepto")` colisiona con el botón "Eliminar la cuenta
    // {concepto}" (el nombre único de prueba contiene la palabra
    // "concepto"): se usa el id del campo directamente para evitar la
    // ambigüedad.
    const editedConcept = `${concept} (editado)`;
    await page.locator("#concept").fill(editedConcept);
    await page.getByLabel("Notas internas").fill("Recordatorio de seguimiento");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page).toHaveURL(/\/receivables\/[0-9a-f-]{36}$/, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: editedConcept, exact: true }),
    ).toBeVisible();
  });

  test("E: a manipulated request (bypassing disabled UI) is still rejected server-side", async ({
    page,
  }) => {
    await openReceivable(page, receivableId);

    // Quita `disabled`/`readonly` directamente en el DOM para simular un
    // request manipulado: ocultar/deshabilitar el input en la UI no basta,
    // el server action y el trigger de base de datos deben rechazarlo igual.
    await page.evaluate(() => {
      const amount = document.getElementById(
        "amount_total",
      ) as HTMLInputElement | null;
      amount?.removeAttribute("readonly");
      if (amount) amount.value = "999999.00";
    });

    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(
      page.getByText(
        "Esta cuenta ya tiene pagos registrados: el monto, la moneda, el cliente y la escritura relacionada no se pueden modificar.",
        { exact: true },
      ),
    ).toBeVisible({ timeout: 15_000 });

    // El monto no cambió a pesar del request manipulado.
    await page.reload();
    await expect(page.getByLabel("Monto total")).toHaveValue("120000.00");
  });

  test("F: voiding the only payment does NOT unlock financial fields", async ({
    page,
  }) => {
    await voidActiveTestReceivablePayments(receivableId);

    await openReceivable(page, receivableId);

    await expect(page.getByText(lockedNoticeText)).toBeVisible();
    await expect(page.getByLabel("Monto total")).toHaveAttribute("readonly", "");
    await expect(page.getByLabel("Moneda")).toBeDisabled();
    await expect(page.getByLabel("Cliente", { exact: true })).toBeDisabled();

    // Confirma también a nivel de servidor (no solo la UI deshabilitada).
    await page.evaluate(() => {
      const currency = document.getElementById(
        "currency",
      ) as HTMLSelectElement | null;
      currency?.removeAttribute("disabled");
      if (currency) currency.value = "USD";
    });
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByText(
        "Esta cuenta ya tiene pagos registrados: el monto, la moneda, el cliente y la escritura relacionada no se pueden modificar.",
        { exact: true },
      ),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("G: a receivable with no payments still allows changing the client", async ({
    page,
  }) => {
    const freshConcept = uniqueName("recv-immut", "sin-pagos");
    const fresh = await createTestReceivable(registry, {
      client_id: clientIdA,
      concept: freshConcept,
      amount_total: "50000.00",
    });

    await openReceivable(page, fresh.id);
    await expect(page.getByText(lockedNoticeText)).toHaveCount(0);

    await page.getByLabel("Cliente", { exact: true }).selectOption(clientIdB);
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page).toHaveURL(/\/receivables\/[0-9a-f-]{36}$/, {
      timeout: 15_000,
    });
    await expect(page.getByText(clientNameB).first()).toBeVisible();
    await registerCreatedViaUi(registry, "receivables", "concept", freshConcept);
  });
});
