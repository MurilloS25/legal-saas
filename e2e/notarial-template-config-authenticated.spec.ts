import { expect, test, type Page } from "@playwright/test";
import { extractDocxText, readDocx } from "../test/support/docx";
import { integerToUppercaseWords } from "../src/lib/editor/text-transforms";
import {
  CleanupRegistry,
  cleanupNotarialExports,
  createTestDocument,
  createTestTemplate,
  createTestTemplateField,
  replaceTestLawyerProfile,
  restoreTestLawyerProfile,
  runCleanup,
  type TestLawyerProfile,
  uniqueName,
} from "./support/factories";

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();
const templateName = uniqueName("index-config", "machote");
const firstInstrument = 300_000 + Math.floor(Math.random() * 50_000);
const secondInstrument = firstInstrument + 1;
let firstDocumentId = "";
let secondDocumentId = "";
let templateId = "";
let previousProfile: TestLawyerProfile | null = null;
const mappedFieldIds: Record<string, string> = {};
const timeBlockId = "hora-autorizacion";
const onTheHourVariantId = "hora-en-punto";
const withMinutesVariantId = "hora-con-minutos";

const templateDocument = {
  type: "doc" as const,
  content: [
    {
      type: "paragraph" as const,
      content: [
        { type: "text" as const, text: "VENDE " },
        { type: "templateVariable" as const, attrs: { key: "seller.name" } },
        { type: "text" as const, text: " A " },
        { type: "templateVariable" as const, attrs: { key: "buyer.name" } },
        { type: "text" as const, text: ". Autorizada " },
        {
          type: "optionBlock" as const,
          attrs: {
            blockId: timeBlockId,
            name: "Hora",
            defaultVariantId: onTheHourVariantId,
            variants: [
              {
                id: onTheHourVariantId,
                label: "Hora en punto",
                content: [
                  { type: "text" as const, text: "a las " },
                  { type: "templateVariable" as const, attrs: { key: "hora.valor" } },
                  { type: "text" as const, text: " horas" },
                ],
              },
              {
                id: withMinutesVariantId,
                label: "Hora y minutos",
                content: [
                  { type: "text" as const, text: "a las " },
                  { type: "templateVariable" as const, attrs: { key: "hora.valor" } },
                  { type: "text" as const, text: " horas con " },
                  { type: "templateVariable" as const, attrs: { key: "hora.minutos" } },
                  { type: "text" as const, text: " minutos" },
                ],
              },
            ],
            structuredOutput: {
              type: "time" as const,
              variants: [
                {
                  variantId: onTheHourVariantId,
                  hourFieldKey: "hora.valor",
                  minuteFieldKey: null,
                },
                {
                  variantId: withMinutesVariantId,
                  hourFieldKey: "hora.valor",
                  minuteFieldKey: "hora.minutos",
                },
              ],
            },
          },
        },
      ],
    },
  ],
};

function configurationSection(page: Page) {
  return page.getByRole("region", {
    name: "Configuración del índice notarial",
  });
}

function metadataSection(page: Page) {
  return page.getByRole("region", { name: "Datos para índice" });
}

async function open(page: Page, documentId: string) {
  await page.goto(`/dashboard/documents/${documentId}?section=notarial`);
  await expect(metadataSection(page)).toBeVisible();
}

async function openTemplate(page: Page) {
  await page.goto(`/dashboard/templates/${templateId}?section=notarial`);
  await expect(configurationSection(page)).toBeVisible();
}

// Progressive disclosure: cada campo vive en una fila colapsable (una
// abierta a la vez); hay que expandirla antes de poder leer/llenar el input
// que contiene. Idempotente y sin `exact` porque el nombre accesible del
// botón incluye también el "meta" (valor actual/estado).
function indexRow(page: Page, name: string) {
  return metadataSection(page).getByRole("button", {
    name: new RegExp(`^${name}`),
  });
}
async function openIndexRow(page: Page, name: string) {
  const trigger = indexRow(page, name);
  if ((await trigger.getAttribute("aria-expanded")) === "true") return;
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
}

