import { test, expect } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
  createTestReceivable,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";

// Tests share the same seed data and interact with the same dialog;
// serial mode avoids races.
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

test.describe("create a client from the receivable form", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "receivable-client-contextual-creation");
  });

  test("A: the dialog only appears in 'Cliente registrado' mode, not 'Escribir nombre'", async ({
    page,
  }) => {
    await page.goto("/receivables/new");

    // El modo por defecto es "Cliente registrado".
    await expect(
      page.getByRole("button", { name: "+ Crear nuevo cliente" }),
    ).toBeVisible();

    await page.getByRole("radio", { name: "Escribir nombre" }).check();
    await expect(
      page.getByRole("button", { name: "+ Crear nuevo cliente" }),
    ).toHaveCount(0);

    await page.getByRole("radio", { name: "Cliente registrado" }).check();
    await expect(
      page.getByRole("button", { name: "+ Crear nuevo cliente" }),
    ).toBeVisible();
  });

  test("B: cancelling the dialog preserves the rest of the form and creates nothing", async ({
    page,
  }) => {
    await page.goto("/receivables/new");

    const concept = uniqueName("receivable-client-dialog", "concepto-cancelado");
    await page.getByLabel("Concepto").fill(concept);
    await page.getByLabel("Monto total").fill("500");

    await page.getByRole("button", { name: "+ Crear nuevo cliente" }).click();
    const dialog = page.getByRole("dialog", { name: "Crear nuevo cliente" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Nombre completo").fill("No debería crearse");
    await dialog.getByRole("button", { name: "Cancelar" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByLabel("Concepto")).toHaveValue(concept);
    await expect(page.getByLabel("Monto total")).toHaveValue("500");
    await expect(page.getByLabel("Cliente", { exact: true })).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "+ Crear nuevo cliente" }),
    ).toBeFocused();
  });

  test("C: an invalid submission keeps the dialog open and selects nothing", async ({
    page,
  }) => {
    await page.goto("/receivables/new");

    await page.getByRole("button", { name: "+ Crear nuevo cliente" }).click();
    const dialog = page.getByRole("dialog", { name: "Crear nuevo cliente" });

    await dialog.getByLabel("Número de cédula").fill("8-8888-8888");
    await dialog.getByRole("button", { name: "Crear cliente" }).click();

    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Número de cédula")).toHaveValue(
      "8-8888-8888",
    );
    await expect(page.getByLabel("Cliente", { exact: true })).toHaveValue("");
  });

  test("D: creating a client selects it immediately and preserves the rest of the form (document, amount, dates, notes)", async ({
    page,
  }) => {
    await page.goto("/receivables/new");

    const concept = uniqueName("receivable-client-dialog", "concepto-creado");
    const notes = "Notas que deben sobrevivir a la creación del cliente";
    await page.getByLabel("Concepto").fill(concept);
    await page.getByLabel("Moneda").selectOption("USD");
    await page.getByLabel("Monto total").fill("321.50");
    await page.getByLabel("Notas internas").fill(notes);

    const clientName = uniqueName("receivable-client-dialog", "cliente");
    await page.getByRole("button", { name: "+ Crear nuevo cliente" }).click();
    const dialog = page.getByRole("dialog", { name: "Crear nuevo cliente" });
    await dialog.getByLabel("Nombre completo").fill(clientName);
    await dialog.getByLabel("Número de cédula").fill("3-3333-3333");
    await dialog.getByLabel("Estado civil").selectOption("Casado");
    await dialog.getByLabel("Nacionalidad").fill("Costarricense");
    await dialog.getByLabel("Ocupación").fill("Contador");
    await dialog.getByLabel("Dirección exacta").fill("Heredia, Costa Rica");
    await dialog.getByRole("button", { name: "Crear cliente" }).click();

    await expect(dialog).toHaveCount(0, { timeout: 15_000 });
    await registerCreatedViaUi(registry, "clients", "full_name", clientName);

    const select = page.getByLabel("Cliente", { exact: true });
    await expect(select).not.toHaveValue("");
    await expect(
      select.locator("option:checked"),
    ).toHaveText(clientName);

    // El resto del formulario nunca se remontó.
    await expect(page.getByLabel("Concepto")).toHaveValue(concept);
    await expect(page.getByLabel("Monto total")).toHaveValue("321.50");
    await expect(page.getByLabel("Notas internas")).toHaveValue(notes);
    await expect(page.getByLabel("Moneda")).toHaveValue(
      "USD",
    );

    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/receivables\/[0-9a-f-]{36}/, {
      timeout: 15_000,
    });
    await registerCreatedViaUi(registry, "receivables", "concept", concept);

    await page.reload();
    // El nombre del cliente aparece como link en el encabezado del
    // workspace (persistió tras recargar) — se acota al header porque el
    // mismo texto también existe en el <option> seleccionado del select.
    await expect(page.getByRole("link", { name: clientName })).toBeVisible();
  });

  test("E: the dialog is also reachable when editing an existing receivable, in registered mode", async ({
    page,
  }) => {
    const client = await createTestClient(registry, {
      full_name: uniqueName("receivable-client-dialog", "cliente-existente"),
      identification_number: "4-4444-4444",
    });
    const receivable = await createTestReceivable(registry, {
      client_id: client.id,
      concept: uniqueName("receivable-client-dialog", "concepto-editar"),
    });

    await page.goto(`/receivables/${receivable.id}`);

    await expect(
      page.getByRole("button", { name: "+ Crear nuevo cliente" }),
    ).toBeVisible();

    const newClientName = uniqueName(
      "receivable-client-dialog",
      "cliente-reemplazo",
    );
    await page.getByRole("button", { name: "+ Crear nuevo cliente" }).click();
    const dialog = page.getByRole("dialog", { name: "Crear nuevo cliente" });
    await dialog.getByLabel("Nombre completo").fill(newClientName);
    await dialog.getByLabel("Número de cédula").fill("5-5555-5555");
    await dialog.getByLabel("Estado civil").selectOption("Divorciada");
    await dialog.getByLabel("Nacionalidad").fill("Costarricense");
    await dialog.getByLabel("Ocupación").fill("Médico");
    await dialog.getByLabel("Dirección exacta").fill("Alajuela, Costa Rica");
    await dialog.getByRole("button", { name: "Crear cliente" }).click();

    await expect(dialog).toHaveCount(0, { timeout: 15_000 });
    await registerCreatedViaUi(registry, "clients", "full_name", newClientName);

    const select = page.getByLabel("Cliente", { exact: true });
    await expect(select.locator("option:checked")).toHaveText(newClientName);
  });
});
