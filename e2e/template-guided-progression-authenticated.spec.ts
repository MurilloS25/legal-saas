import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestTemplate,
  runCleanup,
  uniqueName,
} from "./support/factories";

/**
 * Guardado único en Machotes (iteración 4): un solo botón "Guardar"
 * persiste Información/Documento/Variables/Índice juntos; navegar entre
 * pasos del stepper es libre y nunca requiere guardar antes ni avanza como
 * efecto colateral de guardar — reemplaza el antiguo patrón "Guardar y
 * continuar" (auto-avance por paso), retirado explícitamente en esta
 * iteración. Complementa (no duplica) `template-stepper-create-authenticated.spec.ts`,
 * que cubre el primer guardado en modo creación.
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

  test("A: saving from Información does not navigate away, shows a toast (no permanent duplicate banner), and marks Información complete", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("template-guided-progression", "machote-a"),
      content: "ESCRITURA de prueba.",
    });

    await page.goto(`/templates/${template.id}`);
    await expect(tab(page, "Información")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await page
      .getByLabel("Descripción (opcional)")
      .fill("Descripción del flujo guiado");
    await page.getByRole("button", { name: "Guardar" }).click();

    // Guardado único: no navega de paso — sigue en "Información".
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(tab(page, "Información")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // El toast se autodescarta a los 3.5s — verificarlo antes que cualquier
    // otra cosa. Confirmación transitoria (role="status" fijo al fondo de
    // la pantalla), no un banner inline permanente — solo debe existir una
    // instancia del texto en toda la página, dentro del toast.
    await expect(
      page.getByText("Machote guardado.", { exact: true }),
    ).toHaveCount(1);

    // El paso activo se marca "current" (no "✓") mientras se está en él —
    // el check solo se ve en un paso completo que YA NO es el actual, así
    // que hay que salir de "Información" para verlo.
    await goToTab(page, "Documento");
    await expect(
      tab(page, "Información").getByText("✓", { exact: true }),
    ).toBeVisible();
  });

  test("B: a validation error on save keeps the workspace dirty and does not mark the step complete", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("template-guided-progression", "machote-b"),
      content: "ESCRITURA de prueba.",
    });

    await page.goto(`/templates/${template.id}`);
    await expect(tab(page, "Información")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Vacía el campo obligatorio "Nombre del machote" — la validación
    // nativa del navegador (`required`) bloquea el envío del formulario
    // antes de que exista una respuesta del servidor que procesar.
    const nameInput = page.getByLabel("Nombre del machote");
    await nameInput.fill("");
    await page.getByRole("button", { name: "Guardar" }).click();

    // Nada se guardó: sin marca de completo, el campo sigue inválido según
    // el navegador, y el estado global sigue "Sin guardar".
    await expect(
      tab(page, "Información").getByText("✓", { exact: true }),
    ).toHaveCount(0);
    await expect(
      await nameInput.evaluate((el: HTMLInputElement) => el.validity.valid),
    ).toBe(false);
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.locator('p[role="status"]').filter({ hasText: "Sin guardar" }),
    ).toBeVisible();
  });

  test("C: navigating between steps never requires saving first, and edits made before saving survive both directions", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("template-guided-progression", "machote-c"),
      content: "ESCRITURA de prueba.",
    });

    await page.goto(`/templates/${template.id}`);

    // Edita Información sin guardar y navega a Documento — el cambio local
    // no se pierde ni exige guardar antes de moverse.
    await page
      .getByLabel("Descripción (opcional)")
      .fill("Primera descripción");
    await goToTab(page, "Documento");
    await expect(
      page.locator('p[role="status"]').filter({ hasText: "Sin guardar" }),
    ).toBeVisible();

    await goToTab(page, "Información");
    await expect(page.getByLabel("Descripción (opcional)")).toHaveValue(
      "Primera descripción",
    );

    // Un guardado real persiste el cambio y limpia el dirty — sigue en
    // "Información" (guardar no navega).
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(tab(page, "Información")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Segunda edición, navegación manual de ida y vuelta, y un segundo
    // guardado — el patrón se repite sin depender de ningún avance
    // automático.
    await page
      .getByLabel("Descripción (opcional)")
      .fill("Segunda descripción, tras volver manualmente");
    await goToTab(page, "Documento");
    await goToTab(page, "Información");
    await expect(page.getByLabel("Descripción (opcional)")).toHaveValue(
      "Segunda descripción, tras volver manualmente",
    );
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByLabel("Descripción (opcional)")).toHaveValue(
      "Segunda descripción, tras volver manualmente",
    );
  });
});
