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
import { restDelete, restSelect } from "./support/supabase-admin";

/**
 * Escritura nueva: el stepper de 4 pasos (Completar / Revisar y finalizar /
 * Cobro / Índice) es la vista principal desde
 * `/dashboard/documents/new/[templateId]` — no hay un flujo alternativo de
 * una sola página para creación, y la creación siempre arranca en
 * "Completar". "Completar" y la revisión dentro de "Revisar y finalizar"
 * operan sobre estado local y ya son completamente funcionales antes de
 * guardar; los controles de finalización (dentro de ese mismo paso) y
 * "Cobro" requieren que la Escritura ya exista (quedan bloqueados/con
 * aviso hasta el primer guardado); "Índice" además requiere finalización.
 * El primer guardado redirige a la URL de edición preservando el paso
 * activo, sin perder ningún dato ya ingresado (título, cliente principal,
 * valores de variables). "Cobro" es contextual: crear una cuenta o
 * registrar un pago ocurre en un modal, sin abandonar la Escritura — la
 * administración completa sigue viviendo en Cuentas por cobrar.
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

/** Paso "Revisar y finalizar" — vista de solo lectura, con su propio encabezado. */
function reviewHeading(page: Page) {
  return page.getByRole("heading", { name: "Revisión del documento" });
}

/**
 * Contenedor del paso "Revisar y finalizar" — acota las búsquedas de
 * contenido ahí, ya que la misma variable renderizada aparece también
 * (oculta) en el panel "Completar" editable y en `ExpandableDocumentPanel`.
 */
function revisarPanel(page: Page) {
  return page.locator("#document-panel-revisar");
}

/** Hoja documental editable — solo existe en el paso "Completar". */
function documentRegion(page: Page) {
  return page.getByRole("region", { name: "Documento", exact: true });
}

function cobroSection(page: Page) {
  return page.getByRole("region", {
    name: "Cuentas por cobrar de la escritura",
  });
}

