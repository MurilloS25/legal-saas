import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
  createTestTemplate,
  createTestTemplateField,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";

/**
 * Escritura nueva: el stepper (Completar / Revisar / Cobro / Finalizar /
 * Índice) es la vista principal desde `/dashboard/documents/new/[templateId]`
 * — no hay un flujo alternativo de una sola página para creación. "Completar"
 * y "Revisar" operan sobre estado local y ya son completamente funcionales
 * antes de guardar; "Cobro" y "Finalizar" requieren que la escritura exista
 * (quedan bloqueados hasta el primer guardado); "Índice" además requiere
 * finalización. El primer guardado redirige a la URL de edición preservando
 * el paso activo, sin perder ningún dato ya ingresado (título, cliente
 * principal, valores de variables).
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const templateName = uniqueName("document-stepper-create", "machote");
const fieldKey = "buyer_1.full_name";
const fieldLabel = "Comprador 1 - Nombre completo";

function stepper(page: Page) {
  return page.getByRole("navigation", { name: "Pasos de la escritura" });
}

/** Paso "Revisar" — vista de solo lectura, con su propio encabezado. */
function reviewHeading(page: Page) {
  return page.getByRole("heading", { name: "Revisión del documento" });
}

/**
 * Contenedor del paso "Revisar" — acota las búsquedas de contenido ahí, ya
 * que la misma variable renderizada aparece también (oculta) en el panel
 * "Completar" editable y en `ExpandableDocumentPanel`.
 */
function revisarPanel(page: Page) {
  return page.locator("#document-panel-revisar");
}

/** Hoja documental editable — solo existe en el paso "Completar". */
function documentRegion(page: Page) {
  return page.getByRole("region", { name: "Documento", exact: true });
}

async function goToStep(
  page: Page,
  name: "Completar" | "Revisar" | "Cobro" | "Finalizar" | "Índice",
) {
  await stepper(page).getByRole("tab", { name, exact: true }).click();
}

