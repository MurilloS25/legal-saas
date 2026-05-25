import { test, expect } from "@playwright/test";

// Tests share the same user account. Serial mode prevents race conditions
// between tests that write to the same client records.
test.describe.configure({ mode: "serial" });

// Module-level state shared between serial tests in this describe block.
let createdClientName = "";
let editedClientName = "";

test.describe("clients module", () => {
  test("A: clients list page is accessible from the sidebar", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await page.getByRole("link", { name: "Clientes" }).first().click();

    await expect(page).toHaveURL(/\/dashboard\/clients/);
    await expect(
      page.getByRole("heading", {
        name: "Directorio de clientes",
        exact: true,
      }),
    ).toBeVisible();
  });

  test("B: new client page is reachable", async ({ page }) => {
    await page.goto("/dashboard/clients");

    await page
      .getByRole("link", { name: /Nuevo cliente|Agregar cliente/ })
      .first()
      .click();

    await expect(page).toHaveURL(/\/dashboard\/clients\/new$/);
    await expect(
      page.getByRole("heading", { name: "Nuevo cliente", exact: true }),
    ).toBeVisible();
  });

  test("C: user can create a new persona física client", async ({ page }) => {
    // Use a unique name so previous test runs don't cause strict-mode violations.
    createdClientName = `Test Client E2E ${Date.now()}`;

    await page.goto("/dashboard/clients/new");

    await page.getByLabel("Nombre completo").fill(createdClientName);
    // identification_type defaults to cedula_fisica — no change needed
    await page.getByLabel("Número de cédula").fill("0-0001-0001");
    await page.getByLabel("Estado civil").selectOption("soltero");
    await page.getByLabel("Nacionalidad").fill("Costarricense");
    await page.getByLabel("Ocupación").fill("Ingeniero de pruebas");
    await page.getByLabel("Dirección exacta").fill("San José, Test 123");

    await page.getByRole("button", { name: "Crear cliente" }).click();

    // After successful create the action redirects to /dashboard/clients (the list).
    await expect(page).toHaveURL(/\/dashboard\/clients$/, {
      timeout: 15_000,
    });
    await expect(page.getByText(createdClientName).first()).toBeVisible();
  });

  test("D: created client appears in the list", async ({ page }) => {
    await page.goto("/dashboard/clients");

    await expect(page.getByText(createdClientName).first()).toBeVisible();
  });

  test("E: user can edit an existing client", async ({ page }) => {
    await page.goto("/dashboard/clients");

    await page
      .getByRole("link")
      .filter({ hasText: createdClientName })
      .first()
      .click();
    await expect(page).toHaveURL(/\/dashboard\/clients\/[^/]+$/);

    editedClientName = `${createdClientName} Editado`;
    await page.getByLabel("Nombre completo").fill(editedClientName);
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    // After save the action redirects back to the client list.
    await expect(page).toHaveURL(/\/dashboard\/clients$/, { timeout: 15_000 });
  });

  test("F: edited client name persists after page reload", async ({ page }) => {
    await page.goto("/dashboard/clients");
    await page
      .getByRole("link")
      .filter({ hasText: editedClientName })
      .first()
      .click();
    await expect(page).toHaveURL(/\/dashboard\/clients\/[^/]+$/);

    await page.reload();
    await expect(page.getByLabel("Nombre completo")).toHaveValue(
      editedClientName,
    );
  });

  test("G: user can delete a client from the detail page", async ({ page }) => {
    await page.goto("/dashboard/clients");
    await page
      .getByRole("link")
      .filter({ hasText: editedClientName })
      .first()
      .click();
    await expect(page).toHaveURL(/\/dashboard\/clients\/[^/]+$/);

    // Open delete confirmation dialog — trash icon in the card header
    await page.getByRole("button", { name: `Eliminar ${editedClientName}` }).click();

    // Dialog should be visible with the confirmation message
    await expect(
      page.getByRole("alertdialog"),
    ).toBeVisible();

    // Confirm deletion (exact: true avoids matching the trash-icon trigger button)
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();

    // After delete the action redirects back to /dashboard/clients
    await expect(page).toHaveURL(/\/dashboard\/clients$/, { timeout: 10_000 });
    await expect(page.getByText(editedClientName)).not.toBeVisible();
  });
});
