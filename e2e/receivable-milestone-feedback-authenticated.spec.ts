import { test, expect } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
  createTestReceivable,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";

/**
 * El antiguo banner azul "Cuenta por cobrar creada" (`MilestoneFeedback`,
 * con el botón "Ver Pagos") desapareció por completo. La confirmación ahora
 * es un toast temporal — "Ver Pagos" se eliminó porque la pestaña "Pagos"
 * ya está siempre visible en el encabezado del workspace (navegación
 * redundante, no la única forma de llegar ahí).
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

test.describe("receivable milestone feedback (toast replacement)", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "receivable-milestone-feedback");
  });

  test("A: creating a receivable for the first time shows a toast (not the old banner or its 'Ver Pagos' button)", async ({
    page,
  }) => {
    const client = await createTestClient(registry, {
      full_name: uniqueName("receivable-milestone", "cliente-a"),
      identification_number: "1-0101-0101",
    });
    const concept = uniqueName("receivable-milestone", "concepto-a");

    await page.goto("/receivables/new");
    await page.getByLabel("Cliente", { exact: true }).selectOption(client.id);
    await page.getByLabel("Concepto").fill(concept);
    await page.getByLabel("Monto total").fill("50000.00");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page).toHaveURL(/\/receivables\/[0-9a-f-]{36}/, {
      timeout: 15_000,
    });
    await registerCreatedViaUi(registry, "receivables", "concept", concept);

    await expect(
      page
        .getByRole("status")
        .getByText("Cuenta por cobrar creada.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page).not.toHaveURL(/created=1/);

    // El banner antiguo describía el hito con este texto y ofrecía un
    // botón de atajo — ninguno de los dos existe ya.
    await expect(
      page.getByText(
        "La cuenta ya está disponible. Ahora puedes registrar pagos y consultar su historial.",
      ),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Ver Pagos" }),
    ).toHaveCount(0);

    // La pestaña "Pagos" sigue siendo alcanzable directamente (siempre
    // visible en el encabezado, no dependiente del banner eliminado).
    await page.getByRole("tab", { name: "Pagos" }).click();
    await expect(
      page.getByRole("tab", { name: "Pagos" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("button", { name: "Registrar pago" }),
    ).toBeVisible();
  });

  test("B: opening an existing receivable (not just created) never shows the toast or old banner", async ({
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

    await page.goto(`/receivables/${receivable.id}`);
    await expect(
      page
        .getByRole("status")
        .getByText("Cuenta por cobrar creada.", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("Cuenta por cobrar creada")).toHaveCount(0);
  });
});
