import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
  createTestDocument,
  createTestTemplate,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";

// Los tests comparten el usuario de prueba; modo serial para evitar carreras
// sobre las mismas cuentas por cobrar.
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const clientName = uniqueName("receivables", "cliente");
const documentTitle = uniqueName("receivables", "escritura");
const concept = uniqueName("receivables", "concepto");
let clientId = "";
let documentId = "";

async function openReceivableFromList(page: Page, text: string) {
  const link = page.getByRole("link").filter({ hasText: text }).first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/dashboard\/receivables\/[0-9a-f-]{36}$/);
  await page.goto(href!);
  await expect(page).toHaveURL(/\/dashboard\/receivables\/[0-9a-f-]{36}$/);
}

test.describe("receivables module", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "receivables");
  });

  test("A: seed a client and a document", async () => {
    const client = await createTestClient(registry, {
      full_name: clientName,
      identification_number: "5-0505-0505",
    });
    clientId = client.id;

    const template = await createTestTemplate(registry, {
      name: uniqueName("receivables", "machote"),
      content: "ESCRITURA de prueba.",
    });
    const doc = await createTestDocument(registry, template.id, {
      title: documentTitle,
      client_id: clientId,
      rendered_content: "ESCRITURA de prueba.",
    });
    documentId = doc.id;
  });

  test("B: receivables list is reachable from the sidebar", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Cuentas por cobrar", exact: true })
      .click();

    await expect(page).toHaveURL(/\/dashboard\/receivables/, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: "Cuentas por cobrar", exact: true }),
    ).toBeVisible();
  });

  test("C: user can create a receivable without a document", async ({
    page,
  }) => {
    await page.goto("/dashboard/receivables/new");

    await page.getByLabel("Cliente", { exact: true }).selectOption(clientId);
    await page.getByLabel("Concepto").fill(concept);
    await page.getByLabel("Moneda").selectOption("CRC");
    await page.getByLabel("Monto total").fill("150000.00");
    // issued_at ya trae la fecha de hoy por defecto.

    await page.getByRole("button", { name: "Crear cuenta" }).click();

    // Redirige al detalle de la cuenta recién creada.
    await expect(page).toHaveURL(
      /\/dashboard\/receivables\/[0-9a-f-]{36}\?created=1$/,
      { timeout: 15_000 },
    );
    await registerCreatedViaUi(registry, "receivables", "concept", concept);

    await expect(
      page.getByRole("heading", { name: concept, exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Pendiente", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Cuenta creada.", { exact: true }),
    ).toBeVisible();
    // Abre directamente en "Datos de la cuenta", sin desplazamiento inesperado.
    await expect(
      page.getByRole("tab", { name: "Datos de la cuenta" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Monto total")).toBeVisible();
  });

  test("D: created receivable appears in the list", async ({ page }) => {
    await page.goto("/dashboard/receivables");
    await expect(page.getByText(concept).first()).toBeVisible();
  });

  test("E: user can edit the amount and link a document", async ({ page }) => {
    await page.goto("/dashboard/receivables");
    await openReceivableFromList(page, concept);

    await page.getByLabel("Monto total").fill("175000.00");
    await page.getByLabel("Escritura").selectOption(documentId);
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page).toHaveURL(/\/dashboard\/receivables\/[0-9a-f-]{36}$/, {
      timeout: 15_000,
    });
    // La tarjeta de resumen refleja el nuevo saldo tras guardar.
    await expect(
      page.getByText("₡175.000,00 CRC", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("F: edited amount and activity persist after reload", async ({
    page,
  }) => {
    await page.goto("/dashboard/receivables");
    await openReceivableFromList(page, concept);
    await page.reload();

    await expect(page.getByLabel("Monto total")).toHaveValue("175000.00");

    // El historial registró el cambio de monto y el vínculo con la
    // escritura — ahora vive en el diálogo "Historial" del encabezado.
    await page.getByRole("button", { name: "Historial" }).click();
    const dialog = page.getByRole("dialog", { name: "Historial de la cuenta" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("Monto actualizado", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText("Escritura vinculada", { exact: true }),
    ).toBeVisible();
  });

  test("G: a second receivable can point to the same document", async ({
    page,
  }) => {
    const secondConcept = uniqueName("receivables", "concepto2");
    await page.goto("/dashboard/receivables/new");

    await page.getByLabel("Cliente", { exact: true }).selectOption(clientId);
    await page.getByLabel("Escritura").selectOption(documentId);
    await page.getByLabel("Concepto").fill(secondConcept);
    await page.getByLabel("Monto total").fill("50000.00");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page).toHaveURL(
      /\/dashboard\/receivables\/[0-9a-f-]{36}\?created=1$/,
      { timeout: 15_000 },
    );
    await registerCreatedViaUi(
      registry,
      "receivables",
      "concept",
      secondConcept,
    );
    await expect(
      page.getByRole("heading", { name: secondConcept, exact: true }),
    ).toBeVisible();
  });

  test("H: rejects a non-positive amount", async ({ page }) => {
    await page.goto("/dashboard/receivables/new");
    await page.getByLabel("Cliente", { exact: true }).selectOption(clientId);
    await page.getByLabel("Concepto").fill(uniqueName("receivables", "malo"));
    await page.getByLabel("Monto total").fill("0");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    // Permanece en el formulario y muestra un error de validación.
    await expect(page).toHaveURL(/\/dashboard\/receivables\/new$/);
    await expect(
      page.getByText("El monto debe ser mayor que cero"),
    ).toBeVisible();
  });

  test("I: user can create a receivable with a free-text client name, optionally linked to a document", async ({
    page,
  }) => {
    const freeName = uniqueName("receivables", "nombre-libre");
    const freeConcept = uniqueName("receivables", "concepto-libre");
    await page.goto("/dashboard/receivables/new");

    await page.getByRole("radio", { name: "Escribir nombre" }).check();
    await page.getByLabel("Nombre del cliente").fill(freeName);
    await page.getByLabel("Escritura").selectOption(documentId);
    await page.getByLabel("Concepto").fill(freeConcept);
    await page.getByLabel("Monto total").fill("30000.00");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page).toHaveURL(
      /\/dashboard\/receivables\/[0-9a-f-]{36}\?created=1$/,
      { timeout: 15_000 },
    );
    await registerCreatedViaUi(registry, "receivables", "concept", freeConcept);

    await expect(
      page.getByRole("heading", { name: freeConcept, exact: true }),
    ).toBeVisible();
    // El nombre libre se muestra como texto plano, sin enlazar a un Cliente.
    const clientText = page.getByText(freeName, { exact: true });
    await expect(clientText).toBeVisible();
    await expect(clientText).not.toHaveAttribute("href", /.+/);

    // El modo "Escribir nombre" y el nombre quedan reflejados en el formulario.
    await expect(
      page.getByRole("radio", { name: "Escribir nombre" }),
    ).toBeChecked();
    await expect(page.getByLabel("Nombre del cliente")).toHaveValue(freeName);
  });

  test("J: a free-text receivable persists after reload and appears in the list", async ({
    page,
  }) => {
    const freeName = uniqueName("receivables", "nombre-libre2");
    const freeConcept = uniqueName("receivables", "concepto-libre2");
    await page.goto("/dashboard/receivables/new");

    await page.getByRole("radio", { name: "Escribir nombre" }).check();
    await page.getByLabel("Nombre del cliente").fill(freeName);
    await page.getByLabel("Concepto").fill(freeConcept);
    await page.getByLabel("Monto total").fill("15000.00");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page).toHaveURL(
      /\/dashboard\/receivables\/[0-9a-f-]{36}\?created=1$/,
      { timeout: 15_000 },
    );
    await registerCreatedViaUi(registry, "receivables", "concept", freeConcept);
    await page.reload();
    await expect(page.getByLabel("Nombre del cliente")).toHaveValue(freeName);

    await page.goto("/dashboard/receivables");
    await expect(page.getByText(freeName).first()).toBeVisible();
  });

  test("K: switching an existing receivable from a registered client to a free-text name saves correctly", async ({
    page,
  }) => {
    const switchConcept = uniqueName("receivables", "concepto-switch");
    const freeName = uniqueName("receivables", "nombre-switch");
    await page.goto("/dashboard/receivables/new");
    await page.getByLabel("Cliente", { exact: true }).selectOption(clientId);
    await page.getByLabel("Concepto").fill(switchConcept);
    await page.getByLabel("Monto total").fill("20000.00");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(
      /\/dashboard\/receivables\/[0-9a-f-]{36}\?created=1$/,
      { timeout: 15_000 },
    );
    await registerCreatedViaUi(registry, "receivables", "concept", switchConcept);

    await page.getByRole("radio", { name: "Escribir nombre" }).check();
    await page.getByLabel("Nombre del cliente").fill(freeName);
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page).toHaveURL(/\/dashboard\/receivables\/[0-9a-f-]{36}$/, {
      timeout: 15_000,
    });
    await page.reload();
    await expect(
      page.getByRole("radio", { name: "Escribir nombre" }),
    ).toBeChecked();
    await expect(page.getByLabel("Nombre del cliente")).toHaveValue(freeName);
  });
});
