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
test.setTimeout(120_000);

const registry = new CleanupRegistry();

const templateName = uniqueName("notarial", "machote");
const instrumentNumber = 100_000 + Math.floor(Math.random() * 100_000);
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

    await section
      .getByLabel("Número de instrumento")
      .fill(String(instrumentNumber));
    await section
      .getByLabel("Fecha y hora de autorización")
      .fill("2026-07-13T10:35");
    await section.getByLabel("Acto o contrato").fill("Compraventa");
    await section.getByLabel("Tomo").fill("08");
    await section.getByLabel("Folio inicial").fill("23F");
    await section.getByLabel("Folio final").fill("23V");
    await section.getByLabel("Partes").fill("PERSONA UNO Y PERSONA DOS");

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
      String(instrumentNumber),
    );
    await expect(section.getByLabel("Acto o contrato")).toHaveValue("Compraventa");
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

  test("E: reopened content changes require notarial review without replacing overrides", async ({
    page,
  }) => {
    await open(page, draftId);

    await page
      .getByRole("button", { name: "Marcar como listo para revisar" })
      .click();
    await expect(
      page.getByText("Listo para revisar", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Finalizar" }).click();
    await page
      .getByRole("alertdialog", { name: "¿Finalizar la escritura?" })
      .getByRole("button", { name: "Finalizar" })
      .click();
    await expect(
      page.getByText("Finalizado", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Reabrir Escritura" }).click();
    await page
      .getByRole("alertdialog", { name: "¿Reabrir la escritura?" })
      .getByRole("button", { name: "Reabrir Escritura" })
      .click();
    await expect(
      page.getByText("Listo para revisar", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });

    await page
      .getByRole("region", { name: "Datos de la escritura" })
      .getByLabel("Parte")
      .fill("Persona Uno Actualizada");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    const section = notarialSection(page);
    await expect(
      section.getByText(/contenido de la escritura cambió/),
    ).toBeVisible({ timeout: 15_000 });
    await expect(section.getByLabel("Acto o contrato")).toHaveValue(
      "Compraventa",
    );
    await expect(section.getByLabel("Partes")).toHaveValue(
      "PERSONA UNO Y PERSONA DOS",
    );

    await section
      .getByRole("button", { name: "Guardar datos del índice" })
      .click();
    await expect(
      section.getByText(/contenido de la escritura cambió/),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Finalizar" }).click();
    await page
      .getByRole("alertdialog", { name: "¿Finalizar la escritura?" })
      .getByRole("button", { name: "Finalizar" })
      .click();
    await expect(
      page.getByText("Finalizado", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("F: a finalized document keeps notarial metadata reviewable", async ({
    page,
  }) => {
    await open(page, finalId);
    const section = notarialSection(page);
    await expect(section.getByLabel("Número de instrumento")).toBeEnabled();
    await expect(
      section.getByText(/Puedes corregir estos datos del índice/),
    ).toBeVisible();
    await expect(
      section.getByRole("button", { name: "Guardar datos del índice" }),
    ).toBeVisible();
  });
});
