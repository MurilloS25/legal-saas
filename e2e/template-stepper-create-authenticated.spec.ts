import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";

/**
 * Machote nuevo: el stepper (Información / Documento / Variables / Índice /
 * Publicar) es la vista principal desde `/dashboard/templates/new` — no hay
 * un flujo alternativo de una sola página para creación. Solo "Índice" está
 * bloqueado antes del primer guardado (depende de `template_id`); el resto
 * de los pasos opera sobre estado local y ya es completamente funcional. El
 * primer guardado redirige a la URL de edición preservando el paso activo,
 * y desbloquea "Índice" sin perder ningún dato ya ingresado.
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

function contentEditor(page: Page) {
  return page.getByRole("textbox", { name: "Contenido del machote" });
}

function variablesRegion(page: Page) {
  return page.getByRole("region", { name: "Variables del machote" });
}

function indexTab(page: Page) {
  return page.getByRole("tab", { name: "Índice", exact: true });
}

async function goToTab(
  page: Page,
  name: "Información" | "Documento" | "Variables" | "Índice" | "Publicar",
) {
  await page.getByRole("tab", { name, exact: true }).click();
}

test.describe("machote nuevo: stepper visible desde la creación", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "template-stepper-create");
  });

  test("A: stepper completo desde /new, Índice bloqueado y no navegable, navegación entre pasos preserva estado, y 'Ayuda para crear con IA' funciona antes de guardar", async ({
    page,
  }) => {
    const name = uniqueName("template-stepper-create", "machote-a");

    await page.goto("/dashboard/templates/new");

    // Los 5 pasos son visibles desde el inicio — no hay pantalla previa
    // de una sola página.
    await expect(
      page.getByRole("tab", { name: "Información", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Documento", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Variables", exact: true }),
    ).toBeVisible();
    await expect(indexTab(page)).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Publicar", exact: true }),
    ).toBeVisible();

    // Índice está claramente bloqueado (no solo por color: disabled +
    // aria-disabled + title explican por qué).
    await expect(indexTab(page)).toBeDisabled();
    await expect(indexTab(page)).toHaveAttribute("aria-disabled", "true");
    await expect(indexTab(page)).toHaveAttribute(
      "title",
      "Disponible después de guardar el machote por primera vez.",
    );

    // Clic en el paso bloqueado no navega a ningún lado ni descarta nada.
    await goToTab(page, "Información");
    await page.getByLabel("Nombre del machote").fill(name);
    await indexTab(page).click({ force: true });
    await expect(
      page.getByRole("tab", { name: "Información", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Nombre del machote")).toHaveValue(name);

    // Documento: editor funcional + "Ayuda para crear con IA" disponible
    // antes de guardar (no depende de que el machote ya exista).
    await goToTab(page, "Documento");
    await contentEditor(page).click();
    await page.keyboard.type("Contenido de la escritura de prueba.");
    await page
      .getByRole("button", { name: "Ayuda para crear con IA" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Crea tu machote con ayuda de IA" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // Variables accesible como su propio paso, sin necesitar el machote
    // guardado.
    await goToTab(page, "Variables");
    await expect(variablesRegion(page)).toBeVisible();

    // Volver a Información: el nombre no se perdió al navegar.
    await goToTab(page, "Información");
    await expect(page.getByLabel("Nombre del machote")).toHaveValue(name);

    // Guardar desde Documento (paso activo al guardar).
    await goToTab(page, "Documento");
    await expect(contentEditor(page)).toContainText(
      "Contenido de la escritura de prueba.",
    );
    await page.getByRole("button", { name: "Crear machote" }).click();
    await registerCreatedViaUi(registry, "templates", "name", name);

    // El `?created=1` es efímero — el propio workspace lo limpia de la URL
    // apenas monta el banner de hito (ver `template-milestone-feedback`),
    // así que solo se afirma el id persistido, no ese query param.
    await expect(page).toHaveURL(/\/dashboard\/templates\/(?!new)[^/?]+/, {
      timeout: 30_000,
    });

    // El paso activo (Documento) se preserva tras el redirect create → edit
    // — se siente como continuación del mismo stepper, no un cambio de
    // pantalla.
    await expect(
      page.getByRole("tab", { name: "Documento", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(contentEditor(page)).toContainText(
      "Contenido de la escritura de prueba.",
    );

    // Índice queda habilitado, sin haber perdido ningún dato.
    await expect(indexTab(page)).not.toBeDisabled();
    await indexTab(page).click();
    await expect(
      page.getByRole("region", { name: "Configuración del índice notarial" }),
    ).toBeVisible();

    // El nombre tampoco se perdió.
    await goToTab(page, "Información");
    await expect(page.getByLabel("Nombre del machote")).toHaveValue(name);
  });

  test("B: guardar desde un paso distinto de Documento (Variables) continúa en ese mismo paso después del redirect", async ({
    page,
  }) => {
    const name = uniqueName("template-stepper-create", "machote-b");

    await page.goto("/dashboard/templates/new");
    await goToTab(page, "Información");
    await page.getByLabel("Nombre del machote").fill(name);
    await goToTab(page, "Documento");
    await contentEditor(page).click();
    await page.keyboard.type("Texto de prueba para el paso B.");

    // Guardar desde Variables, no desde Documento.
    await goToTab(page, "Variables");
    await page.getByRole("button", { name: "Crear machote" }).click();
    await registerCreatedViaUi(registry, "templates", "name", name);

    // El `?created=1` se limpia solo (ver comentario en el test A) — lo
    // que importa aquí es que `section=variables` sí sobrevive.
    await expect(page).toHaveURL(
      /\/dashboard\/templates\/(?!new)[^/?]+\?.*section=variables/,
      { timeout: 30_000 },
    );
    await expect(
      page.getByRole("tab", { name: "Variables", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(variablesRegion(page)).toBeVisible();

    // El contenido escrito en Documento tampoco se perdió, aunque no era
    // el paso activo al guardar.
    await goToTab(page, "Documento");
    await expect(contentEditor(page)).toContainText(
      "Texto de prueba para el paso B.",
    );
  });
});
