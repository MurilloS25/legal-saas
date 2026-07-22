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

async function fillStructuredMetadata(page: Page, instrument: number) {
  const section = metadataSection(page);
  await section.getByLabel("Número de instrumento").fill(String(instrument));
  await section
    .getByLabel("Fecha y hora de autorización")
    .fill("2026-07-14T10:30");
  await section.getByLabel("Tomo").fill("9");
  await section.getByLabel("Folio inicial").fill("40");
  await section.getByLabel("Folio final").fill("41");
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
      ["authorized.time", "Hora autorizada", 4],
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
          "authorized.time": "diez horas con treinta minutos",
          "protocol.book": "tomo siete",
          "folio.initial": "veinticinco",
          "folio.final": "veintiséis",
        },
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
          "authorized.time": "11:45",
          "protocol.book": "Tomo IX",
          "folio.initial": "41F",
          "folio.final": "41V",
        },
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
      .selectOption(mappedFieldIds["authorized.time"]);
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
    await expect(section.getByLabel("Número de instrumento")).toHaveValue(
      String(firstInstrument),
    );
    await expect(
      section.getByText(`Interpretado: ${firstInstrument}`, { exact: true }),
    ).toBeVisible();
    await expect(section.getByLabel("Fecha y hora de autorización")).toHaveValue(
      "2026-07-14T10:30",
    );
    await expect(section.getByLabel("Tomo")).toHaveValue("7");
    await expect(section.getByLabel("Folio inicial")).toHaveValue("25");
    await expect(section.getByLabel("Folio final")).toHaveValue("26");
    await expect(section.getByLabel("Acto o contrato")).toHaveValue(templateName);
    await expect(section.getByLabel("Partes")).toHaveAttribute(
      "placeholder",
      "JUAN PÉREZ Y MARÍA RODRÍGUEZ",
    );
    await section
      .getByRole("button", { name: "Guardar datos del índice" })
      .click();
    await expect(
      section.getByText("Datos del índice guardados.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(section.getByText("Completo", { exact: true })).toBeVisible();
    await expect(section.getByLabel("Partes")).toHaveAttribute(
      "placeholder",
      "JUAN PÉREZ Y MARÍA RODRÍGUEZ",
    );
  });

  test("E: manual override survives save and resets only on explicit action", async ({
    page,
  }) => {
    await open(page, firstDocumentId);
    const section = metadataSection(page);
    await section.getByLabel("Partes").fill("PARTE CORREGIDA");
    await section
      .getByRole("button", { name: "Guardar datos del índice" })
      .click();
    await expect(section.getByLabel("Partes")).toHaveValue("PARTE CORREGIDA");

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
    await expect(section.getByLabel("Partes")).toHaveValue("");
    await expect(section.getByLabel("Partes")).toHaveAttribute(
      "placeholder",
      "JUAN PÉREZ Y MARÍA RODRÍGUEZ",
    );
  });

  test("F: ambiguous input requires a manual correction that survives reload", async ({
    page,
  }) => {
    await open(page, secondDocumentId);
    const section = metadataSection(page);
    await expect(section.getByLabel("Número de instrumento")).toHaveValue("");
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
    await expect(metadataSection(page).getByLabel("Número de instrumento")).toHaveValue(
      String(secondInstrument),
    );
    await expect(
      metadataSection(page)
        .getByText("Estado: Listo · corrección guardada")
        .first(),
    ).toBeVisible();
    await expect(metadataSection(page).getByLabel("Partes")).toHaveAttribute(
      "placeholder",
      "ANA MORA Y LUIS SOLANO",
    );
  });

  test("G: finalized documents keep only index metadata editable", async ({
    page,
  }) => {
    await open(page, secondDocumentId);
    const section = metadataSection(page);
    await expect(
      section.getByText(/Puedes corregir estos datos del índice/),
    ).toBeVisible();
    await section.getByLabel("Tomo").fill("10");
    await section
      .getByRole("button", { name: "Guardar datos del índice" })
      .click();
    await expect(section.getByText("Datos del índice guardados.")).toBeVisible({
      timeout: 15_000,
    });
    await page.reload();
    await expect(metadataSection(page).getByLabel("Tomo")).toHaveValue("10");
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
