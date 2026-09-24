import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  CleanupRegistry,
  createTestDocument,
  createTestNotarialMetadata,
  createTestTemplate,
  runCleanup,
  uniqueName,
} from "./support/factories";

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

const registry = new CleanupRegistry();
const token = `inline-${randomUUID().slice(0, 8)}`;
const instrument = 100_000 + (Number.parseInt(randomUUID().slice(0, 6), 16) % 800_000);
let completeId = "";
let editableId = "";

function indexUrl() {
  return `/notarial-index?year=2026&month=7&half=FIRST_HALF&search=${token}&pageSize=5`;
}

function toggle(page: Page, documentId: string) {
  return page.locator(`[aria-controls="notarial-row-detail-${documentId}"]`);
}

function panel(page: Page, documentId: string) {
  return page.locator(`#notarial-row-detail-${documentId}`);
}

test.describe("notarial inline review", () => {
  test.beforeAll(async () => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("notarial-inline", "machote"),
      content: "ESCRITURA de prueba para revisión inline.",
      includeInNotarialIndexByDefault: true,
    });
    const complete = await createTestDocument(registry, template.id, {
      title: `${token} completa`,
      rendered_content: "ESCRITURA completa de prueba.",
      created_at: "2026-07-05T12:00:00.000Z",
      status: "final",
    });
    completeId = complete.id;
    await createTestNotarialMetadata(completeId, {
      instrument_number: instrument,
      authorized_at: "2026-07-05T16:00:00.000Z",
      act_type: "Compraventa de prueba",
      appearing_parties_summary: "Persona Uno y Persona Dos",
      notes: "Nota visible de prueba",
    });

    const editable = await createTestDocument(registry, template.id, {
      title: `${token} pendiente`,
      rendered_content: "ESCRITURA pendiente de prueba.",
      created_at: "2026-07-06T12:00:00.000Z",
      status: "final",
    });
    editableId = editable.id;
  });

  test.afterAll(async () => {
    await runCleanup(registry, "notarial-inline-review");
  });

  test("expands and collapses with an accessible keyboard toggle", async ({ page }) => {
    await page.goto(indexUrl());
    const button = toggle(page, completeId);
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(panel(page, completeId)).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });

  test("shows persisted metadata and keeps a clear full-document action", async ({ page }) => {
    await page.goto(indexUrl());
    await toggle(page, completeId).click();
    const detail = panel(page, completeId);
    await expect(detail.getByLabel("Número de instrumento")).toHaveValue(String(instrument));
    await expect(detail.getByLabel("Acto o contrato")).toHaveValue("Compraventa de prueba");
    await expect(detail.getByLabel("Partes / comparecientes")).toHaveValue("Persona Uno y Persona Dos");
    await expect(detail.getByLabel("Notas internas (opcional)")).toHaveValue("Nota visible de prueba");
    await expect(detail.getByRole("link", { name: "Ver escritura" })).toHaveAttribute(
      "href",
      `/documents/${completeId}`,
    );
  });

  test("keeps only one row open", async ({ page }) => {
    await page.goto(indexUrl());
    await toggle(page, completeId).click();
    await expect(panel(page, completeId)).toBeVisible();
    await toggle(page, editableId).click();
    await expect(panel(page, editableId)).toBeVisible();
    await expect(panel(page, completeId)).toHaveCount(0);
  });

  test("blocks confirmation while visible metadata is dirty", async ({ page }) => {
    await page.goto(indexUrl());
    await toggle(page, completeId).click();
    const detail = panel(page, completeId);
    const confirm = detail.getByRole("button", { name: "Confirmar datos" });
    await expect(confirm).toBeEnabled();
    await detail.getByLabel("Tomo").fill("09-dirty");
    // Una acción principal por estado: con cambios sin guardar, Confirmar
    // no se ofrece; la acción visible es Guardar y se explica el orden.
    await expect(confirm).toHaveCount(0);
    await expect(detail.getByRole("button", { name: "Guardar datos" })).toBeVisible();
    await expect(
      detail.getByText("Tienes cambios sin guardar. Guárdalos y después confirma los datos."),
    ).toBeVisible();
    await detail.getByLabel("Tomo").fill("08");
    await expect(confirm).toBeEnabled();
  });

  test("traps focus in confirmation and restores it after Escape", async ({
    page,
  }) => {
    await page.goto(indexUrl());
    await toggle(page, completeId).click();
    const confirm = panel(page, completeId).getByRole("button", {
      name: "Confirmar datos",
    });
    await confirm.click();

    const dialog = page.getByRole("alertdialog", {
      name: "¿Confirmar datos del Índice?",
    });
    const cancel = dialog.getByRole("button", { name: "Cancelar" });
    await expect(cancel).toBeFocused();
    await cancel.press("Shift+Tab");
    await expect(
      dialog.getByRole("button", { name: "Confirmar datos" }),
    ).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(confirm).toBeFocused();
  });

  test("saves inline and preserves period, filters, page and pageSize", async ({ page }) => {
    await page.goto(indexUrl());
    await toggle(page, editableId).click();
    const detail = panel(page, editableId);
    await detail.getByLabel("Número de instrumento").fill(String(instrument + 1));
    await detail.getByLabel("Fecha y hora de autorización").fill("2026-07-06T10:00");
    await detail.getByLabel("Tomo").fill("09");
    await detail.getByLabel("Folio inicial").fill("24F");
    await detail.getByLabel("Folio final").fill("24V");
    await detail.getByLabel("Acto o contrato").fill("Donación de prueba");
    await detail.getByLabel("Partes / comparecientes").fill("Persona Tres y Persona Cuatro");
    const saveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/notarial-index",
    );
    await detail.getByRole("button", { name: "Guardar datos" }).click();
    await saveResponse;

    await page.reload();
    await toggle(page, editableId).click();
    await expect(
      panel(page, editableId).getByText("Listo para confirmar", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    const url = new URL(page.url());
    expect(url.searchParams.get("year")).toBe("2026");
    expect(url.searchParams.get("month")).toBe("7");
    expect(url.searchParams.get("half")).toBe("FIRST_HALF");
    expect(url.searchParams.get("search")).toBe(token);
    expect(url.searchParams.get("pageSize")).toBe("5");
  });

  test("confirms, locks, then starts correction with the current version", async ({ page }) => {
    await page.goto(indexUrl());
    await toggle(page, editableId).click();
    let detail = panel(page, editableId);
    await expect(
      detail.getByText("Listo para confirmar", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await detail.getByRole("button", { name: "Confirmar datos" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar datos" }).click();
    await expect(detail.getByText("Confirmado", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(detail.getByLabel("Número de instrumento")).toBeDisabled();

    await detail.getByRole("button", { name: "Corregir datos" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Corregir datos" }).click();
    detail = panel(page, editableId);
    await expect(detail.getByText("Revisión requerida", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(detail.getByLabel("Número de instrumento")).toBeEnabled();
    await expect(page).toHaveURL(/pageSize=5/);
    await expect(page).toHaveURL(new RegExp(`search=${token}`));
  });

  test("changing a filter closes the expansion without losing pageSize", async ({ page }) => {
    await page.goto(indexUrl());
    await toggle(page, editableId).click();
    await expect(panel(page, editableId)).toBeVisible();
    await page.getByLabel("Completitud").selectOption("complete");
    await expect(panel(page, editableId)).toHaveCount(0);
    await expect(page).toHaveURL(/completeness=complete/);
    await expect(page).toHaveURL(/pageSize=5/);
  });
});
