import { expect, test } from "@playwright/test";

const LEGACY_REDIRECTS = [
  ["/dashboard/clients/route-id", "/clients/route-id"],
  ["/dashboard/templates/route-id/fill", "/templates/route-id/fill"],
  ["/dashboard/documents/route-id", "/documents/route-id"],
  ["/dashboard/notarial-index", "/notarial-index"],
  ["/dashboard/receivables/route-id", "/receivables/route-id"],
  ["/dashboard/settings", "/settings"],
] as const;

test.describe("authenticated route topology", () => {
  test("the shell generates only canonical module links", async ({ page }) => {
    await page.goto("/dashboard");

    const navigation = page.getByRole("navigation", {
      name: "Navegación principal",
    });
    for (const [name, href] of [
      ["Panel", "/dashboard"],
      ["Clientes", "/clients"],
      ["Machotes", "/templates"],
      ["Escrituras", "/documents"],
      ["Índice Notarial", "/notarial-index"],
      ["Cuentas por cobrar", "/receivables"],
    ] as const) {
      await expect(navigation.getByRole("link", { name, exact: true })).toHaveAttribute(
        "href",
        href,
      );
    }

    await page.getByRole("button", { name: "Menú de usuario" }).click();
    await page.getByRole("button", { name: "Perfil", exact: true }).click();
    await expect(page).toHaveURL(/\/settings\?tab=profile$/);
  });

  for (const [legacyPath, canonicalPath] of LEGACY_REDIRECTS) {
    test(`redirects ${legacyPath} and preserves its query string`, async ({
      request,
      baseURL,
    }) => {
      const response = await request.get(
        `${legacyPath}?page=2&pageSize=25&sort=updated_at&returnTo=%2Fdocuments%2Froute-id`,
        { maxRedirects: 0 },
      );

      expect(response.status()).toBe(308);
      const location = new URL(response.headers().location, baseURL);
      expect(location.pathname).toBe(canonicalPath);
      expect(location.searchParams.get("page")).toBe("2");
      expect(location.searchParams.get("pageSize")).toBe("25");
      expect(location.searchParams.get("sort")).toBe("updated_at");
      expect(location.searchParams.get("returnTo")).toBe("/documents/route-id");
    });
  }

  test("redirects the legacy team route to the workspace settings tab", async ({
    request,
    baseURL,
  }) => {
    const response = await request.get("/dashboard/team?source=bookmark", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(308);
    const location = new URL(response.headers().location, baseURL);
    expect(location.pathname).toBe("/settings");
    expect(location.searchParams.get("tab")).toBe("workspace");
    expect(location.searchParams.get("source")).toBe("bookmark");
  });
});
