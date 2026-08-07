import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestDocument,
  createTestTemplate,
  createTestTemplateField,
  runCleanup,
  uniqueName,
} from "./support/factories";

// Serial: comparten machote y borradores del mismo usuario.
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const templateName = uniqueName("lifecycle", "machote");
const completeTitle = uniqueName("lifecycle", "completa");
const pendingTitle = uniqueName("lifecycle", "pendiente");
const finalTitle = uniqueName("lifecycle", "finalizada");
const fieldLabel = "Nombre de la parte";

let completeId = "";
let pendingId = "";
let historicalReadyId = "";

async function open(page: Page, id: string) {
  await page.goto(`/dashboard/documents/${id}`);
  // "Datos de la Escritura" siempre está visible (incluso en móvil, donde
  // "Documento" arranca oculto detrás del toggle data/document).
  await expect(
    page.getByRole("region", { name: "Datos de la Escritura" }),
  ).toBeVisible();
}

function documentRegion(page: Page) {
  return page.getByRole("region", { name: "Documento", exact: true });
}

// El paso "Finalizar" (Estado/Reabrir/Descargar Word) vive en su propio
// panel del stepper, oculto por defecto (el paso inicial es "Completar").
async function goToFinalizar(page: Page) {
  await page.getByRole("tab", { name: "Finalizar" }).click();
  await expect(
    page.getByRole("heading", { name: "Estado de la escritura" }),
  ).toBeVisible();
}

