import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestDocument,
  createTestNotarialMetadata,
  createTestTemplate,
  createTestTemplateField,
  runCleanup,
  uniqueName,
} from "./support/factories";

/**
 * Flujo del Índice con el dock como único "Guardar": en borrador el dock
 * guarda la Escritura; finalizada, el contenido es de solo lectura y el
 * mismo dock guarda los datos del Índice. "Confirmar Índice" es una acción
 * de ciclo de vida aparte que solo aparece con datos completos y guardados.
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

const registry = new CleanupRegistry();
let draftId = "";
let finalId = "";

function dock(page: Page) {
  return page.locator("[data-workspace-action-dock]");
}
function saveButton(page: Page) {
  return dock(page).getByRole("button", { name: "Guardar", exact: true });
}
function confirmButton(page: Page) {
  return dock(page).getByRole("button", { name: "Confirmar Índice" });
}
function section(page: Page) {
  return page.getByRole("region", { name: "Datos para índice" });
}
async function openRow(page: Page, name: string) {
  const trigger = section(page).getByRole("button", { name: new RegExp(`^${name}`) });
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
}

test.describe("Índice: el dock guarda y Confirmar Índice es ciclo de vida", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "nidf");
  });

  test("A: seed a template, a draft and a finalized Escritura missing only the instrument number", async () => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("nidf", "machote"),
      content: "ESCRITURA. Comparece {{parte.nombre}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "parte.nombre",
      label: "Parte",
      required: true,
    });
    draftId = (
      await createTestDocument(registry, template.id, {
        title: uniqueName("nidf", "borrador"),
        status: "draft",
        field_values: { "parte.nombre": "Persona" },
        rendered_content: "ESCRITURA. Comparece Persona.",
      })
    ).id;
    finalId = (
      await createTestDocument(registry, template.id, {
        title: uniqueName("nidf", "final"),
        status: "final",
        field_values: { "parte.nombre": "Persona" },
        rendered_content: "ESCRITURA. Comparece Persona.",
      })
    ).id;
    await createTestNotarialMetadata(finalId, {
      authorized_at: "2026-07-13T16:35:00.000Z",
      act_type: "Compraventa",
      appearing_parties_summary: "PERSONA",
    });
  });

  test("1: in a draft, the dock saves the Escritura and the Índice is still locked", async ({ page }) => {
    await page.goto(`/documents/${draftId}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("textbox", { name: "Título de la escritura" }).fill(uniqueName("nidf", "editado"));
    await saveButton(page).click();
    await expect(dock(page).getByRole("status")).toHaveText("Guardado", { timeout: 15_000 });
    await expect(confirmButton(page)).toHaveCount(0);
    await expect(section(page)).toHaveCount(0);
  });

  test("2-6: finalized — Escritura read-only, incomplete Índice cannot be confirmed, the dock saves it, then Confirmar Índice", async ({
    page,
  }) => {
    // Nada de la Escritura es editable: el único cambio posible es el Índice.
    await page.goto(`/documents/${finalId}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("textbox", { name: "Título de la escritura" })).toBeDisabled();
    await page.getByRole("tab", { name: "Índice", exact: true }).click();
    await expect(section(page)).toBeVisible();

    // 4. Incompleto: nada que guardar todavía, Confirmar no se ofrece.
    await expect(section(page).getByText(/Estado de los datos del Índice: Pendiente/)).toBeVisible();
    await expect(saveButton(page)).toBeDisabled();
    await expect(confirmButton(page)).toHaveCount(0);

    // 2. Editar el Índice: el dock indica cambios del Índice y bloquea Reabrir.
    await openRow(page, "Número de instrumento");
    await section(page)
      .getByLabel("Número de instrumento", { exact: true })
      .fill(String(700_000 + Math.floor(Math.random() * 90_000)));
    await expect(dock(page).getByRole("status")).toHaveText("Índice sin guardar");
    await expect(dock(page).getByRole("button", { name: "Reabrir escritura" })).toBeDisabled();
    await expect(confirmButton(page)).toHaveCount(0);

    // 3/5. Un solo guardado (el dock) y, con todo completo y guardado,
    // aparece Confirmar Índice.
    await saveButton(page).click();
    await expect(page.getByText("Datos del índice completos.", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(section(page).getByText(/Listo para confirmar/)).toBeVisible();
    await expect(
      section(page).getByText("Todos los datos están guardados. Falta confirmar el Índice."),
    ).toBeVisible();
    await expect(saveButton(page)).toBeDisabled();
    await expect(confirmButton(page)).toBeVisible();

    // 6. Confirmar Índice (ciclo de vida, con su propio diálogo).
    await confirmButton(page).click();
    await page
      .getByRole("alertdialog", { name: "¿Confirmar Índice?" })
      .getByRole("button", { name: "Confirmar Índice" })
      .click();
    await expect(section(page).getByText("Datos del Índice confirmados", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(saveButton(page)).toHaveCount(0);
    await expect(confirmButton(page)).toHaveCount(0);
  });

  test("7-9: correcting → Revisión requerida; saving a change → ready again; confirming again", async ({
    page,
  }) => {
    await page.goto(`/documents/${finalId}?section=notarial`);
    await page.waitForLoadState("networkidle");

    await section(page).getByRole("button", { name: "Corregir datos" }).click();
    await page
      .getByRole("alertdialog", { name: "¿Corregir datos del Índice?" })
      .getByRole("button", { name: "Corregir datos" })
      .click();
    await expect(section(page).getByText(/Estado de los datos del Índice: Revisión requerida/)).toBeVisible({
      timeout: 15_000,
    });

    await openRow(page, "Tomo");
    await section(page).getByLabel("Tomo", { exact: true }).fill("09");
    await expect(confirmButton(page)).toHaveCount(0);
    await saveButton(page).click();
    await expect(
      section(page).getByText(
        "Hubo una corrección o reapertura. Revisa los datos antes de confirmar nuevamente el Índice.",
      ),
    ).toBeVisible({ timeout: 15_000 });

    await confirmButton(page).click();
    await page
      .getByRole("alertdialog", { name: "¿Confirmar Índice?" })
      .getByRole("button", { name: "Confirmar Índice" })
      .click();
    await expect(section(page).getByText("Datos del Índice confirmados", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });
});
