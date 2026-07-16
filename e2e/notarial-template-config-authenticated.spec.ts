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

function configurationSection(page: Page) {
  return page.getByRole("region", {
    name: "Configuración de Partes del índice",
  });
}

function metadataSection(page: Page) {
  return page.getByRole("region", { name: "Datos para índice" });
}

async function open(page: Page, documentId: string) {
  await page.goto(`/dashboard/documents/${documentId}`);
  await expect(metadataSection(page)).toBeVisible();
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
    firstDocumentId = (
      await createTestDocument(registry, template.id, {
        title: uniqueName("index-config", "primera"),
        field_values: {
          "seller.name": "Juan Pérez",
          "buyer.name": "María Rodríguez",
        },
        rendered_content: "VENDE Juan Pérez A María Rodríguez.",
      })
    ).id;
    secondDocumentId = (
      await createTestDocument(registry, template.id, {
        title: uniqueName("index-config", "segunda"),
        field_values: {
          "seller.name": "Ana Mora",
          "buyer.name": "Luis Solano",
        },
        rendered_content: "VENDE Ana Mora A Luis Solano.",
      })
    ).id;
  });

  test("B: configure ordered fields with a live preview", async ({ page }) => {
    await open(page, firstDocumentId);
    const section = configurationSection(page);
    await expect(
      section.getByText("Selecciona los campos que representan las partes"),
    ).toBeVisible();

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
      section.getByText("JUAN PÉREZ Y MARÍA RODRÍGUEZ", { exact: true }),
    ).toBeVisible();

    await section.getByRole("button", { name: "Guardar configuración" }).click();
    await expect(section.getByText("Configuración guardada.")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("C: configuration persists for the template", async ({ page }) => {
    await open(page, firstDocumentId);
    const section = configurationSection(page);
    await section.getByText("Editar configuración de Partes").click();
    await expect(
      section.getByRole("checkbox", { name: /Nombre del vendedor/ }),
    ).toBeChecked();
    await expect(
      section.getByRole("checkbox", { name: /Nombre del comprador/ }),
    ).toBeChecked();
    await expect(
      section.getByText("JUAN PÉREZ Y MARÍA RODRÍGUEZ", { exact: true }),
    ).toBeVisible();
  });

  test("D: metadata save creates the generated Parties snapshot", async ({
    page,
  }) => {
    await open(page, firstDocumentId);
    await fillStructuredMetadata(page, firstInstrument);
    const section = metadataSection(page);
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
      configurationSection(page).getByText("Editar configuración de Partes"),
    ).toBeVisible();
    await fillStructuredMetadata(page, secondInstrument);
    await expect(metadataSection(page).getByLabel("Partes")).toHaveAttribute(
      "placeholder",
      "ANA MORA Y LUIS SOLANO",
    );
  });
});
