import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestTemplate,
  createTestTemplateField,
  runCleanup,
  uniqueName,
} from "./support/factories";

/**
 * Iteración 4 (ajustes adicionales sobre PR #196):
 *
 * 1. La barra de Guardar del workspace de Machotes es ahora `sticky
 *    bottom-0` y vive DENTRO del mismo `<form>` que los cinco pasos
 *    (incluido Índice) — antes vivía fuera del `<form>`, así que en
 *    Índice "flotaba" cerca del principio de la página en vez de quedar
 *    anclada al fondo del contenido real de ese paso.
 * 2. Partes (dentro de la configuración del Índice del machote) pasó de
 *    un checkbox ambiguo ("confirmo que no requiere Partes", solo visible
 *    cuando la selección ya estaba vacía) a un control tri-estado
 *    explícito: Pendiente de definir / Requiere partes / No requiere
 *    partes — soportado por una migración que permite guardar "Pendiente"
 *    (antes el RPC lo rechazaba con `empty_index_fields_not_confirmed`).
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

function configurationSection(page: Page) {
  return page.getByRole("region", { name: "Configuración del índice notarial" });
}

function saveButton(page: Page) {
  return page.getByRole("button", { name: "Guardar" });
}

function saveStatus(page: Page) {
  return page.locator('form p[role="status"]');
}

async function openConfigIndexRow(page: Page, key: string) {
  await page.locator(`#idx-${key}-trigger`).click();
}

function summaryCount(page: Page, label: "configurados" | "pendientes") {
  return configurationSection(page).locator(
    `xpath=.//p[normalize-space(text())="${label}"]/preceding-sibling::p[1]`,
  );
}

async function goToTab(
  page: Page,
  name: "Información" | "Documento" | "Variables" | "Índice" | "Publicar",
) {
  await page.getByRole("tab", { name, exact: true }).click();
}

test.describe("template workspace: sticky save bar and Partes tri-state", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "template-sticky-parties");
  });

  test("A/B: Guardar stays reachable in the viewport on both a short step (Variables) and a long one (Índice), without scrolling first", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("template-sticky-parties", "machote-ab"),
      content:
        "ESCRITURA. Comparecen {{comprador.nombre}} y {{vendedor.nombre}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "comprador.nombre",
      label: "Comprador",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "vendedor.nombre",
      label: "Vendedor",
    });

    await page.goto(`/dashboard/templates/${template.id}?section=variables`);
    await expect(saveButton(page)).toBeInViewport();

    // Índice es una sección considerablemente más larga (seis campos
    // simples colapsables + Partes) — antes del fix, la barra de Guardar
    // vivía fuera del <form> y quedaba cerca del principio de la página
    // mientras se veía este paso, no anclada al fondo real del contenido.
    await goToTab(page, "Índice");
    await expect(configurationSection(page)).toBeVisible();
    await expect(saveButton(page)).toBeInViewport();
  });

  test("C: the save status keeps updating (dirty/guardando/guardado) while the sticky bar stays in place", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("template-sticky-parties", "machote-c"),
      content: "ESCRITURA de prueba.",
    });

    await page.goto(`/dashboard/templates/${template.id}`);
    await expect(saveStatus(page)).toHaveText("Guardado");
    await page.getByLabel("Descripción (opcional)").fill("Cambio de prueba");
    await expect(saveStatus(page)).toHaveText("Cambios sin guardar");
    await expect(saveButton(page)).toBeInViewport();

    await saveButton(page).click();
    await expect(saveStatus(page)).toHaveText("Guardado", { timeout: 15_000 });
  });

  test("D: the sticky save bar does not clip content on a mobile viewport", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("template-sticky-parties", "machote-d"),
      content: "ESCRITURA de prueba.",
    });

    await page.setViewportSize({ width: 390, height: 720 });
    await page.goto(`/dashboard/templates/${template.id}?section=notarial`);
    await expect(configurationSection(page)).toBeVisible();
    await expect(saveButton(page)).toBeInViewport();

    // Un cambio real habilita el botón — y sigue siendo clicable (no queda
    // tapado por otro elemento encima) en el viewport móvil. El toggle de
    // inclusión vive en el propio paso Índice (a diferencia de
    // Descripción, que está en Información — oculto por CSS en este
    // paso).
    await configurationSection(page).getByLabel("Incluir en Índice Notarial").click();
    await expect(saveButton(page)).toBeEnabled();
    await expect(saveButton(page)).toBeInViewport();
  });

  test("E/F: Partes can stay Pendiente, and a machote with Partes pending still saves normally", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("template-sticky-parties", "machote-ef"),
      content: "ESCRITURA. Comparece {{parte.nombre}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "parte.nombre",
      label: "Parte",
    });

    await page.goto(`/dashboard/templates/${template.id}?section=notarial`);
    const section = configurationSection(page);
    await openConfigIndexRow(page, "parties");
    await expect(
      section.getByRole("radio", { name: "Pendiente de definir" }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(
      section.getByText(/Aún no has decidido si este machote necesita Partes/),
    ).toBeVisible();

    // Pendiente no bloquea guardar el resto del machote. "Descripción"
    // vive en el paso Información (oculto por CSS mientras se ve Índice) —
    // hay que cambiar de paso para poder escribir ahí.
    await page.getByRole("tab", { name: "Información", exact: true }).click();
    await page.getByLabel("Descripción (opcional)").fill("Con Partes pendiente");
    await saveButton(page).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("G/H/I: choosing Requiere partes reveals the mapping UI, stays Pendiente while incomplete, and becomes Configurado once mapped", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("template-sticky-parties", "machote-ghi"),
      content: "ESCRITURA. Comparece {{parte.nombre}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "parte.nombre",
      label: "Parte",
    });

    await page.goto(`/dashboard/templates/${template.id}?section=notarial`);
    const section = configurationSection(page);
    await openConfigIndexRow(page, "parties");

    await section
      .getByRole("radio", { name: "Requiere partes", exact: true })
      .click();
    await expect(
      section.getByLabel("Buscar variable para Partes"),
    ).toBeVisible();
    // Elegido pero sin ninguna variable mapeada todavía: sigue pendiente.
    await expect(
      section.locator("#idx-parties-trigger"),
    ).toContainText("Pendiente");

    await section.getByRole("checkbox", { name: /Parte/ }).check();
    await expect(
      section.locator("#idx-parties-trigger"),
    ).toContainText("Configurado");
  });

  test("J/K: No requiere partes is Configurado without any mapping, and changing the Partes state marks the workspace dirty", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("template-sticky-parties", "machote-jk"),
      content: "ESCRITURA de prueba.",
    });

    await page.goto(`/dashboard/templates/${template.id}?section=notarial`);
    const section = configurationSection(page);
    await openConfigIndexRow(page, "parties");
    await expect(saveStatus(page)).toHaveText("Guardado");

    await section.getByRole("radio", { name: "No requiere partes" }).click();
    await expect(saveStatus(page)).toHaveText("Cambios sin guardar");
    // "No requiere partes" usa el badge "Confirmado" (no "Configurado") —
    // mismo texto que ya usaba esta fila para el estado "optional" antes
    // del tri-estado explícito (ver CollapsibleFieldRow/statusLabel).
    await expect(
      section.locator("#idx-parties-trigger"),
    ).toContainText("Confirmado");
    await expect(
      section.getByText("Este Machote no necesita generar automáticamente"),
    ).toBeVisible();
  });

  test("L/M: saving a Partes decision persists across reload, and the configured/pending counters reflect the tri-state", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("template-sticky-parties", "machote-lm"),
      content: "ESCRITURA de prueba.",
    });

    await page.goto(`/dashboard/templates/${template.id}?section=notarial`);
    const section = configurationSection(page);
    await openConfigIndexRow(page, "parties");

    // Antes de decidir Partes: 0 configurados / 7 pendientes (6 campos
    // simples + Partes).
    await expect(summaryCount(page, "configurados")).toHaveText("0");
    await expect(summaryCount(page, "pendientes")).toHaveText("7");

    await section.getByRole("radio", { name: "No requiere partes" }).click();
    // "No requiere partes" cuenta como configurado: 1 configurado / 6
    // pendientes.
    await expect(summaryCount(page, "configurados")).toHaveText("1");
    await expect(summaryCount(page, "pendientes")).toHaveText("6");

    await saveButton(page).click();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(configurationSection(page)).toBeVisible();
    await openConfigIndexRow(page, "parties");
    await expect(
      section.getByRole("radio", { name: "No requiere partes" }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(
      section.locator("#idx-parties-trigger"),
    ).toContainText("Confirmado");
  });
});
