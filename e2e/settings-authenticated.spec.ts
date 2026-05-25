import { test, expect } from "@playwright/test";

// Tests share the same user account and database rows so they must run
// sequentially. fullyParallel is enabled globally but serial mode here
// prevents race conditions between tests that write to the same profile.
test.describe.configure({ mode: "serial" });

test.describe("authenticated flows", () => {
  test("A: authenticated user reaches /dashboard without redirect to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(page).not.toHaveURL(/\/login/);
    // Dashboard shows either the generic heading or a personalised welcome.
    await expect(
      page.getByRole("heading", { name: /^(Panel|Bienvenido)/ }),
    ).toBeVisible();
  });

  test("B: authenticated user reaches /dashboard/settings", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");

    await expect(page).not.toHaveURL(/\/login/);
    // exact: true distinguishes the h1 "Configuración" from the h2 "Configuración de documentos".
    await expect(
      page.getByRole("heading", { name: "Configuración", exact: true }),
    ).toBeVisible();
  });

  test("C: user can save lawyer profile", async ({ page }) => {
    await page.goto("/dashboard/settings");

    const name = `E2E Lawyer ${Date.now()}`;

    await page.getByLabel("Nombre completo").fill(name);
    await page.getByLabel("Código profesional").fill("NP-E2E");
    await page.getByLabel("Correo de contacto").fill("e2e@example.com");
    await page.getByLabel("Teléfono").fill("8888-0000");
    await page.getByRole("button", { name: "Guardar perfil" }).click();

    // ProfileForm renders role="status" on success.
    await expect(page.getByRole("status").first()).toBeVisible();
  });

  test("D: user can save document settings", async ({ page }) => {
    await page.goto("/dashboard/settings");

    // exact: true distinguishes "Fuente" from "Tamaño de fuente (pt)".
    await page.getByLabel("Fuente", { exact: true }).selectOption("Arial");
    await page.getByLabel("Tamaño de fuente (pt)").fill("11");

    // Margin inputs are inside a fieldset — locate by their visible labels.
    await page.getByLabel("Superior").fill("3.0");
    await page.getByLabel("Inferior").fill("3.0");
    await page.getByLabel("Izquierdo").fill("2.5");
    await page.getByLabel("Derecho").fill("2.5");

    await page.getByLabel("Interlineado").fill("2.0");
    await page.getByRole("button", { name: "Guardar configuración" }).click();

    // DocumentSettingsForm renders role="status" on success.
    await expect(page.getByRole("status").first()).toBeVisible();
  });

  test("E: saved profile persists after page reload", async ({ page }) => {
    await page.goto("/dashboard/settings");

    const name = `E2E Persist ${Date.now()}`;
    await page.getByLabel("Nombre completo").fill(name);
    await page.getByRole("button", { name: "Guardar perfil" }).click();
    await expect(page.getByRole("status").first()).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Nombre completo")).toHaveValue(name);
  });

  test("F: user can log out and is redirected to /login", async ({ page }) => {
    await page.goto("/dashboard");

    // "Cerrar sesión" is the logout button in the sidebar.
    await page.getByRole("button", { name: "Cerrar sesión" }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" }),
    ).toBeVisible();
  });
});
