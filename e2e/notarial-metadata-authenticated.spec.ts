import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestDocument,
  createTestTemplate,
  createTestTemplateField,
  runCleanup,
  uniqueName,
} from "./support/factories";

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const templateName = uniqueName("notarial", "machote");
let draftId = "";
let finalId = "";

function notarialSection(page: Page) {
  return page.getByRole("region", { name: "Datos para índice" });
}

async function open(page: Page, id: string) {
  await page.goto(`/dashboard/documents/${id}`);
  await expect(notarialSection(page)).toBeVisible();
}

test.describe("notarial index metadata", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "notarial");
  });

  test("A: seed a template, a draft and a finalized document", async () => {
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "ESCRITURA. Comparece {{parte.nombre}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "parte.nombre",
      label: "Parte",
      required: true,
    });

    const draft = await createTestDocument(registry, template.id, {
      title: uniqueName("notarial", "borrador"),
      field_values: { "parte.nombre": "Persona Uno" },
      rendered_content: "ESCRITURA. Comparece Persona Uno.",
    });
    draftId = draft.id;

    const final = await createTestDocument(registry, template.id, {
      title: uniqueName("notarial", "final"),
      status: "final",
      field_values: { "parte.nombre": "Persona Dos" },
      rendered_content: "ESCRITURA. Comparece Persona Dos.",
    });
    finalId = final.id;
  });

  test("B: the section starts incomplete and can be completed and saved", async ({
    page,
  }) => {
    await open(page, draftId);
    const section = notarialSection(page);
    await expect(section.getByText("Incompleto", { exact: true })).toBeVisible();

    await section.getByLabel("Número de instrumento").fill("125-2026");
    await section
      .getByLabel("Fecha y hora de autorización")
      .fill("2026-07-13T10:35");
    await section.getByLabel("Tipo de acto").fill("Compraventa");

    // El badge de completitud es en vivo.
    await expect(section.getByText("Completo", { exact: true })).toBeVisible();

    await section
      .getByRole("button", { name: "Guardar datos del índice" })
      .click();
    await expect(
      page.getByText("Datos del índice guardados.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("C: saved metadata persists after reload", async ({ page }) => {
    await open(page, draftId);
    const section = notarialSection(page);
    await expect(section.getByLabel("Número de instrumento")).toHaveValue(
      "125-2026",
    );
    await expect(section.getByLabel("Tipo de acto")).toHaveValue("Compraventa");
    await expect(section.getByLabel("Fecha y hora de autorización")).toHaveValue(
      "2026-07-13T10:35",
    );
    await expect(section.getByText("Completo", { exact: true })).toBeVisible();
  });

  test("D: the activity timeline shows the notarial events", async ({
    page,
  }) => {
    await open(page, draftId);
    const activity = page.getByRole("region", { name: "Actividad" });
    await expect(
      activity.getByText("Datos para índice creados"),
    ).toBeVisible();
    await expect(
      activity.getByText("Datos para índice completos"),
    ).toBeVisible();
  });

  test("E: a finalized document locks the notarial section", async ({
    page,
  }) => {
    await open(page, finalId);
    const section = notarialSection(page);
    await expect(section.getByLabel("Número de instrumento")).toBeDisabled();
    await expect(
      section.getByText(/Reábrela para editar los datos del índice/),
    ).toBeVisible();
    await expect(
      section.getByRole("button", { name: "Guardar datos del índice" }),
    ).toHaveCount(0);
  });
});
