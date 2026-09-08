import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
  createTestDocument,
  createTestTemplate,
  createTestTemplateField,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";
import { restDelete, restSelect } from "./support/supabase-admin";

/**
 * Guardado único en Escrituras (iteración 5, con el stepper simplificado de
 * la iteración 6): un solo botón "Guardar" persiste título/valores/
 * cliente/selecciones de Bloques de opciones desde "Completar" — nunca
 * avanza de paso ni cambia el lifecycle. El paso "Revisar y finalizar" que
 * existió en la iteración 5 se retiró en la 6: mostraba prácticamente el
 * mismo documento que ya se ve en Completar (vista previa en vivo,
 * expandible a pantalla completa) y solo agregaba navegación. El stepper
 * es ahora Completar → Cobro → Índice; Finalizar/Reabrir/Descargar Word
 * viven en el encabezado del workspace (`DocumentWorkspaceHeader`), no en
 * un paso propio — alcanzables sin importar la sección activa.
 *
 * Finalizar sigue avanzando a "Cobro" (regresión explícita del bug donde el
 * redirect sin `section` caía de vuelta en "Completar" — ver
 * `markDocumentFinalAction` en `lifecycle-actions.ts`) — eso no cambió:
 * Finalizar es una transición de lifecycle, no el guardado de contenido.
 * Cobro se resuelve explícitamente con "Continuar sin cobro"/"Continuar a
 * Índice", y un guardado o finalización fallidos no marcan un paso como
 * completo. Complementa (no duplica)
 * `document-stepper-create-authenticated.spec.ts`, que cubre el primer
 * guardado en modo creación y el modal contextual de Cobro en detalle.
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

function stepper(page: Page) {
  return page.getByRole("navigation", { name: "Pasos de la escritura" });
}

function stepTab(page: Page, name: "Completar" | "Cobro" | "Índice") {
  return stepper(page).getByRole("tab", { name, exact: true });
}

async function goToStep(page: Page, name: Parameters<typeof stepTab>[1]) {
  await stepTab(page, name).click();
}

function documentRegion(page: Page) {
  return page.getByRole("region", { name: "Documento", exact: true });
}

function cobroSection(page: Page) {
  return page.getByRole("region", {
    name: "Cuentas por cobrar de la escritura",
  });
}

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

test.describe("document guided progression", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "document-guided-progression");
  });

  test("A: saving from Completar does not navigate away, shows a toast (no permanent duplicate banner), and marks Completar complete", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("document-guided-progression", "machote-a"),
      content: "ESCRITURA. Comparece {{parte.nombre}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "parte.nombre",
      label: "Parte",
      required: true,
    });
    const doc = await createTestDocument(registry, template.id, {
      title: uniqueName("document-guided-progression", "escritura-a"),
      rendered_content: "ESCRITURA. Comparece {{parte.nombre}}.",
    });

    await page.goto(`/dashboard/documents/${doc.id}`);
    await expect(stepTab(page, "Completar")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await fillFieldLive(page, "parte.nombre", "Persona de Prueba");
    await page.getByRole("button", { name: "Guardar" }).click();

    // Guardado único: no navega de paso — sigue en "Completar".
    await expect(
      page.getByRole("status").getByText("Escritura guardada.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(stepTab(page, "Completar")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // El toast se autodescarta a los 3.5s — verificarlo antes que
    // cualquier otra cosa. Confirmación transitoria, no un banner inline
    // permanente — solo una instancia del texto en toda la página.
    await expect(
      page.getByText("Escritura guardada.", { exact: true }),
    ).toHaveCount(1);

    // El paso activo se marca "current" (no "✓") mientras se está en él —
    // el check solo se ve en un paso completo que YA NO es el actual, así
    // que hay que salir de "Completar" para verlo. "Cobro" ya está
    // desbloqueado (la Escritura existe) aunque esté vacío.
    await goToStep(page, "Cobro");
    await expect(
      stepTab(page, "Completar").getByText("✓", { exact: true }),
    ).toBeVisible();
  });

  test("B: a validation error on save keeps the workspace dirty and does not mark the step complete", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("document-guided-progression", "machote-b"),
      content: "ESCRITURA sin variables.",
    });
    const doc = await createTestDocument(registry, template.id, {
      title: uniqueName("document-guided-progression", "escritura-b"),
      rendered_content: "ESCRITURA sin variables.",
    });

    await page.goto(`/dashboard/documents/${doc.id}`);
    await expect(stepTab(page, "Completar")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // El título es obligatorio (`required` nativo) — vaciarlo bloquea el
    // envío del formulario en el navegador, antes de que exista respuesta
    // del servidor que procesar.
    const titleInput = page.getByLabel("Título de la escritura");
    await titleInput.fill("");
    await page.getByRole("button", { name: "Guardar" }).click();

    await expect(stepTab(page, "Completar")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      stepTab(page, "Completar").getByText("✓", { exact: true }),
    ).toHaveCount(0);
    await expect(
      await titleInput.evaluate((el: HTMLInputElement) => el.validity.valid),
    ).toBe(false);
    await expect(
      page.getByRole("status").getByText("Escritura guardada.", { exact: true }),
    ).toHaveCount(0);
  });

  test("C: navigating to Cobro and back to Completar never requires saving first, and Guardar persists edits made along the way", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("document-guided-progression", "machote-c"),
      content: "ESCRITURA sin variables.",
    });
    const doc = await createTestDocument(registry, template.id, {
      title: uniqueName("document-guided-progression", "escritura-c"),
      rendered_content: "ESCRITURA sin variables.",
    });
    const firstTitle = `${uniqueName("document-guided-progression", "escritura-c")} v2`;

    await page.goto(`/dashboard/documents/${doc.id}`);

    // Edita en Completar sin guardar y navega a Cobro — el cambio local no
    // se pierde ni exige guardar antes de moverse.
    await page.getByLabel("Título de la escritura").fill(firstTitle);
    await goToStep(page, "Cobro");
    await expect(
      page.locator('form p[role="status"]').filter({ hasText: "Cambios sin guardar" }),
    ).toBeVisible();

    await goToStep(page, "Completar");
    await expect(page.getByLabel("Título de la escritura")).toHaveValue(
      firstTitle,
    );

    // Guardar persiste el cambio sin navegar de paso.
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page.getByRole("status").getByText("Escritura guardada.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(stepTab(page, "Completar")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await page.reload();
    await expect(page.getByLabel("Título de la escritura")).toHaveValue(
      firstTitle,
    );
  });

  test("D: a failed finalize attempt (pending required variable) does not advance and shows the server error", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("document-guided-progression", "machote-d"),
      content: "ESCRITURA. Comparece {{parte.nombre}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "parte.nombre",
      label: "Parte",
      required: true,
    });
    const doc = await createTestDocument(registry, template.id, {
      title: uniqueName("document-guided-progression", "escritura-d"),
      rendered_content: "ESCRITURA. Comparece {{parte.nombre}}.",
    });

    await page.goto(`/dashboard/documents/${doc.id}`);
    // Finalizar vive en el encabezado — alcanzable directo desde
    // "Completar", sin navegar a ningún paso.
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    const dialog = page.getByRole("alertdialog", {
      name: "Finalizar escritura",
    });
    await dialog.getByRole("button", { name: "Finalizar escritura" }).click();

    await expect(
      page.getByText(
        "Queda 1 variable sin completar. Complétala antes de finalizar.",
        { exact: true },
      ),
    ).toBeVisible({ timeout: 15_000 });

    // Nada avanzó: seguimos en "Completar" (no en "Cobro"), y el estado
    // sigue en borrador.
    await expect(stepTab(page, "Completar")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByText("Finalizada", { exact: true })).toHaveCount(0);
  });

  test("E: from Cobro with zero receivables, 'Continuar sin cobro' navigates to Índice, and reloading afterward is fine", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("document-guided-progression", "machote-e"),
      content: "ESCRITURA sin variables.",
    });
    const doc = await createTestDocument(registry, template.id, {
      title: uniqueName("document-guided-progression", "escritura-e"),
      status: "final",
      rendered_content: "ESCRITURA sin variables.",
    });

    await page.goto(`/dashboard/documents/${doc.id}?section=cobro`);
    await expect(cobroSection(page)).toBeVisible();
    await expect(
      cobroSection(page).getByRole("button", { name: "Continuar sin cobro" }),
    ).toBeVisible();

    await cobroSection(page)
      .getByRole("button", { name: "Continuar sin cobro" })
      .click();
    await expect(stepTab(page, "Índice")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // `cobroAcknowledged` es efímero (estado de sesión, no persistido) —
    // recargar no debe romper nada ni se espera que el acuse sobreviva.
    await page.reload();
    await expect(
      page.getByRole("region", { name: "Datos para índice" }),
    ).toBeVisible();
  });

  test("F: Finalizar aterriza en Cobro (regresión del bug), y desde ahí el modal de Cobro (incluyendo 'Crear nuevo cliente' anidado) sigue funcionando", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("document-guided-progression", "machote-f"),
      content: "ESCRITURA. Comparece {{parte.nombre}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "parte.nombre",
      label: "Parte",
      required: true,
    });
    const existingClientName = uniqueName(
      "document-guided-progression",
      "cliente-existente",
    );
    const existingClient = await createTestClient(registry, {
      full_name: existingClientName,
    });
    const title = uniqueName("document-guided-progression", "escritura-f");

    await page.goto(`/dashboard/documents/new/${template.id}`);
    await page.getByLabel("Título de la escritura").fill(title);
    await fillFieldLive(page, "parte.nombre", "Persona F");
    await page.getByRole("button", { name: /^Cliente principal/ }).click();
    await page
      .getByLabel("Cliente principal", { exact: true })
      .selectOption(existingClient.id);
    await page.keyboard.press("Escape");
    // Primer guardado en modo creación: "Crear escritura" (no "Guardar" —
    // ese label es exclusivo de edición). El redirect del server action
    // deja al usuario en "Completar" (el paso por defecto — ya no existe
    // "Revisar y finalizar" a donde aterrizar).
    await page.getByRole("button", { name: "Crear escritura" }).click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/?]+/, {
      timeout: 30_000,
    });
    await registerCreatedViaUi(registry, "documents", "title", title);

    // Finalizar vive en el encabezado — alcanzable directo desde
    // "Completar" (paso por defecto tras el primer guardado).
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    const finalizeDialog = page.getByRole("alertdialog", {
      name: "Finalizar escritura",
    });
    await finalizeDialog
      .getByRole("button", { name: "Finalizar escritura" })
      .click();

    // === La aserción más importante de esta suite ===
    // Finalizar debe avanzar a "Cobro", NUNCA quedar en "Completar" (el
    // bug original: el redirect no llevaba `section`, así que caía en el
    // paso por defecto).
    await expect(
      page.getByText("Finalizada", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(stepTab(page, "Cobro")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(stepTab(page, "Completar")).toHaveAttribute(
      "aria-selected",
      "false",
    );

    // El paso "Cobro" real sigue funcionando desde aquí: abrir el modal de
    // creación...
    await expect(cobroSection(page)).toBeVisible();
    await cobroSection(page)
      .getByRole("button", { name: "Crear cuenta por cobrar" })
      .click();
    const createDialog = page.getByRole("dialog", {
      name: "Crear cuenta por cobrar",
    });
    await expect(createDialog).toBeVisible();
    await createDialog
      .getByPlaceholder("Honorarios por escritura de compraventa")
      .fill("Honorarios de prueba F");

    // ...y el diálogo anidado "+ Crear nuevo cliente" (fix de PR #172: no
    // debe quedar oculto detrás del padre, y cerrarlo debe preservar el
    // estado ya ingresado en el padre, en vez de remontarlo).
    await createDialog
      .getByRole("button", { name: "+ Crear nuevo cliente" })
      .click();
    const nestedClientDialog = page.getByRole("dialog", {
      name: "Crear nuevo cliente",
    });
    await expect(nestedClientDialog).toBeVisible();
    const nestedClientName = uniqueName(
      "document-guided-progression",
      "cliente-anidado",
    );
    await nestedClientDialog.getByLabel("Nombre completo").fill(nestedClientName);
    // Cancelar el anidado conserva el padre abierto con lo ya ingresado.
    await nestedClientDialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(nestedClientDialog).toBeHidden();
    await expect(createDialog).toBeVisible();
    await expect(
      createDialog.getByPlaceholder("Honorarios por escritura de compraventa"),
    ).toHaveValue("Honorarios de prueba F");
    await expect(
      createDialog.getByLabel("Cliente", { exact: true }),
    ).toHaveValue(existingClient.id);

    // Crea la cuenta con el cliente ya preasociado (sin volver a abrir el
    // anidado) — cierra el ciclo confirmando que el modal de Cobro sigue
    // operando con normalidad tras el fix de finalizar.
    await createDialog.getByPlaceholder("150000.00").fill("50000");
    await createDialog.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(createDialog).toBeHidden({ timeout: 15_000 });
    await registerCreatedViaUi(
      registry,
      "clients",
      "full_name",
      nestedClientName,
    );

    await expect(
      cobroSection(page).getByText("Honorarios de prueba F"),
    ).toBeVisible();
    // Con al menos una cuenta creada, el botón de "Continuar" cambia de
    // etiqueta (cero cuentas vs. una o más).
    await expect(
      cobroSection(page).getByRole("button", { name: "Continuar a Índice" }),
    ).toBeVisible();

    // La cuenta creada bloquea el borrado del documento (inmutabilidad
    // financiera — regla real, no un bug de esta prueba). Limpiar
    // explícitamente aquí, antes del cleanup genérico del registro, igual
    // que en `document-stepper-create-authenticated.spec.ts`.
    const documentId = new URL(page.url()).pathname.split("/").pop();
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
