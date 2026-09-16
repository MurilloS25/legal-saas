import { test, expect } from "@playwright/test";

test.describe("auth smoke", () => {
  test("A: /login carga correctamente", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" }),
    ).toBeVisible();
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ingresar" }),
    ).toBeVisible();
  });

  test("B: /signup está deshabilitado — redirige a /login sin ofrecer un enlace de registro", async ({
    page,
  }) => {
    await page.goto("/signup");

    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Crear cuenta" }),
    ).toHaveCount(0);
  });

  test("C: /dashboard sin sesión redirige a /login", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" }),
    ).toBeVisible();
  });

  for (const path of [
    "/clients",
    "/clients/new",
    "/templates",
    "/templates/new",
    "/documents",
    "/documents/new",
    "/notarial-index",
    "/receivables",
    "/receivables/new",
    "/settings",
    "/settings/profile",
  ]) {
    test(`D: ${path} sin sesión redirige a /login`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(/\/login/);
      await expect(
        page.getByRole("heading", { name: "Iniciar sesión" }),
      ).toBeVisible();
    });
  }

  test("E: login inválido muestra error visible", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Correo electrónico").fill("test@example.com");
    await page.getByLabel("Contraseña").fill("contraseña-incorrecta");
    await page.getByRole("button", { name: "Ingresar" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).not.toHaveURL(/\/dashboard/);
  });
});
