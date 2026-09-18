import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";

/**
 * Machote nuevo: el stepper (Información / Documento / Variables / Índice /
 * Publicar) es la vista principal desde `/templates/new` — no hay
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

    await page.goto("/templates/new");

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
    await expect(page).toHaveURL(/\/templates\/(?!new)[^/?]+/, {
      timeout: 30_000,
    });

    // El redirect create → edit ya no preserva el paso activo: avanza al
    // siguiente paso del orden fijo (Documento → Variables), y Documento
    // pasa a mostrarse como completado (✓) en vez de seguir activo —
    // `savedOnceValid.document` se vuelve `true` con cualquier guardado
    // exitoso, sin importar desde qué paso se guardó.
    await expect(
      page.getByRole("tab", { name: "Variables", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page
        .getByRole("tab", { name: "Documento", exact: true })
        .getByText("✓", { exact: true }),
    ).toBeVisible();

    // El contenido escrito en Documento tampoco se perdió, aunque ya no es
    // el paso activo tras el redirect.
    await goToTab(page, "Documento");
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

  test("B: guardar desde Variables avanza al siguiente paso (Índice) tras el redirect, con Variables marcado como completo", async ({
    page,
  }) => {
    const name = uniqueName("template-stepper-create", "machote-b");

    await page.goto("/templates/new");
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
    // que importa aquí es que `section=notarial` sí sobrevive: el redirect
    // ya no preserva el paso activo, avanza uno (Variables → Índice) según
    // el orden fijo del stepper.
    await expect(page).toHaveURL(
      /\/templates\/(?!new)[^/?]+\?.*section=notarial/,
      { timeout: 30_000 },
    );
    await expect(indexTab(page)).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("region", { name: "Configuración del índice notarial" }),
    ).toBeVisible();
    // Nota: no se afirma un ✓ en "Variables" aquí — este test no inserta
    // ninguna variable en el documento, así que `variablesComplete` es
    // `false` por diseño (ver comentario en `TemplateWorkspace.tsx`: un
    // machote sin variables detectadas no cuenta como "revisado").

    // El contenido escrito en Documento tampoco se perdió, aunque no era
    // el paso activo al guardar.
    await goToTab(page, "Documento");
    await expect(contentEditor(page)).toContainText(
      "Texto de prueba para el paso B.",
    );
  });

  test("C: /new abre en Información por defecto, sin encabezado duplicado", async ({
    page,
  }) => {
    await page.goto("/templates/new");

    // "Información" es el primer paso definido — sin clic previo, ya debe
    // estar seleccionado.
    await expect(
      page.getByRole("tab", { name: "Información", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Nombre del machote")).toBeVisible();

    // Un solo encabezado/breadcrumb: el propio stepper de
    // `TemplateWorkspaceHeader`, no una jerarquía duplicada por encima.
    await expect(
      page.getByRole("link", { name: "‹ Machotes", exact: true }),
    ).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test("D: Variables no muestra un check de completado falso en un machote vacío; sí lo muestra tras configurar una variable real", async ({
    page,
  }) => {
    const name = uniqueName("template-stepper-create", "machote-d");
    const variableLabel = "Parte única";
    const variableKey = "parte.unica";

    await page.goto("/templates/new");
    await goToTab(page, "Información");
    await page.getByLabel("Nombre del machote").fill(name);

    const variablesTab = page.getByRole("tab", {
      name: "Variables",
      exact: true,
    });
    // Recién creado, sin ninguna variable detectada: no hay nada que
    // evaluar todavía — el paso no debe mostrar el check de "completo".
    await expect(variablesTab.getByText("✓", { exact: true })).toHaveCount(0);

    await goToTab(page, "Documento");
    await contentEditor(page).click();
    await page.keyboard.type("Comparece ");
    await page.getByRole("button", { name: "Insertar variable" }).click();
    const dialog = page.getByRole("dialog", { name: "Insertar variable" });
    await dialog.getByLabel("Etiqueta").fill(variableLabel);
    await dialog.getByLabel("Clave").fill(variableKey);
    await dialog.getByRole("button", { name: "Insertar variable" }).click();
    await expect(dialog).not.toBeVisible();

    // La variable ya está "Configurada" localmente (el diálogo la deja así
    // de inmediato), pero el check de completitud del stepper exige además
    // un guardado exitoso confirmado (`savedOnceValid` en
    // `TemplateWorkspace.tsx`) — antes de guardar, el paso no debe mostrar
    // ✓ todavía, aunque los datos locales ya cumplan la condición.
    await expect(variablesTab.getByText("✓", { exact: true })).toHaveCount(0);

    // Guardar desde "Documento" (paso activo) avanza a "Variables" — el
    // mismo guardado que confirma la completitud recién comprobada.
    await page.getByRole("button", { name: "Crear machote" }).click();
    await expect(page).toHaveURL(
      /\/templates\/(?!new)[^/?]+\?.*section=variables/,
      { timeout: 30_000 },
    );
    await registerCreatedViaUi(registry, "templates", "name", name);

    await expect(variablesTab).toHaveAttribute("aria-selected", "true");

    const variableRow = variablesRegion(page)
      .locator("li")
      .filter({ hasText: variableKey });
    await expect(variableRow.getByText("Configurada")).toBeVisible();

    // El paso activo nunca muestra ✓ (su estado es "current", no
    // "complete" — ver `TemplateWorkspaceHeader.tsx`): hay que salir de
    // "Variables" para comprobar que, ya no activo, sí refleja
    // completitud real con la variable configurada y el guardado
    // confirmado.
    await goToTab(page, "Información");
    await expect(variablesTab.getByText("✓", { exact: true })).toBeVisible();
  });
});
