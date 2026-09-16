import { expect, test } from "@playwright/test";

test.describe("public landing", () => {
  test("is available without a session and presents the real product scope", async ({
    page,
  }) => {
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Gestión legal y notarial, en un solo lugar.",
      }),
    ).toBeVisible();
    await expect(page).toHaveTitle("LexCR — Gestión legal y notarial");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /clientes, machotes, escrituras, índice notarial y cuentas por cobrar/i,
    );

    for (const capability of [
      "Clientes",
      "Machotes",
      "Escrituras",
      "Índice Notarial",
      "Cuentas por cobrar",
    ]) {
      await expect(
        page.getByRole("heading", {
          level: 3,
          name: capability,
          exact: true,
        }),
      ).toBeVisible();
    }
  });

  test("login call to action opens the existing login flow", async ({ page }) => {
    await page.goto("/");

    const loginLink = page.getByRole("link", { name: "Iniciar sesión" }).first();
    await expect(loginLink).toHaveAttribute("href", "/login");
    await loginLink.click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" }),
    ).toBeVisible();
  });

  test("dashboard remains protected without a session", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" }),
    ).toBeVisible();
  });

  test("keeps its main action keyboard-accessible on a mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const heroLogin = page.getByRole("link", { name: "Iniciar sesión" }).nth(1);
    await heroLogin.focus();
    await expect(heroLogin).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/login$/);
  });
});