test.describe("document lifecycle statuses", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "lifecycle");
  });

  test("A: seed a template and drafts", async () => {
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "ESCRITURA. Comparece {{parte.nombre}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "parte.nombre",
      label: fieldLabel,
      required: true,
    });

    // Completa (sin pendientes).
    const complete = await createTestDocument(registry, template.id, {
      title: completeTitle,
      field_values: { "parte.nombre": "Persona Uno" },
      rendered_content: "ESCRITURA. Comparece Persona Uno.",
    });
    completeId = complete.id;

    // Pendiente (variable sin valor).
    const pending = await createTestDocument(registry, template.id, {
      title: pendingTitle,
      field_values: {},
      rendered_content: "ESCRITURA. Comparece {{parte.nombre}}.",
    });
    pendingId = pending.id;

    const historicalReady = await createTestDocument(registry, template.id, {
      title: uniqueName("lifecycle", "historica"),
      status: "ready",
      field_values: { "parte.nombre": "Persona Histórica" },
      rendered_content: "ESCRITURA. Comparece Persona Histórica.",
    });
    historicalReadyId = historicalReady.id;

    // Ya finalizada (sembrada directamente).
    await createTestDocument(registry, template.id, {
      title: finalTitle,
      status: "final",
      field_values: { "parte.nombre": "Persona Final" },
      rendered_content: "ESCRITURA. Comparece Persona Final.",
    });
  });

  test("B: draft can be finalized directly with confirmation", async ({ page }) => {
    await open(page, completeId);
    await expect(page.getByText("Borrador", { exact: true })).toBeVisible();
    await goToFinalizar(page);
    await page.getByRole("button", { name: "Finalizar escritura" }).click();

    const dialog = page.getByRole("alertdialog", {
      name: "Finalizar escritura",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/quedará bloqueada para edición/)).toBeVisible();
    await dialog.getByRole("button", { name: "Finalizar escritura" }).click();

    await expect(
      page.getByText("Finalizada", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText("Escritura finalizada", { exact: true }),
    ).toBeVisible();
    // El paso "Índice" del stepper deja de estar bloqueado tras finalizar.
    await expect(
      page.getByRole("tab", { name: "Índice", exact: true }),
    ).toBeEnabled();

    // Finalizar redirige de verdad (server action) y reinicia el paso al
    // inicial ("Completar") — hay que volver a Finalizar para ver el enlace.
    await goToFinalizar(page);
    await expect(
      page.getByRole("link", { name: "Completar datos del índice" }),
    ).toBeVisible();
  });

  test("C: final is read-only and can be reopened to draft", async ({ page }) => {
    await open(page, completeId);
    // Solo lectura: el título está deshabilitado (paso Completar, inicial).
    await expect(page.getByLabel("Título de la escritura")).toBeDisabled();

    await goToFinalizar(page);
    await expect(
      page.getByText(/Finalizada es de solo lectura/),
    ).toBeVisible();
    // La descarga sigue disponible en finalizado.
    await expect(
      page.getByRole("button", { name: "Descargar Word" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Reabrir escritura" }).click();
    const dialog = page.getByRole("alertdialog", {
      name: "¿Reabrir la escritura?",
    });
    await expect(
      dialog.getByText(
        "La Escritura volverá a estar editable. Podrás finalizarla nuevamente después.",
      ),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Reabrir escritura" }).click();

    await expect(
      page.getByText("Borrador", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText("Escritura reabierta como borrador.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Título de la escritura")).toBeEnabled();
  });

  test("D: historical ready documents expose explicit resolution actions", async ({
    page,
  }) => {
    await open(page, historicalReadyId);
    await expect(
      page.getByText("Revisión pendiente (histórico)", { exact: true }).first(),
    ).toBeVisible();
    await goToFinalizar(page);
    await expect(
      page.getByRole("button", { name: "Marcar como listo para revisar" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Finalizar escritura" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Volver a borrador" }),
    ).toBeVisible();
  });

  test("F: unsaved changes block a status change", async ({ page }) => {
    await open(page, completeId);

    // El campo se edita en el paso Completar (inicial); dirty es estado
    // compartido de todo el compositor, así que sigue activo al cambiar de
    // paso — nunca se pierde ni se reinicia al navegar a Finalizar.
    await expect(async () => {
      await documentRegion(page)
        .locator('[data-variable-key="parte.nombre"]')
        .first()
        .click();
      const input = documentRegion(page).locator(
        'input[data-variable-key="parte.nombre"]',
      );
      await input.fill("Persona Editada");
      await input.blur();
      await expect(page.getByText("Cambios sin guardar").first()).toBeVisible({
        timeout: 2_000,
      });
    }).toPass({ timeout: 20_000 });

    await goToFinalizar(page);
    const finalButton = page.getByRole("button", {
      name: "Finalizar escritura",
    });
    await expect(
      page.getByText("Guarda los cambios antes de cambiar el estado."),
    ).toBeVisible();
    await expect(finalButton).toBeDisabled();
  });

  test("G: pending variables block finalizing (server-side)", async ({
    page,
  }) => {
    await open(page, pendingId);
    await goToFinalizar(page);
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    const dialog = page.getByRole("alertdialog", {
      name: "Finalizar escritura",
    });
    await dialog.getByRole("button", { name: "Finalizar escritura" }).click();

    // El servidor bloquea y el estado sigue en borrador.
    await expect(dialog.getByText(/variable(s)? sin completar/)).toBeVisible({
      timeout: 15_000,
    });
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(
      page.getByText("Borrador", { exact: true }).first(),
    ).toBeVisible();
  });

  test("H: the workspace can filter by status", async ({ page }) => {
    await page.goto("/dashboard/documents?status=final");
    await expect(
      page.locator("tbody tr").filter({ hasText: finalTitle }),
    ).toBeVisible();
    // Una escritura en otro estado no aparece bajo el filtro final.
    await expect(
      page.locator("tbody tr").filter({ hasText: pendingTitle }),
    ).toHaveCount(0);
  });

  test("I: a finalized document shows Ver (not Continuar) in the list, and no delete action", async ({
    page,
  }) => {
    await page.goto("/dashboard/documents?status=final");
    const row = page.locator("tbody tr").filter({ hasText: finalTitle });
    await expect(row.getByRole("link", { name: "Ver" })).toBeVisible();
    // Una escritura finalizada no puede eliminarse sin reabrirla primero.
    await expect(
      row.getByRole("button", { name: `Eliminar ${finalTitle}` }),
    ).toHaveCount(0);
  });

  test("J: status controls are visible on a mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page, completeId);
    await goToFinalizar(page);
    await expect(
      page.getByRole("button", { name: "Finalizar escritura" }),
    ).toBeVisible();
  });
});
