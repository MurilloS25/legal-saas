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
let workingId = "";
let finalId = "";

function notarialSection(page: Page) {
  return page.getByRole("region", { name: "Datos para índice" });
}

// Reemplaza el antiguo badge "Completo"/"Incompleto" — ahora es el resumen
// numérico de `IndexSummaryHeader` ("N configurados" / "N pendientes"). El
// conteo vive en un <p> hermano inmediatamente anterior al <p> de la
// etiqueta, así que se ubica por esa relación estructural.
function summaryCount(page: Page, label: "configurados" | "pendientes") {
  return notarialSection(page).locator(
    `xpath=.//p[normalize-space(text())="${label}"]/preceding-sibling::p[1]`,
  );
}

const TOTAL_NOTARIAL_FIELDS = 6;
// "Acto o contrato" y "Partes" se autocompletan desde el contenido de la
// escritura (act_name_snapshot / generated_parties) incluso antes de que el
// usuario llene nada a mano.
const AUTO_CONFIGURED_FIELDS = 2;

async function open(page: Page, id: string, section: "document" | "notarial" = "notarial") {
  await page.goto(
    section === "notarial"
      ? `/dashboard/documents/${id}?section=notarial`
      : `/dashboard/documents/${id}`,
  );
  if (section === "notarial") await expect(notarialSection(page)).toBeVisible();
}

// Progressive disclosure: cada campo vive en una fila colapsable (una
// abierta a la vez); hay que expandirla antes de poder leer/llenar el
// input que contiene. Idempotente y sin `exact` porque el nombre accesible
// del botón incluye también el "meta" (valor actual/estado).
function indexRow(page: Page, name: string) {
  return notarialSection(page).getByRole("button", {
    name: new RegExp(`^${name}`),
  });
}
async function openIndexRow(page: Page, name: string) {
  const trigger = indexRow(page, name);
  if ((await trigger.getAttribute("aria-expanded")) === "true") return;
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
}