// Ver nota equivalente en notarial-metadata-authenticated.spec.ts: reemplaza
// el antiguo badge "Completo"/"Incompleto" por el resumen numérico de
// `IndexSummaryHeader`.
function summaryCount(page: Page, label: "configurados" | "pendientes") {
  return metadataSection(page).locator(
    `xpath=.//p[normalize-space(text())="${label}"]/preceding-sibling::p[1]`,
  );
}

async function fillStructuredMetadata(page: Page, instrument: number) {
  const section = metadataSection(page);
  await openIndexRow(page, "Número de instrumento");
  await section
    .getByLabel("Número de instrumento", { exact: true })
    .fill(String(instrument));
  await openIndexRow(page, "Fecha y hora de autorización");
  await section
    .getByLabel("Fecha y hora de autorización", { exact: true })
    .fill("2026-07-14T10:30");
  await openIndexRow(page, "Tomo");
  await section.getByLabel("Tomo", { exact: true }).fill("9");
  await openIndexRow(page, "Folios");
  await section.getByLabel("Folio inicial", { exact: true }).fill("40");
  await section.getByLabel("Folio final", { exact: true }).fill("41");
  await section
    .getByRole("button", { name: "Guardar datos del índice" })
    .click();
  await expect(
    section.getByText("Datos del índice guardados.", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
}

test.describe("template notarial index configuration", () => {
  test.afterAll(async () => {
    await cleanupNotarialExports();
    await runCleanup(registry, "index-config");
    await restoreTestLawyerProfile(previousProfile);
  });

  test("A: seed one template and two documents", async () => {
    previousProfile = await replaceTestLawyerProfile("Notaria Normalización E2E");
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "VENDE {{seller.name}} A {{buyer.name}}.",
      doc: templateDocument,
    });
    templateId = template.id;
    await createTestTemplateField(registry, template.id, {
      field_key: "seller.name",
      label: "Nombre del vendedor",
      sort_order: 0,
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "buyer.name",
      label: "Nombre del comprador",
      sort_order: 1,
    });
    for (const [fieldKey, label, sortOrder] of [
      ["instrument.number", "Número del instrumento", 2],
      ["authorized.date", "Fecha autorizada", 3],
      ["protocol.book", "Tomo del protocolo", 5],
      ["folio.initial", "Folio inicial del instrumento", 6],
      ["folio.final", "Folio final del instrumento", 7],
    ] as const) {
      mappedFieldIds[fieldKey] = (
        await createTestTemplateField(registry, template.id, {
          field_key: fieldKey,
          label,
          sort_order: sortOrder,
        })
      ).id;
    }
    await createTestTemplateField(registry, template.id, {
      field_key: "hora.valor",
      label: "Hora",
      sort_order: 8,
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "hora.minutos",
      label: "Minutos",
      sort_order: 9,
    });
    const instrumentWords = integerToUppercaseWords(String(firstInstrument));
    if (!instrumentWords.ok) throw new Error(instrumentWords.error);
    firstDocumentId = (
      await createTestDocument(registry, template.id, {
        title: uniqueName("index-config", "primera"),
        status: "final",
        field_values: {
          "seller.name": "Juan Pérez",
          "buyer.name": "María Rodríguez",
          "instrument.number": instrumentWords.value,
          "authorized.date": "catorce de julio de dos mil veintiséis",
          "hora.valor": "diez",
          "hora.minutos": "veinte",
          "protocol.book": "tomo siete",
          "folio.initial": "veinticinco",
          "folio.final": "veintiséis",
        },
        option_selections: { [timeBlockId]: withMinutesVariantId },
        rendered_content: "VENDE Juan Pérez A María Rodríguez.",
      })
    ).id;
    secondDocumentId = (
      await createTestDocument(registry, template.id, {
        title: uniqueName("index-config", "segunda"),
        status: "final",
        field_values: {
          "seller.name": "Ana Mora",
          "buyer.name": "Luis Solano",
          "instrument.number": "siete ocho",
          "authorized.date": "2026-07-15",
          "hora.valor": "once",
          "protocol.book": "Tomo IX",
          "folio.initial": "41F",
          "folio.final": "41V",
        },
        option_selections: { [timeBlockId]: onTheHourVariantId },
        rendered_content: "VENDE Ana Mora A Luis Solano.",
      })
    ).id;
  });

  test("B: configure ordered fields with a live preview", async ({ page }) => {
    await openTemplate(page);
    const section = configurationSection(page);
    await expect(
      section.getByText(/precargar datos del índice notarial/),
    ).toBeVisible();

    await section
      .getByLabel("Número de instrumento", { exact: true })
      .selectOption(mappedFieldIds["instrument.number"]);
    await section
      .getByLabel("Fecha de autorización", { exact: true })
      .selectOption(mappedFieldIds["authorized.date"]);
    await section
      .getByLabel("Hora de autorización", { exact: true })
      .selectOption(`block:${timeBlockId}`);
    await section
      .getByLabel("Tomo", { exact: true })
      .selectOption(mappedFieldIds["protocol.book"]);
    await section
      .getByLabel("Folio inicial", { exact: true })
      .selectOption(mappedFieldIds["folio.initial"]);
    await section
      .getByLabel("Folio final", { exact: true })
      .selectOption(mappedFieldIds["folio.final"]);

    await section
      .getByRole("checkbox", { name: /Nombre del comprador/ })
      .check();
    await section
      .getByRole("checkbox", { name: /Nombre del vendedor/ })
      .check();
    await section
      .getByRole("button", { name: "Subir Nombre del vendedor" })
      .click();
    await expect(
      section.getByText(
        "NOMBRE DEL VENDEDOR Y NOMBRE DEL COMPRADOR",
        { exact: true },
      ),
    ).toBeVisible();

    await section.getByRole("button", { name: "Guardar configuración" }).click();
    await expect(section.getByText("Configuración guardada.")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("C: configuration persists for the template", async ({ page }) => {
    await openTemplate(page);
    const section = configurationSection(page);
    await expect(section.getByLabel("Número de instrumento")).toHaveValue(
      mappedFieldIds["instrument.number"],
    );
    await expect(section.getByLabel("Hora de autorización")).toHaveValue(
      `block:${timeBlockId}`,
    );
    await expect(
      section.getByRole("checkbox", { name: /Nombre del vendedor/ }),
    ).toBeChecked();
    await expect(
      section.getByRole("checkbox", { name: /Nombre del comprador/ }),
    ).toBeChecked();
    await expect(
      section.getByText(
        "NOMBRE DEL VENDEDOR Y NOMBRE DEL COMPRADOR",
        { exact: true },
      ),
    ).toBeVisible();
  });

  test("D: values in words preload as canonical index values", async ({
    page,
  }) => {
    await open(page, firstDocumentId);
    await expect(configurationSection(page)).toHaveCount(0);
    const section = metadataSection(page);

    await openIndexRow(page, "Número de instrumento");
    await expect(
      section.getByLabel("Número de instrumento", { exact: true }),
    ).toHaveValue(String(firstInstrument));
    await expect(
      section.getByText(`Interpretado: ${firstInstrument}`, { exact: true }),
    ).toBeVisible();

    await openIndexRow(page, "Fecha y hora de autorización");
    await expect(
      section.getByLabel("Fecha y hora de autorización", { exact: true }),
    ).toHaveValue("2026-07-14T10:20");
    await expect(
      section.getByText("Fuente: Bloque de opciones · Hora", { exact: true }),
    ).toBeVisible();
    await expect(
      section.getByText("Variante: Hora y minutos", { exact: true }),
    ).toBeVisible();
    await expect(
      section.getByText("Interpretado: 2026-07-14T10:20", { exact: true }),
    ).toBeVisible();

    await openIndexRow(page, "Tomo");
    await expect(section.getByLabel("Tomo", { exact: true })).toHaveValue("7");
    await openIndexRow(page, "Folios");
    await expect(
      section.getByLabel("Folio inicial", { exact: true }),
    ).toHaveValue("25");
    await expect(
      section.getByLabel("Folio final", { exact: true }),
    ).toHaveValue("26");
    await openIndexRow(page, "Acto o contrato");
    await expect(
      section.getByLabel("Acto o contrato", { exact: true }),
    ).toHaveValue(templateName);
    await openIndexRow(page, "Partes");
    await expect(section.getByLabel("Partes", { exact: true })).toHaveAttribute(
      "placeholder",
      "JUAN PÉREZ Y MARÍA RODRÍGUEZ",
    );

    await section
      .getByRole("button", { name: "Guardar datos del índice" })
      .click();
    await expect(
      section.getByText("Datos del índice guardados.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(summaryCount(page, "pendientes")).toHaveText("0");
    await openIndexRow(page, "Partes");
    await expect(section.getByLabel("Partes", { exact: true })).toHaveAttribute(
      "placeholder",
      "JUAN PÉREZ Y MARÍA RODRÍGUEZ",
    );
  });

  test("E: manual override survives save and resets only on explicit action", async ({
    page,
  }) => {
    await open(page, firstDocumentId);
    const section = metadataSection(page);
    await openIndexRow(page, "Partes");
    await section
      .getByLabel("Partes", { exact: true })
      .fill("PARTE CORREGIDA");
    await section
      .getByRole("button", { name: "Guardar datos del índice" })
      .click();
    await expect(
      section.getByLabel("Partes", { exact: true }),
    ).toHaveValue("PARTE CORREGIDA");

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("corrección manual de Partes");
      await dialog.accept();
    });
    await section
      .getByRole("button", { name: "Restablecer desde el machote" })
      .click();
    await expect(
      section.getByText("Partes restablecidas desde el machote."),
    ).toBeVisible({ timeout: 15_000 });
    await expect(section.getByLabel("Partes", { exact: true })).toHaveValue("");
    await expect(
      section.getByLabel("Partes", { exact: true }),
    ).toHaveAttribute("placeholder", "JUAN PÉREZ Y MARÍA RODRÍGUEZ");
  });

  test("F: ambiguous input requires a manual correction that survives reload", async ({
    page,
  }) => {
    await open(page, secondDocumentId);
    const section = metadataSection(page);
    await openIndexRow(page, "Fecha y hora de autorización");
    await expect(
      section.getByLabel("Fecha y hora de autorización", { exact: true }),
    ).toHaveValue("2026-07-15T11:00");
    await expect(
      section.getByText("Variante: Hora en punto", { exact: true }),
    ).toBeVisible();
    await openIndexRow(page, "Número de instrumento");
    await expect(
      section.getByLabel("Número de instrumento", { exact: true }),
    ).toHaveValue("");
    await expect(
      section.getByText("Original: “siete ocho”", { exact: true }),
    ).toBeVisible();
    await expect(
      section
        .getByText("Estado: Requiere revisión y corrección manual.")
        .first(),
    ).toBeVisible();
    await fillStructuredMetadata(page, secondInstrument);
    await page.reload();
    await openIndexRow(page, "Número de instrumento");
    await expect(
      metadataSection(page).getByLabel("Número de instrumento", {
        exact: true,
      }),
    ).toHaveValue(String(secondInstrument));
    await expect(
      metadataSection(page)
        .getByText("Estado: Listo · corrección guardada")
        .first(),
    ).toBeVisible();
    await openIndexRow(page, "Partes");
    await expect(
      metadataSection(page).getByLabel("Partes", { exact: true }),
    ).toHaveAttribute("placeholder", "ANA MORA Y LUIS SOLANO");
  });

  test("G: finalized documents keep only index metadata editable", async ({
    page,
  }) => {
    await open(page, secondDocumentId);
    const section = metadataSection(page);
    await expect(
      section.getByText(/Puedes corregir estos datos del índice/),
    ).toBeVisible();
    await openIndexRow(page, "Tomo");
    await section.getByLabel("Tomo", { exact: true }).fill("10");
    await section
      .getByRole("button", { name: "Guardar datos del índice" })
      .click();
    await expect(section.getByText("Datos del índice guardados.")).toBeVisible({
      timeout: 15_000,
    });
    await page.reload();
    await openIndexRow(page, "Tomo");
    await expect(
      metadataSection(page).getByLabel("Tomo", { exact: true }),
    ).toHaveValue("10");
  });

  test("H: the notarial DOCX exports the normalized value", async ({ request }) => {
    const response = await request.get(
      `/api/notarial-index/export?year=2026&month=7&half=FIRST_HALF&search=${firstInstrument}`,
    );
    expect(response.status()).toBe(200);
    const text = extractDocxText(
      (await readDocx(await response.body())).documentXml,
    );
    expect(text).toContain(String(firstInstrument));
    expect(text).not.toContain("TOMO SIETE");
  });
});