/** Llena una variable requerida directamente en la hoja documental. */
async function fillFieldLive(page: Page, key: string, value: string) {
  await expect(async () => {
    await documentRegion(page)
      .locator(`[data-variable-key="${key}"]`)
      .first()
      .click();
    const input = documentRegion(page).locator(
      `input[data-variable-key="${key}"]`,
    );
    await input.fill(value);
    await input.blur();
    await expect(
      documentRegion(page).getByText(value).first(),
    ).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

test.describe("escritura nueva: stepper visible desde la creación", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "document-stepper-create");
  });

  test("A: seed a template with one field via factories", async ({ page }) => {
    const template = await createTestTemplate(registry, {
      name: templateName,
      content:
        "ESCRITURA DE PRUEBA. Comparece {{buyer_1.full_name}}, placa {{vehicle.plate}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: fieldKey,
      label: fieldLabel,
      required: true,
    });
    await page.goto("/dashboard/documents/new");
    await expect(
      page.locator("li").filter({ hasText: templateName }),
    ).toBeVisible();
  });

  test("B: stepper completo desde la creación, pasos que requieren persistencia bloqueados y no navegables, Cliente principal funcional antes de guardar, navegación entre pasos preserva estado, y el guardado redirige preservando el paso activo", async ({
    page,
  }) => {
    const clientName = uniqueName("document-stepper-create", "cliente");
    const client = await createTestClient(registry, {
      full_name: clientName,
    });
    const title = uniqueName("document-stepper-create", "escritura-b");

    await page.goto("/dashboard/documents/new");
    await page
      .locator("li")
      .filter({ hasText: templateName })
      .getByRole("link", { name: "Usar este machote" })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/new\/[^/]+$/, {
      timeout: 15_000,
    });

    // Los 5 pasos son visibles desde el inicio — no hay pantalla previa de
    // una sola página.
    await expect(
      stepper(page).getByRole("tab", { name: "Completar", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      stepper(page).getByRole("tab", { name: "Revisar", exact: true }),
    ).toBeVisible();
    const cobroTab = stepper(page).getByRole("tab", {
      name: "Cobro",
      exact: true,
    });
    const finalizarTab = stepper(page).getByRole("tab", {
      name: "Finalizar",
      exact: true,
    });
    const indiceTab = stepper(page).getByRole("tab", {
      name: "Índice",
      exact: true,
    });

    // Cobro, Finalizar e Índice están bloqueados antes del primer guardado
    // — no solo por color: disabled + aria-disabled + title explican por
    // qué.
    for (const tab of [cobroTab, finalizarTab, indiceTab]) {
      await expect(tab).toBeDisabled();
      await expect(tab).toHaveAttribute("aria-disabled", "true");
      await expect(tab).toHaveAttribute(
        "title",
        "Disponible después de guardar la escritura por primera vez.",
      );
    }

    // Título y Cliente principal, en Completar.
    await page.getByLabel("Título de la escritura").fill(title);
    await page
      .getByRole("button", { name: /^Cliente principal/ })
      .click();
    await page
      .getByLabel("Cliente principal", { exact: true })
      .selectOption(client.id);
    await expect(
      page.getByRole("button", {
        name: new RegExp(`^Cliente principal: ${clientName}`),
      }),
    ).toBeVisible();
    // Cerrar el popover — sigue abierto tras seleccionar, y taparía la hoja
    // documental para el siguiente paso.
    await page.keyboard.press("Escape");

    // Campo requerido del machote — sin esto el guardado queda bloqueado
    // por validación.
    await fillFieldLive(page, fieldKey, "Cliente de Prueba Uno");

    // Revisar: vista de solo lectura, accesible antes de guardar.
    await goToStep(page, "Revisar");
    await expect(reviewHeading(page)).toBeVisible();

    // Clic en un paso bloqueado no navega a ningún lado ni descarta nada.
    await cobroTab.click({ force: true });
    await expect(
      stepper(page).getByRole("tab", { name: "Revisar", exact: true }),
    ).toHaveAttribute("aria-selected", "true");

    // Volver a Completar: el título y el cliente principal no se perdieron
    // al navegar entre pasos.
    await goToStep(page, "Completar");
    await expect(page.getByLabel("Título de la escritura")).toHaveValue(
      title,
    );
    await expect(
      page.getByRole("button", {
        name: new RegExp(`^Cliente principal: ${clientName}`),
      }),
    ).toBeVisible();

    // Guardar desde Completar (paso activo al guardar).
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    // El `?saved=1` es efímero — el propio compositor lo limpia de la URL
    // apenas monta el banner de hito, así que solo se afirma el id
    // persistido, no ese query param.
    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/?]+/, {
      timeout: 30_000,
    });
    // Registrar solo tras confirmar el redirect — antes de eso la fila
    // podría no estar comprometida todavía, y el lookup por título fallaría.
    await registerCreatedViaUi(registry, "documents", "title", title);

    // El paso activo (Completar) se preserva tras el redirect create → edit
    // — se siente como continuación del mismo stepper, no un cambio de
    // pantalla. Los datos ingresados siguen ahí.
    await expect(
      stepper(page).getByRole("tab", { name: "Completar", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Título de la escritura")).toHaveValue(
      title,
    );
    await expect(
      page.getByRole("button", {
        name: new RegExp(`^Cliente principal: ${clientName}`),
      }),
    ).toBeVisible();

    // Cobro y Finalizar quedan habilitados; Índice sigue bloqueado porque
    // requiere además que la escritura esté finalizada.
    await expect(cobroTab).not.toBeDisabled();
    await expect(finalizarTab).not.toBeDisabled();
    await expect(indiceTab).toBeDisabled();
    await expect(indiceTab).toHaveAttribute(
      "title",
      "Disponible después de finalizar la escritura.",
    );

    await cobroTab.click();
    await expect(
      page.getByRole("region", { name: "Cuentas por cobrar de la escritura" }),
    ).toBeVisible();
  });

  // Nota: a diferencia de Machotes (donde "Publicar" expone su propio botón
  // de guardado independiente del paso activo), en Escrituras "Guardar
  // cambios" solo existe dentro del panel "Completar" — Revisar no tiene un
  // control de guardado propio, así que "guardar desde un paso distinto"
  // no es un flujo real aquí. Este test cubre en su lugar el otro riesgo
  // real: visitar Revisar antes del primer guardado no descarta el título
  // ni el valor de la variable, y tras guardar desde Completar, Revisar
  // refleja el contenido persistido.
  test("C: visitar Revisar antes de guardar no descarta los datos, y tras guardar desde Completar, Revisar refleja el contenido persistido", async ({
    page,
  }) => {
    const title = uniqueName("document-stepper-create", "escritura-c");

    await page.goto("/dashboard/documents/new");
    await page
      .locator("li")
      .filter({ hasText: templateName })
      .getByRole("link", { name: "Usar este machote" })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/new\/[^/]+$/, {
      timeout: 15_000,
    });

    await page.getByLabel("Título de la escritura").fill(title);
    await fillFieldLive(page, fieldKey, "Cliente de Prueba Dos");

    // Visitar Revisar antes de guardar no descarta nada.
    await goToStep(page, "Revisar");
    await expect(reviewHeading(page)).toBeVisible();
    await expect(
      revisarPanel(page).getByText(/Cliente de Prueba Dos/).first(),
    ).toBeVisible();

    await goToStep(page, "Completar");
    await expect(page.getByLabel("Título de la escritura")).toHaveValue(
      title,
    );

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/?]+/, {
      timeout: 30_000,
    });
    await registerCreatedViaUi(registry, "documents", "title", title);

    // Revisar, ya persistida, sigue mostrando el contenido real.
    await goToStep(page, "Revisar");
    await expect(reviewHeading(page)).toBeVisible();
    await expect(
      revisarPanel(page).getByText(/Cliente de Prueba Dos/).first(),
    ).toBeVisible();
  });
});
