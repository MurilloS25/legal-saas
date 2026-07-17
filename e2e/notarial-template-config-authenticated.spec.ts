import { expect, test, type Page } from "@playwright/test";
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
const templateName = uniqueName("index-config", "machote");
const firstInstrument = 300_000 + Math.floor(Math.random() * 50_000);
const secondInstrument = firstInstrument + 1;
let firstDocumentId = "";
let secondDocumentId = "";
let templateId = "";
let sellerFieldId = "";
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
  await section.getByLabel("Tomo").fill("09");
  await section.getByLabel("Folio inicial").fill("40F");
  await section.getByLabel("Folio final").fill("40V");
  await section
    .getByRole("button", { name: "Guardar datos del índice" })
    .click();
  await expect(
    section.getByText("Datos del índice guardados.", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
}

test.describe("template notarial index configuration", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "index-config");
  });

  test("A: seed one template and two documents", async () => {
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "VENDE {{seller.name}} A {{buyer.name}}.",
    });
    templateId = template.id;
    sellerFieldId = (
      await createTestTemplateField(registry, template.id, {
        field_key: "seller.name",
        label: "Nombre del vendedor",
        sort_order: 0,
      })
    ).id;
    await createTestTemplateField(registry, template.id, {
      field_key: "buyer.name",
      label: "Nombre del comprador",
      sort_order: 1,
    });
    for (const [fieldKey, label, sortOrder] of [
      ["authorized.date", "Fecha autorizada", 2],
      ["authorized.time", "Hora autorizada", 3],
      ["protocol.book", "Tomo del protocolo", 4],
      ["folio.initial", "Folio inicial del instrumento", 5],
      ["folio.final", "Folio final del instrumento", 6],
    ] as const) {
      mappedFieldIds[fieldKey] = (
        await createTestTemplateField(registry, template.id, {
          field_key: fieldKey,
          label,
          sort_order: sortOrder,
        })
      ).id;
    }
    firstDocumentId = (
      await createTestDocument(registry, template.id, {
        title: uniqueName("index-config", "primera"),
        status: "final",
        field_values: {
          "seller.name": "Juan Pérez",
          "buyer.name": "María Rodríguez",
          "authorized.date": "2026-07-14",
          "authorized.time": "10:30",
          "protocol.book": "09",
          "folio.initial": "40F",
          "folio.final": "40V",
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
          "authorized.date": "2026-07-15",
          "authorized.time": "11:45",
          "protocol.book": "09",
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
      .selectOption(sellerFieldId);
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
      sellerFieldId,
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

  test("D: metadata save creates the generated Parties snapshot", async ({
    page,
  }) => {
    await open(page, firstDocumentId);
    await expect(configurationSection(page)).toHaveCount(0);
    const section = metadataSection(page);
    await expect(section.getByLabel("Número de instrumento")).toHaveValue("");
    await expect(
      section.getByText(/Valor del machote: “Juan Pérez”/),
    ).toBeVisible();
    await expect(section.getByLabel("Fecha y hora de autorización")).toHaveValue(
      "2026-07-14T10:30",
    );
    await expect(section.getByLabel("Tomo")).toHaveValue("09");
    await expect(section.getByLabel("Folio inicial")).toHaveValue("40F");
    await expect(section.getByLabel("Folio final")).toHaveValue("40V");
    await expect(section.getByLabel("Acto o contrato")).toHaveValue(templateName);
    await expect(section.getByLabel("Partes")).toHaveAttribute(
      "placeholder",
      "JUAN PÉREZ Y MARÍA RODRÍGUEZ",
    );
    await fillStructuredMetadata(page, firstInstrument);
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

  test("F: a second document reuses the same template configuration", async ({
    page,
  }) => {
    await open(page, secondDocumentId);
    await expect(
      metadataSection(page).getByLabel("Fecha y hora de autorización"),
    ).toHaveValue("2026-07-15T11:45");
    await fillStructuredMetadata(page, secondInstrument);
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
});
