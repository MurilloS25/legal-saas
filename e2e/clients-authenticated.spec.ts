import { test, expect, type Page } from "@playwright/test";

// Tests share the same user account. Serial mode prevents race conditions
// between tests that write to the same client records.
test.describe.configure({ mode: "serial" });

// Module-level state shared between serial tests in this describe block.
let createdClientName = "";
let editedClientName = "";

// El directorio está paginado y ordenado por nombre: con datos de otros specs
// un cliente recién creado puede no estar en la página 1. Se localiza con la
// búsqueda server-side (`?q=`) en vez de depender de su posición.
async function gotoClientsSearching(page: Page, name: string) {
  await page.goto(`/clients?q=${encodeURIComponent(name)}`);
}

async function openClientFromList(page: Page, name: string) {
  const clientLink = page
    .getByRole("link")
    .filter({ hasText: name })
    .first();
  await expect(clientLink).toBeVisible();

  const href = await clientLink.getAttribute("href");
  expect(href).toMatch(/^\/clients\/[^/]+$/);

  await page.goto(href!);
  await expect(page).toHaveURL(/\/clients\/[^/]+$/);
}

test.describe("clients module", () => {
  test("A: clients list page is accessible from the sidebar", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Clientes", exact: true })
      .click();

    await expect(page).toHaveURL(/\/clients/, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", {
        name: "Directorio de clientes",
        exact: true,
      }),
    ).toBeVisible();
  });

  test("B: new client page is reachable", async ({ page }) => {
    await page.goto("/clients");

    await page
      .getByRole("link", { name: /Nuevo cliente|Agregar cliente/ })
      .first()
      .click();

    await expect(page).toHaveURL(/\/clients\/new$/, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: "Nuevo cliente", exact: true }),
    ).toBeVisible();
  });

  test("C: user can create a new persona física client", async ({ page }) => {
    // Use a unique name so previous test runs don't cause strict-mode violations.
    createdClientName = `Test Client E2E ${Date.now()}`;

    await page.goto("/clients/new");

    await page.getByLabel("Nombre completo").fill(createdClientName);
    // identification_type defaults to cedula_fisica — no change needed
    await page.getByLabel("Número de cédula").fill("0-0001-0001");
    await page.getByLabel("Estado civil").selectOption("Casado/a dos veces");
    await page.getByLabel("Nacionalidad").fill("Costarricense");
    await page.getByLabel("Ocupación").fill("Ingeniero de pruebas");
    await page.getByLabel("Dirección exacta").fill("San José, Test 123");

    await page.getByRole("button", { name: "Crear cliente" }).click();

    // After successful create the action redirects to /clients (the list).
    await expect(page).toHaveURL(/\/clients$/, {
      timeout: 15_000,
    });
    // Toast fires from `ClientLifecycleToast` after mount, reading `?event=created`
    // — the create/update Server Actions redirect before `state.success` can ever
    // resolve client-side, so this bridge is the only place the confirmation can
    // come from. Check it before "Guardado." elsewhere on the page might steal focus.
    await expect(
      page.getByRole("status").getByText("Cliente creado.", { exact: true }),
    ).toBeVisible();
    await gotoClientsSearching(page, createdClientName);
    await expect(page.getByText(createdClientName).first()).toBeVisible();
  });

  test("D: created client appears in the list", async ({ page }) => {
    await gotoClientsSearching(page, createdClientName);

    await expect(page.getByText(createdClientName).first()).toBeVisible();
  });

  test("E: user can edit an existing client", async ({ page }) => {
    await gotoClientsSearching(page, createdClientName);

    await openClientFromList(page, createdClientName);

    editedClientName = `${createdClientName} Editado`;
    await page.getByLabel("Nombre completo").fill(editedClientName);
    await page.getByLabel("Estado civil").selectOption("Divorciado/a tres veces");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    // After save the action redirects back to the client list.
    await expect(page).toHaveURL(/\/clients$/, { timeout: 15_000 });
    await expect(
      page.getByRole("status").getByText("Cliente actualizado.", {
        exact: true,
      }),
    ).toBeVisible();
  });

  test("F: edited client name persists after page reload", async ({ page }) => {
    await gotoClientsSearching(page, editedClientName);
    await openClientFromList(page, editedClientName);

    await page.reload();
    await expect(page.getByLabel("Nombre completo")).toHaveValue(
      editedClientName,
    );
  });

  test("F2: identification number is stored and displayed without dashes or spaces", async ({
    page,
  }) => {
    await gotoClientsSearching(page, editedClientName);
    await openClientFromList(page, editedClientName);

    // Entered as "0-0001-0001" in test C — persists normalized.
    await expect(page.getByLabel("Número de cédula")).toHaveValue("000010001");
    await expect(
      page.getByText("La identificación se guardará sin guiones ni espacios."),
    ).toBeVisible();
  });

  test("G: user can delete a client from the detail page", async ({ page }) => {
    await gotoClientsSearching(page, editedClientName);
    await openClientFromList(page, editedClientName);

    // Open delete confirmation dialog — trash icon in the card header
    await page.getByRole("button", { name: `Eliminar ${editedClientName}` }).click();

    // Dialog should be visible with the confirmation message
    await expect(
      page.getByRole("alertdialog"),
    ).toBeVisible();

    // Confirm deletion (exact: true avoids matching the trash-icon trigger button)
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();

    // After delete the action redirects back to /clients
    await expect(page).toHaveURL(/\/clients$/, { timeout: 10_000 });
    await expect(page.getByText(editedClientName)).not.toBeVisible();
  });
});
