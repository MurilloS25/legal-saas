import { expect, test } from "@playwright/test";

const missingRoutes = [
  "/dashboardx",
  "/algo-que-no-existe",
  "/dashboard/algo-que-no-existe",
];

const invalidResourceRoutes = [
  "/clients/neww",
  "/documents/not-a-uuid",
  "/documents/new/not-a-uuid",
  "/templates/not-a-uuid",
  "/templates/not-a-uuid/fill",
  "/receivables/not-a-uuid",
];

const missingResourceRoutes = [
  "/clients/00000000-0000-0000-0000-000000000000",
];

test.describe("custom global 404", () => {
  for (const route of missingRoutes) {
    test(`shows the LexCR not-found page for ${route}`, async ({ page }) => {
      const response = await page.goto(route);

      expect(response?.status()).toBe(404);
      await expect(
        page.getByRole("heading", { level: 1, name: "Página no encontrada" }),
      ).toBeVisible();
      await expect(page.getByText("404", { exact: true })).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Volver al panel" }),
      ).toBeVisible();
    });
  }

  for (const route of invalidResourceRoutes) {
    test(`rejects an invalid resource id before database access for ${route}`, async ({
      page,
    }) => {
      const response = await page.goto(route);

      expect(response?.status()).toBe(404);
      await expect(
        page.getByRole("heading", { level: 1, name: "Página no encontrada" }),
      ).toBeVisible();
    });
  }

  for (const route of missingResourceRoutes) {
    test(`shows not found for a valid but missing resource at ${route}`, async ({
      page,
    }) => {
      const response = await page.goto(route);

      expect(response?.status()).toBe(404);
      await expect(
        page.getByRole("heading", { level: 1, name: "Página no encontrada" }),
      ).toBeVisible();
    });
  }

  test("returns to the dashboard with visible keyboard focus", async ({
    page,
  }) => {
    await page.goto("/algo-que-no-existe");

    const backLink = page.getByRole("link", { name: "Volver al panel" });
    await backLink.focus();
    await expect(backLink).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  });

  test("fits a mobile viewport without horizontal overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/algo-que-no-existe");

    await expect(
      page.getByRole("heading", { level: 1, name: "Página no encontrada" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Volver al panel" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
});
