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
 * Flujo guiado en Escrituras: "Guardar y continuar" avanza automáticamente
 * al siguiente paso (Completar → Revisar y finalizar → Cobro → Índice),
 * Finalizar avanza a "Cobro" (regresión explícita del bug donde el redirect
 * sin `section` caía de vuelta en "Completar" — ver
 * `markDocumentFinalAction` en `lifecycle-actions.ts`), Cobro se resuelve
 * explícitamente con "Continuar sin cobro"/"Continuar a Índice", y un
 * guardado o finalización fallidos no avanzan ni marcan un paso como
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

function stepTab(
  page: Page,
  name: "Completar" | "Revisar y finalizar" | "Cobro" | "Índice",
) {
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

  test("A: saving from Completar advances to Revisar y finalizar, marks Completar ✓, and shows a toast (no permanent duplicate banner)", async ({
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
    // El toast de confirmación ("Escritura guardada.") solo se observa en
    // guardados de modo edición: el primer guardado en modo creación
    // redirige (`redirect()` en el server action) antes de que
    // `useActionState` resuelva `state.success` en el cliente, así que ese
    // primer guardado nunca dispara el efecto que muestra el toast — solo
    // el banner de hito (ver `document-milestone-feedback-authenticated.
    // spec.ts`, test A). Se usa un documento ya persistido (modo edición)
    // para probar el toast + auto-avance + ✓ juntos, igual que el
    // equivalente en Machotes (`template-guided-progression-authenticated.
    // spec.ts`, que también edita un machote ya existente).
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
    await page.getByRole("button", { name: "Guardar y continuar" }).click();

    // El guardado avanza automáticamente al siguiente paso del orden fijo.
    await expect(stepTab(page, "Revisar y finalizar")).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 15_000 },
    );

    // El toast se autodescarta a los 3.5s — verificarlo antes que
    // cualquier otra cosa. Confirmación transitoria, no un banner inline
    // permanente — solo una instancia del texto en toda la página.
    await expect(
      page.getByText("Escritura guardada.", { exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("status").getByText("Escritura guardada.", { exact: true }),
    ).toBeVisible();

    await expect(
      stepTab(page, "Completar").getByText("✓", { exact: true }),
    ).toBeVisible();
  });

  test("B: a validation error on save does not advance the step nor mark it complete", async ({
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
    await page.getByRole("button", { name: "Guardar y continuar" }).click();

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

  test("C: a failed finalize attempt (pending required variable) does not advance and shows the server error", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("document-guided-progression", "machote-c"),
      content: "ESCRITURA. Comparece {{parte.nombre}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "parte.nombre",
      label: "Parte",
      required: true,
    });
    const doc = await createTestDocument(registry, template.id, {
      title: uniqueName("document-guided-progression", "escritura-c"),
      rendered_content: "ESCRITURA. Comparece {{parte.nombre}}.",
    });

    await page.goto(`/dashboard/documents/${doc.id}`);
    await goToStep(page, "Revisar y finalizar");
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

    // Nada avanzó: seguimos en "Revisar y finalizar" (no en "Cobro"), sin
    // marca de completo, y el estado sigue en borrador.
    await expect(stepTab(page, "Revisar y finalizar")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      stepTab(page, "Revisar y finalizar").getByText("✓", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("Finalizada", { exact: true })).toHaveCount(0);
  });

  test("D: from Cobro with zero receivables, 'Continuar sin cobro' navigates to Índice, and reloading afterward is fine", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("document-guided-progression", "machote-d"),
      content: "ESCRITURA sin variables.",
    });
    const doc = await createTestDocument(registry, template.id, {
      title: uniqueName("document-guided-progression", "escritura-d"),
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

  test("E: manual back-navigation still works after auto-advancing forward, and re-saving advances again", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("document-guided-progression", "machote-e"),
      content: "ESCRITURA sin variables.",
    });
    const doc = await createTestDocument(registry, template.id, {
      title: uniqueName("document-guided-progression", "escritura-e"),
      rendered_content: "ESCRITURA sin variables.",
    });

    await page.goto(`/dashboard/documents/${doc.id}`);
    await page
      .getByLabel("Título de la escritura")
      .fill(`${uniqueName("document-guided-progression", "escritura-e")} v2`);
    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(stepTab(page, "Revisar y finalizar")).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 15_000 },
    );

    // Navegación manual hacia atrás — el auto-avance no vuelve esto un
    // asistente de un solo sentido.
    await goToStep(page, "Completar");
    const secondTitle = `${uniqueName("document-guided-progression", "escritura-e")} v3`;
    await page.getByLabel("Título de la escritura").fill(secondTitle);
    await page.getByRole("button", { name: "Guardar y continuar" }).click();

    await expect(stepTab(page, "Revisar y finalizar")).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 15_000 },
    );
    await goToStep(page, "Completar");
    await expect(page.getByLabel("Título de la escritura")).toHaveValue(
      secondTitle,
    );
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
    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/?]+/, {
      timeout: 30_000,
    });
    await registerCreatedViaUi(registry, "documents", "title", title);

    // Ya aterrizamos en "Revisar y finalizar" (test A) — no-op idempotente,
    // explícito para no depender de a dónde nos dejó el guardado anterior.
    await goToStep(page, "Revisar y finalizar");
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    const finalizeDialog = page.getByRole("alertdialog", {
      name: "Finalizar escritura",
    });
    await finalizeDialog
      .getByRole("button", { name: "Finalizar escritura" })
      .click();

    // === La aserción más importante de esta suite ===
    // Finalizar debe avanzar a "Cobro", NUNCA de vuelta a "Completar" (el
    // bug original: el redirect no llevaba `section`, así que caía en el
    // paso por defecto).
    await expect(
      page.getByText("Finalizada", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      stepTab(page, "Revisar y finalizar").getByText("✓", { exact: true }),
    ).toBeVisible();
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
