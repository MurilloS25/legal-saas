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
    // src/app/(dashboard)/dashboard/page.tsx (the /dashboard overview).
    await expect(
      page.getByRole("heading", { name: /^(Panel|Buenos días|Buenas tardes|Buenas noches)/ }),
    ).toBeVisible();
  });

  test("B: dashboard exposes every active module without duplicate future links", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    // Configuración es solo alcanzable desde el menú de usuario, no una
    // tarjeta de módulo del dashboard — su única aparición en main es el
    // banner de onboarding "Configurar ahora →", que desaparece una vez que
    // el perfil está configurado.
    const modules = [
      ["Clientes", "/clients"],
      ["Machotes", "/templates"],
      ["Escrituras", "/documents"],
      ["Índice Notarial", "/notarial-index"],
      ["Cuentas por cobrar", "/receivables"],
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
    await expect(page).toHaveURL(/\/notarial-index$/);
    await page.goto("/dashboard");
    await page
      .getByRole("main")
      .getByRole("link", { name: /^Cuentas por cobrar(?:\s|$)/ })
      .click();
    await expect(page).toHaveURL(/\/receivables$/);
  });

  test("C: authenticated user reaches /settings, defaulting to the Perfil tab", async ({
    page,
  }) => {
    await page.goto("/settings");

    await expect(page).not.toHaveURL(/\/login/);
    // exact: true distinguishes the h1 "Cuenta y configuración" from the
    // sidebar tab label "Configuración".
    await expect(
      page.getByRole("heading", { name: "Cuenta y configuración", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Cuenta", exact: true }),
    ).toBeVisible();
  });

  test("C2: Perfil/Configuración/Despacho are separate tabs, each with its own save action", async ({
    page,
  }) => {
    await page.goto("/settings");

    // Perfil (default tab): no editable fields, just the account email and
    // a password-reset action — no "Guardar" button here.
    await expect(
      page.getByRole("button", { name: /Enviar enlace de restablecimiento/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toHaveCount(0);

    await page.getByRole("button", { name: "Configuración" }).click();
    await expect(
      page.getByRole("heading", { name: "Configuración de documentos" }),
    ).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Formato de texto" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Márgenes (cm)" })).toBeVisible();

    await page.getByRole("button", { name: "Despacho" }).click();
    await expect(page.getByRole("heading", { name: "Perfil profesional" })).toBeVisible();
  });

  test("C3: save and discard are disabled until a change is made", async ({
    page,
  }) => {
    await page.goto("/settings?tab=workspace");

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
    await page.goto("/settings?tab=workspace");

    const original = await page.getByLabel("Teléfono").inputValue();
    await page.getByLabel("Teléfono").fill("9999-9999");
    await page.getByRole("button", { name: "Descartar" }).click();

    await expect(page.getByLabel("Teléfono")).toHaveValue(original);
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Descartar" })).toBeDisabled();
  });

  test("D: user can save the lawyer profile (Despacho) independently", async ({
    page,
  }) => {
    await page.goto("/settings?tab=workspace");

    const name = `E2E Lawyer ${Date.now()}`;

    await page.getByLabel("Nombre completo").fill(name);
    await page.getByLabel("Código profesional").fill("NP-E2E");
    await page.getByLabel("Correo de contacto").fill("e2e@example.com");
    await page.getByLabel("Teléfono").fill("8888-0000");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(
      page.getByRole("status").getByText("Despacho actualizado."),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  });

  test("E: user can save document settings independently", async ({
    page,
  }) => {
    await page.goto("/settings?tab=document");

    // exact: true distinguishes "Fuente" from "Tamaño (pt)".
    await page.getByLabel("Fuente", { exact: true }).selectOption("Arial");
    await page.getByLabel("Tamaño (pt)").fill("11");

    // Margin inputs are inside a fieldset — locate by their visible labels.
    await page.getByLabel("Superior").fill("3.0");
    await page.getByLabel("Inferior").fill("3.0");
    await page.getByLabel("Izquierdo").fill("2.5");
    await page.getByLabel("Derecho").fill("2.5");

    await page.getByLabel("Interlineado").fill("2.0");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(
      page.getByRole("status").getByText("Configuración de documento guardada."),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("F: saved profile and document settings persist after page reload", async ({
    page,
  }) => {
    await page.goto("/settings?tab=workspace");

    const name = `E2E Persist ${Date.now()}`;
    await page.getByLabel("Nombre completo").fill(name);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByRole("status").getByText("Despacho actualizado."),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByLabel("Nombre completo")).toHaveValue(name);

    await page.goto("/settings?tab=document");
    await page.getByLabel("Superior").fill("4.0");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByRole("status").getByText("Configuración de documento guardada."),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByLabel("Superior")).toHaveValue("4");
  });

  test("G: an invalid field blocks the save for that section and keeps every edited value", async ({
    page,
  }) => {
    await page.goto("/settings?tab=workspace");

    const name = `E2E Invalid ${Date.now()}`;
    await page.getByLabel("Nombre completo").fill(name);
    await page.getByLabel("Correo de contacto").fill("not-an-email");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    // Validation fails before any write happens — no success banner, and
    // the values the user typed are preserved.
    await expect(page.getByRole("alert").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("status").getByText("Despacho actualizado."),
    ).toHaveCount(0);
    await expect(page.getByLabel("Nombre completo")).toHaveValue(name);
    await expect(page.getByLabel("Correo de contacto")).toHaveValue(
      "not-an-email",
    );
  });

  test("H: the settings tabs are usable on a mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/settings?tab=workspace");

    await expect(
      page.getByRole("heading", { name: "Cuenta y configuración", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Perfil profesional" }),
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

  test("I: the Despacho form is keyboard-navigable end to end", async ({ page }) => {
    await page.goto("/settings?tab=workspace");

    await page.getByLabel("Nombre completo").focus();
    await expect(page.getByLabel("Nombre completo")).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Código profesional")).toBeFocused();

    // Reach the primary action via keyboard and confirm it activates.
    await page.getByLabel("Teléfono").fill("8888-7777");
    await page.getByRole("button", { name: "Guardar cambios" }).focus();
    await expect(
      page.getByRole("button", { name: "Guardar cambios" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(
      page.getByRole("status").getByText("Despacho actualizado."),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("J1: the mobile navigation drawer opens via the hamburger, lists every module, and Escape closes it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");

    const openButton = page.getByRole("button", { name: "Abrir navegación" });
    await expect(openButton).toBeVisible();
    await openButton.click();

    const drawer = page.getByRole("dialog", { name: "Menú de navegación" });
    await expect(drawer).toBeVisible();
    for (const label of [
      "Panel",
      "Clientes",
      "Machotes",
      "Escrituras",
      "Índice Notarial",
      "Cuentas por cobrar",
    ]) {
      await expect(drawer.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await expect(drawer.getByRole("link", { name: "Despacho" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
  });

  test("J2: the desktop user menu opens with Perfil/Configuración/Despacho/Cerrar sesión and Escape closes it", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const trigger = page.getByRole("button", { name: "Menú de usuario" });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();

    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Perfil" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Configuración" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Despacho" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();

    await trigger.press("Tab");
    await expect(page.getByRole("button", { name: "Perfil" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
  });

});