async function goToStep(
  page: Page,
  name: "Completar" | "Revisar y finalizar" | "Cobro" | "Índice",
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

  test("B: creación arranca en Completar, muestra exactamente 4 pasos, pasos que requieren persistencia bloqueados/con aviso y no navegables, Cliente principal funcional antes de guardar, navegación entre pasos preserva estado, y el guardado redirige preservando el paso activo", async ({
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

    // Exactamente 4 pasos — "Finalizar" ya no es un paso independiente.
    await expect(stepper(page).getByRole("tab")).toHaveCount(4);
    await expect(
      stepper(page).getByRole("tab", { name: "Completar", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      stepper(page).getByRole("tab", {
        name: "Revisar y finalizar",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      stepper(page).getByRole("tab", { name: "Finalizar", exact: true }),
    ).toHaveCount(0);
    const cobroTab = stepper(page).getByRole("tab", {
      name: "Cobro",
      exact: true,
    });
    const indiceTab = stepper(page).getByRole("tab", {
      name: "Índice",
      exact: true,
    });

    // Cobro e Índice están bloqueados antes del primer guardado — no solo
    // por color: disabled + aria-disabled + title explican por qué.
    for (const tab of [cobroTab, indiceTab]) {
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

    // Revisar y finalizar: la revisión es accesible antes de guardar; la
    // finalización en sí (dentro del mismo paso) queda con aviso.
    await goToStep(page, "Revisar y finalizar");
    await expect(reviewHeading(page)).toBeVisible();
    await expect(
      revisarPanel(page).getByText(
        "Finalizar y descargar estarán disponibles después de guardar la escritura por primera vez.",
      ),
    ).toBeVisible();
    await expect(
      revisarPanel(page).getByRole("button", { name: "Finalizar escritura" }),
    ).toHaveCount(0);

    // Clic en un paso bloqueado no navega a ningún lado ni descarta nada.
    await cobroTab.click({ force: true });
    await expect(
      stepper(page).getByRole("tab", {
        name: "Revisar y finalizar",
        exact: true,
      }),
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
    await page.getByRole("button", { name: "Crear escritura" }).click();

    // El `?saved=1` es efímero — un efecto de montaje en `DocumentComposer`
    // lo limpia de la URL apenas dispara el toast de confirmación (el
    // primer guardado llega vía redirect del server action, no vía
    // `useActionState`), así que solo se afirma el id persistido, no ese
    // query param.
    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/?]+/, {
      timeout: 30_000,
    });
    await expect(
      page.getByRole("status").getByText("Escritura guardada.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page).not.toHaveURL(/saved=1/);
    // Registrar solo tras confirmar el redirect — antes de eso la fila
    // podría no estar comprometida todavía, y el lookup por título fallaría.
    await registerCreatedViaUi(registry, "documents", "title", title);

    // El guardado desde "Completar" ahora avanza al siguiente paso del
    // flujo guiado en vez de preservar el paso activo — Completar es
    // siempre el único paso alcanzable antes de guardar, y su "siguiente"
    // es siempre "Revisar y finalizar", así que el redirect del server
    // action aterriza ahí directamente (`&section=revisar`, hardcodeado en
    // `createDocumentDraftAction`).
    await expect(
      stepper(page).getByRole("tab", {
        name: "Revisar y finalizar",
        exact: true,
      }),
    ).toHaveAttribute("aria-selected", "true");
    // Completar ya muestra ✓ — el guardado que acaba de ocurrir fue exitoso
    // y el título quedó no vacío.
    await expect(
      stepper(page)
        .getByRole("tab", { name: "Completar", exact: true })
        .getByText("✓", { exact: true }),
    ).toBeVisible();

    // Los datos ingresados siguen ahí — hay que volver a "Completar" para
    // verlos, porque el paso activo tras el redirect ya no es ese panel.
    await goToStep(page, "Completar");
    await expect(page.getByLabel("Título de la escritura")).toHaveValue(
      title,
    );
    await expect(
      page.getByRole("button", {
        name: new RegExp(`^Cliente principal: ${clientName}`),
      }),
    ).toBeVisible();

    // El antiguo banner de hito ("Ir a Revisar") desapareció por completo —
    // el primer guardado en modo creación llega vía redirect, así que el
    // toast de confirmación se dispara al montar (no vía `useActionState`,
    // que arranca vacío en esta carga) y no queda como banner permanente.
    await expect(
      page.getByText(
        "Cuando completes los campos pendientes, continúa a Revisar para verificar la escritura antes de finalizarla o gestionar cobros.",
      ),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ir a Revisar" })).toHaveCount(0);

    // Cobro queda habilitado; Índice sigue bloqueado porque requiere
    // además que la escritura esté finalizada.
    await expect(cobroTab).not.toBeDisabled();
    await expect(indiceTab).toBeDisabled();
    await expect(indiceTab).toHaveAttribute(
      "title",
      "Disponible después de finalizar la escritura.",
    );

    // Revisar y finalizar ahora expone los controles reales de finalización
    // (la escritura ya existe). Ya estamos en este paso desde el redirect
    // del guardado; esta navegación es un no-op idempotente que se deja
    // explícito para no depender de en qué paso nos dejó el bloque anterior.
    await goToStep(page, "Revisar y finalizar");
    await expect(
      revisarPanel(page).getByRole("button", { name: "Finalizar escritura" }),
    ).toBeVisible();
    await expect(
      revisarPanel(page).getByRole("button", { name: "Descargar Word" }),
    ).toBeVisible();

    // Cobro: paso contextual, todavía sin cuentas.
    await cobroTab.click();
    await expect(cobroSection(page)).toBeVisible();
    await expect(
      cobroSection(page).getByText(
        "Esta escritura todavía no tiene cuentas por cobrar.",
      ),
    ).toBeVisible();
    await expect(
      cobroSection(page).getByRole("button", {
        name: "Crear cuenta por cobrar",
      }),
    ).toBeVisible();
  });

  test("C: Cobro — crear una cuenta y registrar un pago ocurre en un modal, sin abandonar la Escritura; cancelar el modal de creación conserva el contexto", async ({
    page,
  }) => {
    const clientName = uniqueName("document-stepper-create", "cliente-cobro");
    const client = await createTestClient(registry, {
      full_name: clientName,
    });
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
    await page.getByRole("button", { name: /^Cliente principal/ }).click();
    await page
      .getByLabel("Cliente principal", { exact: true })
      .selectOption(client.id);
    await page.keyboard.press("Escape");
    await fillFieldLive(page, fieldKey, "Cliente de Prueba Cobro");

    await page.getByRole("button", { name: "Crear escritura" }).click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/?]+/, {
      timeout: 30_000,
    });
    await registerCreatedViaUi(registry, "documents", "title", title);
    const documentUrl = new URL(page.url());

    // El guardado ya aterrizó en "Revisar y finalizar" (ver test B), pero la
    // navegación manual a un paso desbloqueado es independiente de cuál sea
    // el paso activo — funciona igual desde aquí.
    await goToStep(page, "Cobro");
    await expect(cobroSection(page)).toBeVisible();
    const cobroUrl = new URL(page.url());

    // Cancelar el modal de creación no crea nada y conserva el contexto
    // (mismo paso Cobro — con su ?section=cobro propio, distinto de la URL
    // base capturada antes de navegar al paso — mismo estado vacío).
    await cobroSection(page)
      .getByRole("button", { name: "Crear cuenta por cobrar" })
      .click();
    const createDialog = page.getByRole("dialog", {
      name: "Crear cuenta por cobrar",
    });
    await expect(createDialog).toBeVisible();
    await createDialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(createDialog).toBeHidden();
    await expect(page).toHaveURL(cobroUrl.toString());
    await expect(
      cobroSection(page).getByText(
        "Esta escritura todavía no tiene cuentas por cobrar.",
      ),
    ).toBeVisible();

    // Crear la cuenta de verdad: el modal reutiliza el formulario real,
    // preasocia esta Escritura y a su Cliente principal, y guarda sin
    // navegar fuera de la Escritura.
    await cobroSection(page)
      .getByRole("button", { name: "Crear cuenta por cobrar" })
      .click();
    await expect(createDialog).toBeVisible();
    await expect(
      createDialog.getByLabel("Cliente", { exact: true }),
    ).toHaveValue(client.id);
    await expect(
      createDialog.getByLabel("Escritura"),
    ).toHaveValue(documentUrl.pathname.split("/").pop() ?? "");
    await createDialog
      .getByPlaceholder("Honorarios por escritura de compraventa")
      .fill("Honorarios de prueba E2E");
    await createDialog.getByPlaceholder("150000.00").fill("75000");
    await createDialog.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(createDialog).toBeHidden();
    // El toast "Cuenta por cobrar creada." (disparado desde
    // `DocumentReceivableStep.handleCreated`) tiene cobertura dedicada en
    // `receivable-milestone-feedback-authenticated.spec.ts` (test A), que lo
    // verifica inmediatamente tras la creación sin la carga adicional de
    // este test (varios modales, `router.refresh()`) que lo hacía flaky
    // aquí por el autodescarte de 3.5s.
    await expect(page).toHaveURL(cobroUrl.toString());
    // El nombre del cliente vive en un <p> anidado tres niveles dentro de
    // la tarjeta de la cuenta (headerInner > headerOuter > cardRoot) — el
    // resto de la tarjeta (montos, badge de estado, botones) vive como
    // hermano de headerOuter dentro de cardRoot, así que hace falta subir
    // tres niveles para alcanzarlo todo.
    const summary = cobroSection(page)
      .getByText(clientName)
      .locator("..")
      .locator("..")
      .locator("..");
    await expect(summary.getByText("Honorarios de prueba E2E")).toBeVisible();
    // "Monto" y "Saldo" muestran el mismo valor mientras no hay pagos —
    // ambigüedad esperada, basta con confirmar que aparece.
    await expect(summary.getByText("₡75.000,00 CRC").first()).toBeVisible();
    await expect(summary.getByText("Pendiente", { exact: true })).toBeVisible();

    // Registrar pago: también un modal, también sin abandonar la Escritura.
    await summary.getByRole("button", { name: "Registrar pago" }).click();
    const payDialog = page.getByRole("dialog", { name: "Registrar pago" });
    await expect(payDialog).toBeVisible();
    await payDialog.getByLabel(/^Monto del pago/).fill("75000");
    await payDialog.getByRole("button", { name: "Registrar pago" }).click();

    await expect(payDialog).toBeHidden();
    // El toast "Pago registrado." tiene cobertura dedicada en
    // `receivable-payments-authenticated.spec.ts` (test B) — mismo motivo
    // que arriba para no duplicarlo aquí.
    await expect(page).toHaveURL(cobroUrl.toString());
    await expect(summary.getByText("Pagada", { exact: true })).toBeVisible();
    await expect(summary.getByText("₡0,00 CRC")).toBeVisible();
    // Saldada: ya no se ofrece registrar otro pago.
    await expect(
      summary.getByRole("button", { name: "Registrar pago" }),
    ).toHaveCount(0);
    await expect(
      summary.getByRole("link", { name: "Ver cuenta completa" }),
    ).toBeVisible();

    // Con pago registrado, la cuenta queda financieramente inmutable — el
    // documento ya no puede eliminarse mientras la cuenta exista (regla de
    // negocio real, no un bug de esta prueba). Limpiar explícitamente aquí,
    // antes del cleanup genérico del registro, para no bloquear el borrado
    // del documento/cliente/machote en el afterAll. receivable_payments no
    // tiene document_id propio — hay que resolver primero la cuenta.
    const documentId = documentUrl.pathname.split("/").pop();
    const createdReceivables = await restSelect<{ id: string }>(
      "receivables",
      `document_id=eq.${documentId}&select=id`,
    );
    for (const receivable of createdReceivables) {
      await restDelete(
        "receivable_payments",
        `receivable_id=eq.${receivable.id}`,
      );
      await restDelete("receivables", `id=eq.${receivable.id}`);
    }
  });
});