test.describe("notarial index metadata", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "notarial");
  });

  test("A: seed a template and finalized documents", async () => {
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "ESCRITURA. Comparece {{parte.nombre}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "parte.nombre",
      label: "Parte",
      required: true,
    });

    const working = await createTestDocument(registry, template.id, {
      title: uniqueName("notarial", "trabajo"),
      status: "final",
      field_values: { "parte.nombre": "Persona Uno" },
      rendered_content: "ESCRITURA. Comparece Persona Uno.",
    });
    workingId = working.id;

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
    await open(page, workingId);
    const section = notarialSection(page);
    await expect(summaryCount(page, "configurados")).toHaveText(
      String(AUTO_CONFIGURED_FIELDS),
    );
    await expect(summaryCount(page, "pendientes")).toHaveText(
      String(TOTAL_NOTARIAL_FIELDS - AUTO_CONFIGURED_FIELDS),
    );

    await openIndexRow(page, "Número de instrumento");
    await section
      .getByLabel("Número de instrumento", { exact: true })
      .fill(String(instrumentNumber));
    await openIndexRow(page, "Fecha y hora de autorización");
    await section
      .getByLabel("Fecha y hora de autorización", { exact: true })
      .fill("2026-07-13T10:35");
    await openIndexRow(page, "Acto o contrato");
    await section
      .getByLabel("Acto o contrato", { exact: true })
      .fill("Compraventa");
    await openIndexRow(page, "Tomo");
    await section.getByLabel("Tomo", { exact: true }).fill("08");
    await openIndexRow(page, "Folios");
    await section.getByLabel("Folio inicial", { exact: true }).fill("23F");
    await section.getByLabel("Folio final", { exact: true }).fill("23V");
    await openIndexRow(page, "Partes");
    await section
      .getByLabel("Partes", { exact: true })
      .fill("PERSONA UNO Y PERSONA DOS");

    // El resumen de completitud es en vivo.
    await expect(summaryCount(page, "configurados")).toHaveText(
      String(TOTAL_NOTARIAL_FIELDS),
    );
    await expect(summaryCount(page, "pendientes")).toHaveText("0");

    await section
      .getByRole("button", { name: "Guardar datos del índice" })
      .click();
    await expect(
      page.getByText("Datos del índice guardados.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("C: saved metadata persists after reload", async ({ page }) => {
    await open(page, workingId);
    const section = notarialSection(page);
    await expect(summaryCount(page, "configurados")).toHaveText(
      String(TOTAL_NOTARIAL_FIELDS),
    );
    await expect(summaryCount(page, "pendientes")).toHaveText("0");

    await openIndexRow(page, "Número de instrumento");
    await expect(
      section.getByLabel("Número de instrumento", { exact: true }),
    ).toHaveValue(String(instrumentNumber));
    await openIndexRow(page, "Acto o contrato");
    await expect(
      section.getByLabel("Acto o contrato", { exact: true }),
    ).toHaveValue("Compraventa");
    await openIndexRow(page, "Fecha y hora de autorización");
    await expect(
      section.getByLabel("Fecha y hora de autorización", { exact: true }),
    ).toHaveValue("2026-07-13T10:35");
  });

  test("D: the activity timeline shows the notarial events", async ({
    page,
  }) => {
    await open(page, workingId);
    await page.getByRole("button", { name: "Historial" }).click();
    const activity = page.getByRole("dialog", {
      name: "Historial de la escritura",
    });
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
    await open(page, workingId, "document");

    await page.getByRole("tab", { name: "Revisar y finalizar" }).click();
    await page.getByRole("button", { name: "Reabrir escritura" }).click();
    await page
      .getByRole("alertdialog", { name: "¿Reabrir la escritura?" })
      .getByRole("button", { name: "Reabrir escritura" })
      .click();
    await expect(
      page.getByText("Borrador", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Reabrir redirige de verdad y reinicia el paso a "Completar" — la
    // edición inline vive ahí.
    await page
      .getByRole("region", { name: "Documento", exact: true })
      .locator('[data-variable-key="parte.nombre"]')
      .first()
      .click();
    const inlineInput = page
      .getByRole("region", { name: "Documento", exact: true })
      .locator('input[data-variable-key="parte.nombre"]');
    await inlineInput.fill("Persona Uno Actualizada");
    await inlineInput.blur();
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await page.getByRole("tab", { name: "Revisar y finalizar" }).click();
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    await page
      .getByRole("alertdialog", { name: "Finalizar escritura" })
      .getByRole("button", { name: "Finalizar escritura" })
      .click();
    await expect(
      page.getByText("Finalizada", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("tab", { name: "Índice", exact: true }).click();

    const section = notarialSection(page);
    await expect(
      section.getByText(/contenido de la escritura cambió/),
    ).toBeVisible({ timeout: 15_000 });
    await openIndexRow(page, "Acto o contrato");
    await expect(
      section.getByLabel("Acto o contrato", { exact: true }),
    ).toHaveValue("Compraventa");
    await openIndexRow(page, "Partes");
    await expect(
      section.getByLabel("Partes", { exact: true }),
    ).toHaveValue("PERSONA UNO Y PERSONA DOS");

    await section
      .getByRole("button", { name: "Guardar datos del índice" })
      .click();
    await expect(
      page.getByText("Datos del índice guardados.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      section.getByText(/contenido de la escritura cambió/),
    ).toHaveCount(0);

  });

  test("F: a finalized document keeps notarial metadata reviewable", async ({
    page,
  }) => {
    await open(page, finalId);
    const section = notarialSection(page);
    await openIndexRow(page, "Número de instrumento");
    await expect(
      section.getByLabel("Número de instrumento", { exact: true }),
    ).toBeEnabled();
    await expect(
      section.getByText(/Puedes corregir estos datos del índice/),
    ).toBeVisible();
    await expect(
      section.getByRole("button", { name: "Guardar datos del índice" }),
    ).toBeVisible();
  });
});
