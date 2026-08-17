import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestTemplate,
  runCleanup,
  uniqueName,
} from "./support/factories";

/**
 * Flujo guiado en Machotes: "Guardar y continuar" avanza automáticamente al
 * siguiente paso del stepper (Información → Documento → Variables → Índice →
 * Publicar), muestra un toast transitorio en vez de un banner permanente, y
 * un guardado inválido no avanza ni marca el paso como completo. Complementa
 * (no duplica) `template-stepper-create-authenticated.spec.ts`, que cubre el
 * primer guardado en modo creación.
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

function tab(
  page: Page,
  name: "Información" | "Documento" | "Variables" | "Índice" | "Publicar",
) {
  return page.getByRole("tab", { name, exact: true });
}

async function goToTab(page: Page, name: Parameters<typeof tab>[1]) {
  await tab(page, name).click();
}

test.describe("template guided progression", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "template-guided-progression");
  });

  test("A: saving from Información advances to Documento, marks Información ✓, and shows a toast (no permanent duplicate banner)", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("template-guided-progression", "machote-a"),
      content: "ESCRITURA de prueba.",
    });

    await page.goto(`/dashboard/templates/${template.id}`);
    await expect(tab(page, "Información")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await page
      .getByLabel("Descripción (opcional)")
      .fill("Descripción del flujo guiado");
    await page
      .getByRole("button", { name: "Guardar y continuar" })
      .click();

    // El guardado avanza automáticamente al siguiente paso del orden fijo.
    await expect(tab(page, "Documento")).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 15_000 },
    );

    // El toast se autodescarta a los 3.5s — verificarlo antes que cualquier
    // otra cosa. Confirmación transitoria (role="status" fijo al fondo de
    // la pantalla), no un banner inline permanente — solo debe existir una
    // instancia del texto en toda la página, dentro del toast.
    await expect(
      page.getByText("Machote guardado.", { exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible();

    await expect(
      tab(page, "Información").getByText("✓", { exact: true }),
    ).toBeVisible();
  });

  test("B: a validation error on save does not advance the step nor mark it complete", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("template-guided-progression", "machote-b"),
      content: "ESCRITURA de prueba.",
    });

    await page.goto(`/dashboard/templates/${template.id}`);
    await expect(tab(page, "Información")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Vacía el campo obligatorio "Nombre del machote" — la validación
    // nativa del navegador (`required`) bloquea el envío del formulario
    // antes de que exista una respuesta del servidor que procesar.
    const nameInput = page.getByLabel("Nombre del machote");
    await nameInput.fill("");
    await page.getByRole("button", { name: "Guardar y continuar" }).click();

    // Nada avanzó: seguimos en "Información", sin marca de completo, y el
    // campo sigue inválido según el navegador.
    await expect(tab(page, "Información")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      tab(page, "Información").getByText("✓", { exact: true }),
    ).toHaveCount(0);
    await expect(
      await nameInput.evaluate((el: HTMLInputElement) => el.validity.valid),
    ).toBe(false);
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toHaveCount(0);
  });

  test("C: manual back-navigation still works after auto-advancing forward, and re-saving advances again", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("template-guided-progression", "machote-c"),
      content: "ESCRITURA de prueba.",
    });

    await page.goto(`/dashboard/templates/${template.id}`);

    // Primer guardado: Información → Documento.
    await page
      .getByLabel("Descripción (opcional)")
      .fill("Primera descripción");
    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(tab(page, "Documento")).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 15_000 },
    );

    // Navegación manual hacia atrás — el auto-avance no vuelve esto un
    // asistente de un solo sentido.
    await goToTab(page, "Información");
    await expect(page.getByLabel("Descripción (opcional)")).toHaveValue(
      "Primera descripción",
    );

    await page
      .getByLabel("Descripción (opcional)")
      .fill("Segunda descripción, tras volver manualmente");
    await page.getByRole("button", { name: "Guardar y continuar" }).click();

    // Vuelve a avanzar automáticamente, de nuevo a Documento.
    await expect(tab(page, "Documento")).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 15_000 },
    );

    await goToTab(page, "Información");
    await expect(page.getByLabel("Descripción (opcional)")).toHaveValue(
      "Segunda descripción, tras volver manualmente",
    );
  });
});
