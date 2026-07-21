import { test, expect } from "@playwright/test";

// Tests share the same user account and database rows so they must run
// sequentially. fullyParallel is enabled globally but serial mode here
// prevents race conditions between tests that write to the same profile.
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

test.describe("authenticated flows", () => {
  test("A: authenticated user reaches /dashboard without redirect to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(page).not.toHaveURL(/\/login/);
    // Dashboard shows either the generic heading or a time-of-day greeting
    // ("Buenos días"/"Buenas tardes"/"Buenas noches") — see greeting() in
    // src/app/(dashboard)/dashboard/page.tsx.
    await expect(
      page.getByRole("heading", { name: /^(Panel|Buenos días|Buenas tardes|Buenas noches)/ }),
    ).toBeVisible();
  });

  test("B: dashboard exposes every active module without duplicate future links", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    // Configuración is intentionally sidebar-only, not a dashboard module
    // card — its only appearance in main is the first-time "Configurar
    // ahora →" onboarding banner, which disappears once the profile is set.
    const modules = [
      ["Clientes", "/dashboard/clients"],
      ["Machotes", "/dashboard/templates"],
      ["Escrituras", "/dashboard/documents"],
      ["Índice Notarial", "/dashboard/notarial-index"],
      ["Cuentas por cobrar", "/dashboard/receivables"],
    ] as const;

    for (const [label, href] of modules) {
      await expect(
        page
          .getByRole("main")
          .getByRole("link", { name: new RegExp(`^${label}(?:\\s|$)`) }),
      ).toHaveAttribute("href", href);
    }
    await expect(page.getByText("Próximamente", { exact: true })).toHaveCount(0);

    await page
      .getByRole("main")
      .getByRole("link", { name: /^Índice Notarial(?:\s|$)/ })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/notarial-index$/);
    await page.goto("/dashboard");
    await page
      .getByRole("main")
      .getByRole("link", { name: /^Cuentas por cobrar(?:\s|$)/ })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/receivables$/);
  });

  test("C: authenticated user reaches /dashboard/settings", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");

    await expect(page).not.toHaveURL(/\/login/);
    // exact: true distinguishes the h1 "Configuración" from the h2 "Configuración de documentos".
    await expect(
      page.getByRole("heading", { name: "Configuración", exact: true }),
    ).toBeVisible();
  });

  test("C2: both sections render on a single page with no tabs and a single save action", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");

    // Both sections are visible at once — no tab navigation hides either.
    await expect(
      page.getByRole("heading", { name: "Perfil profesional" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Configuración de documentos" }),
    ).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(page.getByRole("tablist")).toHaveCount(0);

    // The old per-section buttons are gone; a single unified action remains.
    await expect(
      page.getByRole("button", { name: "Guardar perfil" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Guardar configuración" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Guardar cambios" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Descartar" }),
    ).toBeVisible();
  });

  test("C3: save and discard are disabled until a change is made", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");

    const saveButton = page.getByRole("button", { name: "Guardar cambios" });
    const discardButton = page.getByRole("button", { name: "Descartar" });

    await expect(saveButton).toBeDisabled();
    await expect(discardButton).toBeDisabled();
    await expect(page.getByRole("status").getByText("Guardado")).toBeVisible();

    await page.getByLabel("Teléfono").fill("8888-1234");

    await expect(saveButton).toBeEnabled();
    await expect(discardButton).toBeEnabled();
    await expect(
      page.getByRole("status").getByText("Cambios sin guardar"),
    ).toBeVisible();
  });

  test("C4: discarding restores the last saved values and disables the actions again", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");

    const original = await page.getByLabel("Teléfono").inputValue();
    await page.getByLabel("Teléfono").fill("9999-9999");
    await page.getByRole("button", { name: "Descartar" }).click();

    await expect(page.getByLabel("Teléfono")).toHaveValue(original);
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Descartar" })).toBeDisabled();
  });

  test("D: user can save the lawyer profile through the unified action", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");

    const name = `E2E Lawyer ${Date.now()}`;

    await page.getByLabel("Nombre completo").fill(name);
    await page.getByLabel("Código profesional").fill("NP-E2E");
    await page.getByLabel("Correo de contacto").fill("e2e@example.com");
    await page.getByLabel("Teléfono").fill("8888-0000");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(
      page.getByRole("status").getByText("Cambios guardados correctamente."),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  });

  test("E: user can save document settings through the unified action", async ({
    page,
  }) => {
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
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(
      page.getByRole("status").getByText("Cambios guardados correctamente."),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("F: saved profile and document settings persist after page reload", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");

    const name = `E2E Persist ${Date.now()}`;
    await page.getByLabel("Nombre completo").fill(name);
    await page.getByLabel("Superior").fill("4.0");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByRole("status").getByText("Cambios guardados correctamente."),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByLabel("Nombre completo")).toHaveValue(name);
    await expect(page.getByLabel("Superior")).toHaveValue("4");
  });

  test("G: an invalid field blocks the whole save and keeps every edited value", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");

    const name = `E2E Invalid ${Date.now()}`;
    await page.getByLabel("Nombre completo").fill(name);
    await page.getByLabel("Correo de contacto").fill("not-an-email");
    await page.getByLabel("Superior").fill("2.0");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    // Validation fails before any write happens — no success banner, no
    // partial-success claim, and the values the user typed are preserved.
    await expect(page.getByRole("alert").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("status").getByText("Cambios guardados correctamente."),
    ).toHaveCount(0);
    await expect(page.getByLabel("Nombre completo")).toHaveValue(name);
    await expect(page.getByLabel("Correo de contacto")).toHaveValue(
      "not-an-email",
    );
    // No reload happened, so the field keeps exactly what was typed
    // (unlike test F, which re-fetches the DB-normalized value).
    await expect(page.getByLabel("Superior")).toHaveValue("2.0");
  });

  test("H: the settings workspace is usable on a mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard/settings");

    await expect(
      page.getByRole("heading", { name: "Configuración", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Perfil profesional" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Configuración de documentos" }),
    ).toBeVisible();

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);

    await page.getByLabel("Teléfono").fill("8888-4321");
    await expect(
      page.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
  });

  test("I: the form is keyboard-navigable end to end", async ({ page }) => {
    await page.goto("/dashboard/settings");

    await page.getByLabel("Nombre completo").focus();
    await expect(page.getByLabel("Nombre completo")).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Código profesional")).toBeFocused();

    // Reach the primary action via keyboard and confirm it activates.
    await page.getByLabel("Interlineado").fill("1.5");
    await page.getByRole("button", { name: "Guardar cambios" }).focus();
    await expect(
      page.getByRole("button", { name: "Guardar cambios" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(
      page.getByRole("status").getByText("Cambios guardados correctamente."),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("J: user can log out and is redirected to /login", async ({ page }) => {
    await page.goto("/dashboard");

    // "Cerrar sesión" is the logout button in the sidebar.
    await page.getByRole("button", { name: "Cerrar sesión" }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" }),
    ).toBeVisible();
  });
});
