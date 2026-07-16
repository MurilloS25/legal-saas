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

async function open(page: Page, id: string) {
  await page.goto(`/dashboard/documents/${id}`);
  await expect(
    page.getByRole("region", { name: "Datos de la escritura" }),
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

    // Ya finalizada (sembrada directamente).
    await createTestDocument(registry, template.id, {
      title: finalTitle,
      status: "final",
      field_values: { "parte.nombre": "Persona Final" },
      rendered_content: "ESCRITURA. Comparece Persona Final.",
    });
  });

  test("B: draft can be marked ready", async ({ page }) => {
    await open(page, completeId);
    await expect(page.getByText("Borrador", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Marcar como listo para revisar" })
      .click();
    // El server action + revalidación puede tardar más de 5 s en frío (dev):
    // se espera el estado derivado con el mismo timeout que el resto de
    // transiciones de este spec (C/D/E/G).
    await expect(
      page.getByText("Listo para revisar", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("C: ready can be finalized with confirmation", async ({ page }) => {
    await open(page, completeId);
    await page.getByRole("button", { name: "Finalizar" }).click();

    const dialog = page.getByRole("alertdialog", {
      name: "¿Finalizar la escritura?",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/no significa firmado/)).toBeVisible();
    await dialog.getByRole("button", { name: "Finalizar" }).click();

    await expect(
      page.getByText("Finalizado", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("D: final is read-only and can be reopened", async ({ page }) => {
    await open(page, completeId);
    // Solo lectura: el título está deshabilitado.
    await expect(page.getByLabel("Título de la escritura")).toBeDisabled();
    await expect(
      page.getByText(/Finalizado es de solo lectura/),
    ).toBeVisible();
    // La descarga sigue disponible en finalizado.
    await expect(
      page.getByRole("button", { name: "Descargar Word" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Reabrir Escritura" }).click();
    const dialog = page.getByRole("alertdialog", {
      name: "¿Reabrir la escritura?",
    });
    await expect(
      dialog.getByText(
        "La Escritura volverá a estar editable. Podrás finalizarla nuevamente después.",
      ),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Reabrir Escritura" }).click();

    await expect(
      page.getByText("Listo para revisar", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("Título de la escritura")).toBeEnabled();
  });

  test("E: ready can go back to draft with confirmation", async ({ page }) => {
    await open(page, completeId);
    await page.getByRole("button", { name: "Volver a borrador" }).click();
    const dialog = page.getByRole("alertdialog", {
      name: "¿Volver a borrador?",
    });
    await dialog.getByRole("button", { name: "Volver a borrador" }).click();
    await expect(
      page.getByText("Borrador", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("F: unsaved changes block a status change", async ({ page }) => {
    await open(page, completeId);
    const field = page
      .getByRole("region", { name: "Datos de la escritura" })
      .getByLabel(new RegExp(fieldLabel));
    const readyButton = page.getByRole("button", {
      name: "Marcar como listo para revisar",
    });

    // Reintenta el fill hasta que el gate se active, por si el primer intento
    // ocurre antes de la hidratación (dirty no se dispararía).
    await expect(async () => {
      await field.fill("Persona Editada");
      await expect(readyButton).toBeDisabled({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });

    await expect(
      page.getByText("Guarda los cambios antes de cambiar el estado."),
    ).toBeVisible();
    await expect(readyButton).toBeDisabled();
  });

  test("G: pending variables block finalizing (server-side)", async ({
    page,
  }) => {
    await open(page, pendingId);
    await page
      .getByRole("button", { name: "Marcar como listo para revisar" })
      .click();
    await expect(
      page.getByText("Listo para revisar", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Finalizar" }).click();
    const dialog = page.getByRole("alertdialog", {
      name: "¿Finalizar la escritura?",
    });
    await dialog.getByRole("button", { name: "Finalizar" }).click();

    // El servidor bloquea y el estado sigue en "Listo para revisar".
    await expect(dialog.getByText(/variable(s)? sin completar/)).toBeVisible({
      timeout: 15_000,
    });
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(
      page.getByText("Listo para revisar", { exact: true }).first(),
    ).toBeVisible();
  });

  test("H: the workspace can filter by status", async ({ page }) => {
    await page.goto("/dashboard/documents?status=final");
    await expect(
      page.locator("li").filter({ hasText: finalTitle }),
    ).toBeVisible();
    // Una escritura en otro estado no aparece bajo el filtro final.
    await expect(
      page.locator("li").filter({ hasText: pendingTitle }),
    ).toHaveCount(0);
  });

  test("I: a finalized document shows Ver (not Continuar) in the list", async ({
    page,
  }) => {
    await page.goto("/dashboard/documents?status=final");
    const row = page.locator("li").filter({ hasText: finalTitle });
    await expect(row.getByRole("link", { name: "Ver" })).toBeVisible();
  });

  test("J: status controls are visible on a mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page, completeId);
    await expect(
      page.getByRole("button", { name: "Marcar como listo para revisar" }),
    ).toBeVisible();
  });
});
