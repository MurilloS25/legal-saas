import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestDocument,
  createTestTemplate,
  createTestTemplateField,
  runCleanup,
  setTestDocumentStatus,
  uniqueName,
} from "./support/factories";

/**
 * Iteración 5 — guardado único + reopen/review coherente de Escrituras.
 * Actualizado en la iteración 6 (stepper simplificado: "Revisar y
 * finalizar" se retiró — Completar es ahora el único paso con contenido
 * editable, y Finalizar/Reabrir viven en el encabezado del workspace, no
 * en un paso propio).
 *
 * Caso crítico obligatorio (punto 37 del pedido original): una Escritura
 * finalizada se reabre, se corrige un dato, se guarda, y se refinaliza —
 * todo sin navegación forzada. Con el stepper simplificado esto ocurre
 * enteramente en "Completar" (el paso por defecto tras Reabrir): editar,
 * Guardar y Finalizar están todos ahí mismo, sin un solo cambio de paso.
 * Complementa (no duplica) `document-guided-progression-authenticated.
 * spec.ts` (guardado único básico) y `documents-docx-authenticated.spec.ts`
 * (DOCX bloqueado con dirty, ya cubierto ahí).
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

// El documento vive en un único `role="group"` nombrado "Documento" (vía
// `DocumentPreviewPanel`, dentro de "Completar") — el modal de pantalla
// completa (`ExpandableDocumentPanel`) reutiliza el mismo `DocumentSheet`
// pero solo se monta mientras está abierto, así que este locator nunca es
// ambiguo en el flujo normal (no expandido).
function documentGroup(page: Page) {
  return page.getByRole("group", { name: "Documento", exact: true });
}

// El dock (cuarto refinamiento) es `position: fixed`, hermano de los tres
// paneles — ya no vive dentro del `<form>` de Completar en el DOM (el
// botón "Guardar" lo sigue enviando vía el atributo `form`, no por
// anidamiento).
function saveStatus(page: Page) {
  return page.locator('p[role="status"]').filter({
    hasText: /^Sin guardar$|^Guardando…$|^Guardado$|^Error al guardar$/,
  });
}

async function editFieldLive(page: Page, key: string, value: string) {
  await expect(async () => {
    await documentGroup(page)
      .locator(`[data-variable-key="${key}"]`)
      .first()
      .click();
    const input = documentGroup(page).locator(
      `input[data-variable-key="${key}"]`,
    );
    await input.fill(value);
    await input.blur();
    await expect(
      documentGroup(page).getByText(value).first(),
    ).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

test.describe("document reopen: single save from Completar, and exit guard", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "document-reopen-guard");
  });

  test("A: reopening a finalized document, correcting a field, saving, and refinalizing all work end to end without a single step change", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("document-reopen-guard", "machote-a"),
      content: "ESCRITURA. Comparece {{parte.nombre}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "parte.nombre",
      label: "Parte",
      required: true,
    });
    const doc = await createTestDocument(registry, template.id, {
      title: uniqueName("document-reopen-guard", "escritura-a"),
      field_values: { "parte.nombre": "Persona Original" },
      rendered_content: "ESCRITURA. Comparece Persona Original.",
      status: "final",
    });

    await page.goto(`/dashboard/documents/${doc.id}`);
    await expect(stepTab(page, "Completar")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await page.getByRole("button", { name: "Reabrir escritura" }).click();
    await page
      .getByRole("alertdialog", { name: "¿Reabrir la escritura?" })
      .getByRole("button", { name: "Reabrir escritura" })
      .click();

    // Reabrir deja parado en "Completar" (el paso por defecto) — editable
    // de inmediato.
    await expect(stepTab(page, "Completar")).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 15_000 },
    );
    await expect(page.getByText("Borrador", { exact: true }).first()).toBeVisible();

    // Corregir el dato — sin navegar a ningún otro lado.
    await editFieldLive(page, "parte.nombre", "Persona Corregida");
    await expect(saveStatus(page)).toHaveText("Sin guardar");

    // Finalizar (en "Completar", integrado a la barra de Guardar) está
    // deshabilitado mientras hay cambios sin guardar.
    await expect(
      page.getByRole("button", { name: "Finalizar escritura" }),
    ).toBeDisabled();

    // Guardar, sin cambiar de paso.
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(saveStatus(page)).toHaveText("Guardado", { timeout: 15_000 });
    await expect(stepTab(page, "Completar")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Refinalizar, también desde el mismo lugar.
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    await page
      .getByRole("alertdialog", { name: "Finalizar escritura" })
      .getByRole("button", { name: "Finalizar escritura" })
      .click();
    await expect(
      page.getByText("Finalizada", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // El dato corregido sobrevive un reload completo. Refinalizar redirige
    // a "Cobro" (regresión conocida y deliberada, cubierta aparte en
    // `document-guided-progression-authenticated.spec.ts`) — se navega
    // explícitamente de vuelta a "Completar" para ver el documento.
    await page.goto(`/dashboard/documents/${doc.id}`);
    await expect(
      documentGroup(page).getByText("Persona Corregida"),
    ).toBeVisible();
  });

  test("B: Finalizar with unsaved changes stays blocked, and the error from a failed save never lets a stale snapshot finalize", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("document-reopen-guard", "machote-b"),
      content: "ESCRITURA. Comparece {{parte.nombre}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "parte.nombre",
      label: "Parte",
      required: true,
    });
    const doc = await createTestDocument(registry, template.id, {
      title: uniqueName("document-reopen-guard", "escritura-b"),
      field_values: { "parte.nombre": "Persona B" },
      rendered_content: "ESCRITURA. Comparece Persona B.",
    });

    await page.goto(`/dashboard/documents/${doc.id}`);
    await editFieldLive(page, "parte.nombre", "Persona B editada");
    await expect(saveStatus(page)).toHaveText("Sin guardar");

    // dirty bloquea Finalizar (en "Completar") — nunca finaliza el
    // snapshot anterior. El motivo es un `title` accesible en el propio
    // botón, no una línea de texto permanente.
    const finalButton = page.getByRole("button", { name: "Finalizar escritura" });
    await expect(finalButton).toBeDisabled();
    await expect(finalButton).toHaveAttribute(
      "title",
      "Guarda los cambios antes de finalizar.",
    );

    // Simula una carrera: la escritura se finaliza por otra vía (p. ej.
    // otra pestaña) mientras el cliente todavía la cree editable — el
    // guardado falla en servidor (`.neq("status","final")` no encuentra
    // fila). El error se distingue de "Sin guardar" (no queda enmascarado
    // por él) y dirty se preserva, así que Finalizar sigue sin
    // habilitarse — nunca se finaliza un snapshot desactualizado.
    await setTestDocumentStatus(doc.id, "final");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(saveStatus(page)).toHaveText("Error al guardar", {
      timeout: 15_000,
    });
    await expect(
      page
        .getByText("Esta escritura está finalizada. Reábrela antes de editarla.")
        .first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Finalizar escritura" }),
    ).toBeDisabled();

    // Deshace la carrera simulada. El primer intento sigue detectando la
    // versión nueva (la transición externa también cambió updated_at); solo
    // el reintento explícito acepta esa versión y conserva la edición local.
    await setTestDocumentStatus(doc.id, "draft");
    await page.getByRole("button", { name: "Guardar" }).click();
    const retry = page.getByRole("button", {
      name: "Conservar mis cambios y reintentar",
    });
    await expect(retry).toBeVisible({ timeout: 15_000 });
    await retry.click();
    await expect(saveStatus(page)).toHaveText("Guardado", { timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: "Finalizar escritura" }),
    ).toBeEnabled();
  });

  test("C: internal navigation between steps never shows the leave-confirmation dialog", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("document-reopen-guard", "machote-c"),
      content: "ESCRITURA sin variables.",
    });
    const doc = await createTestDocument(registry, template.id, {
      title: uniqueName("document-reopen-guard", "escritura-c"),
      rendered_content: "ESCRITURA sin variables.",
    });

    await page.goto(`/dashboard/documents/${doc.id}`);
    await page.getByLabel("Título de la escritura").fill(`${doc.id} editado`);
    await expect(saveStatus(page)).toHaveText("Sin guardar");

    await stepTab(page, "Cobro").click();
    await expect(page.getByText("¿Salir sin guardar?")).toHaveCount(0);
    await stepTab(page, "Completar").click();
    await expect(page.getByText("¿Salir sin guardar?")).toHaveCount(0);
    await expect(page.getByLabel("Título de la escritura")).toHaveValue(
      `${doc.id} editado`,
    );
  });

  test("D: leaving the workspace with unsaved changes via the top navbar shows a confirmation; cancel preserves it, confirming navigates away", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("document-reopen-guard", "machote-d"),
      content: "ESCRITURA sin variables.",
    });
    const doc = await createTestDocument(registry, template.id, {
      title: uniqueName("document-reopen-guard", "escritura-d"),
      rendered_content: "ESCRITURA sin variables.",
    });

    await page.goto(`/dashboard/documents/${doc.id}`);
    const editedTitle = `${doc.id} editado D`;
    await page.getByLabel("Título de la escritura").fill(editedTitle);
    await expect(saveStatus(page)).toHaveText("Sin guardar");

    await page.getByRole("link", { name: "Clientes" }).click();
    const dialog = page.getByRole("alertdialog", { name: "¿Salir sin guardar?" });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(new RegExp(doc.id));

    // Cancelar conserva el workspace y los cambios locales.
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByLabel("Título de la escritura")).toHaveValue(
      editedTitle,
    );

    // Reintentar y confirmar sí navega.
    await page.getByRole("link", { name: "Clientes" }).click();
    await page
      .getByRole("alertdialog", { name: "¿Salir sin guardar?" })
      .getByRole("button", { name: "Salir sin guardar" })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/clients$/, { timeout: 15_000 });
  });

  test("E: after a successful save the navbar no longer asks for confirmation", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("document-reopen-guard", "machote-e"),
      content: "ESCRITURA sin variables.",
    });
    const doc = await createTestDocument(registry, template.id, {
      title: uniqueName("document-reopen-guard", "escritura-e"),
      rendered_content: "ESCRITURA sin variables.",
    });

    await page.goto(`/dashboard/documents/${doc.id}`);
    await page.getByLabel("Título de la escritura").fill(`${doc.id} editado E`);
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(saveStatus(page)).toHaveText("Guardado", { timeout: 15_000 });

    await page.getByRole("link", { name: "Clientes" }).click();
    await expect(page).toHaveURL(/\/dashboard\/clients$/, { timeout: 15_000 });
  });
});
