import { expect, test } from "@playwright/test";

test.describe("authenticated landing", () => {
  test("remains public and offers a direct path to the panel", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Gestión legal y notarial, en un solo lugar.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Iniciar sesión" }),
    ).toHaveCount(0);

    await page.getByRole("link", { name: "Ir al panel" }).first().click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("main")).toBeVisible();
  });
});
