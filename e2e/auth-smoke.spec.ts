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

  test("B: /signup carga correctamente", async ({ page }) => {
    await page.goto("/signup");

    await expect(
      page.getByRole("heading", { name: "Crear cuenta" }),
    ).toBeVisible();
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByLabel("Contraseña", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirmar contraseña")).toBeVisible();
    await expect(page.getByText(/Mínimo 12 caracteres/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Crear cuenta" }),
    ).toBeVisible();
  });

  test("C: /dashboard sin sesión redirige a /login", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" }),
    ).toBeVisible();
  });

  test("D: /dashboard/settings sin sesión redirige a /login", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");

    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" }),
    ).toBeVisible();
  });

  test("D2: /dashboard/documents sin sesión redirige a /login", async ({
    page,
  }) => {
    await page.goto("/dashboard/documents");

    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" }),
    ).toBeVisible();
  });

  test("E: login inválido muestra error visible", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Correo electrónico").fill("test@example.com");
    await page.getByLabel("Contraseña").fill("contraseña-incorrecta");
    await page.getByRole("button", { name: "Ingresar" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).not.toHaveURL(/\/dashboard/);
  });
});
