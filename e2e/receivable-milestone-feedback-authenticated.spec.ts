import { test, expect } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
  createTestReceivable,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";

// El hito de "recién creada" vive en el estado del cliente de esa carga de
// página — cada test de Playwright abre su propia página, así que cada uno
// que necesita verlo crea su propia cuenta. Serie para evitar carreras.
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

test.describe("receivable milestone feedback", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "receivable-milestone-feedback");
  });

  test("A: creating a receivable for the first time shows the milestone banner, and 'Ver Pagos' switches to the Pagos tab", async ({
    page,
  }) => {
    const client = await createTestClient(registry, {
      full_name: uniqueName("receivable-milestone", "cliente-a"),
      identification_number: "1-0101-0101",
    });
    const concept = uniqueName("receivable-milestone", "concepto-a");

    await page.goto("/dashboard/receivables/new");
    await page.getByLabel("Cliente", { exact: true }).selectOption(client.id);
    await page.getByLabel("Concepto").fill(concept);
    await page.getByLabel("Monto total").fill("50000.00");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page).toHaveURL(/\/dashboard\/receivables\/[0-9a-f-]{36}/, {
      timeout: 15_000,
    });
    await registerCreatedViaUi(registry, "receivables", "concept", concept);

    const banner = page
      .getByRole("status")
      .filter({ hasText: "Cuenta por cobrar creada" });
    await expect(banner).toBeVisible();
    await expect(
      banner.getByText(
        "La cuenta ya está disponible. Ahora puedes registrar pagos y consultar su historial.",
      ),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/created=1/);

    await banner.getByRole("button", { name: "Ver Pagos" }).click();
    await expect(
      page.getByRole("tab", { name: "Pagos" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("button", { name: "Registrar pago" }),
    ).toBeVisible();
    // Cambiar de tab no descarta el banner.
    await expect(banner).toBeVisible();
  });

  test("B: dismissing the banner hides it and it does not reappear on reload", async ({
    page,
  }) => {
    const client = await createTestClient(registry, {
      full_name: uniqueName("receivable-milestone", "cliente-b"),
      identification_number: "2-0202-0202",
    });
    const concept = uniqueName("receivable-milestone", "concepto-b");

    await page.goto("/dashboard/receivables/new");
    await page.getByLabel("Cliente", { exact: true }).selectOption(client.id);
    await page.getByLabel("Concepto").fill(concept);
    await page.getByLabel("Monto total").fill("25000.00");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/dashboard\/receivables\/[0-9a-f-]{36}/, {
      timeout: 15_000,
    });
    await registerCreatedViaUi(registry, "receivables", "concept", concept);

    const banner = page
      .getByRole("status")
      .filter({ hasText: "Cuenta por cobrar creada" });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Cerrar" }).click();
    await expect(banner).toHaveCount(0);

    await page.reload();
    await expect(
      page.getByRole("status").filter({ hasText: "Cuenta por cobrar creada" }),
    ).toHaveCount(0);
  });

  test("C: opening an existing receivable (not just created) never shows the milestone", async ({
    page,
  }) => {
    const client = await createTestClient(registry, {
      full_name: uniqueName("receivable-milestone", "cliente-c"),
      identification_number: "3-0303-0303",
    });
    const receivable = await createTestReceivable(registry, {
      client_id: client.id,
      concept: uniqueName("receivable-milestone", "concepto-c"),
    });

    await page.goto(`/dashboard/receivables/${receivable.id}`);
    await expect(
      page.getByRole("status").filter({ hasText: "Cuenta por cobrar creada" }),
    ).toHaveCount(0);
  });
});
