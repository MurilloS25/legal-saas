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

/**
 * Expande la fila colapsable del campo simple `key` (`idx-<key>`) dentro de
 * la sección de configuración del Índice Notarial del machote — desde la
 * reorganización en filas de acordeón, cada `<select>`/checkbox solo se
 * monta mientras su fila está abierta (una sola fila abierta a la vez).
 */
async function openConfigIndexRow(page: Page, key: string) {
  await page.locator(`#idx-${key}-trigger`).click();
}

// Progressive disclosure del lado de la Escritura (paso Índice del
// compositor): cada campo vive en una fila colapsable (una abierta a la
// vez); hay que expandirla antes de poder leer/llenar el input que
// contiene. Idempotente y sin `exact` porque el nombre accesible del botón
// incluye también el "meta" (valor actual/estado).
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
  await section.getByLabel("Fecha de autorización", { exact: true }).fill("2026-07-14");
  await section.getByLabel("Hora de autorización", { exact: true }).fill("10:30");
  await openIndexRow(page, "Tomo");
  await section.getByLabel("Tomo", { exact: true }).fill("9");
  await openIndexRow(page, "Folios");
  await section.getByLabel("Folio inicial", { exact: true }).fill("40");
  await section.getByLabel("Folio final", { exact: true }).fill("41");
  await section
    .getByRole("button", { name: "Guardar datos del índice" })
    .click();
  // Acto/Partes no se llenan aquí a propósito — ya vienen resueltos por el
  // snapshot/generado del machote, así que con instrumento + fecha + tomo +
  // folios los ocho valores quedan completos.
  await expect(
    page.getByText("Datos del índice completos.", { exact: true }),
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
    // El texto de ayuda de `IndexSummaryHeader` (encabezado nuevo de la
    // presentación en acordeón) reemplazó al párrafo introductorio plano
    // que tenía la sección antes de la reorganización en filas colapsables.
    await expect(
      section.getByText(/precargar automáticamente el Índice/),
    ).toBeVisible();

    // Cada campo simple vive en su propia fila colapsable: hay que abrirla
    // antes de que su `<select>` exista en el DOM. Abrir la siguiente fila
    // cierra la anterior automáticamente (solo una fila abierta a la vez),
    // pero el valor ya elegido queda guardado en el estado del componente
    // padre — no se pierde al colapsarse. Dentro de cada fila, el `<label>`
    // visible del `<select>` es el genérico "Variable sugerida" (el nombre
    // del campo ya está en el encabezado de la fila), así que se ubica por
    // el id fijo `${key}_field_id` en vez de por `getByLabel`.
    await openConfigIndexRow(page, "instrument_number");
    await section
      .locator("#instrument_number_field_id")
      .selectOption(mappedFieldIds["instrument.number"]);
    await openConfigIndexRow(page, "authorized_date");
    await section
      .locator("#authorized_date_field_id")
      .selectOption(mappedFieldIds["authorized.date"]);
    await openConfigIndexRow(page, "authorized_time");
    await section
      .locator("#authorized_time_field_id")
      .selectOption(`block:${timeBlockId}`);
    await openConfigIndexRow(page, "protocol_book");
    await section
      .locator("#protocol_book_field_id")
      .selectOption(mappedFieldIds["protocol.book"]);
    await openConfigIndexRow(page, "initial_folio");
    await section
      .locator("#initial_folio_field_id")
      .selectOption(mappedFieldIds["folio.initial"]);
    await openConfigIndexRow(page, "final_folio");
    await section
      .locator("#final_folio_field_id")
      .selectOption(mappedFieldIds["folio.final"]);

    await openConfigIndexRow(page, "parties");
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

    // El guardado del Índice se unificó en el único botón "Guardar" del
    // machote (ya no tiene su propio botón "Guardar configuración") — el
    // guardado coordinado dispara ambos toasts.
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Configuración guardada.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Machote guardado.")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("C: configuration persists for the template", async ({ page }) => {
    await openTemplate(page);
    const section = configurationSection(page);
    await openConfigIndexRow(page, "instrument_number");
    await expect(section.locator("#instrument_number_field_id")).toHaveValue(
      mappedFieldIds["instrument.number"],
    );
    await openConfigIndexRow(page, "authorized_time");
    await expect(section.locator("#authorized_time_field_id")).toHaveValue(
      `block:${timeBlockId}`,
    );
    await openConfigIndexRow(page, "parties");
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
      section.getByLabel("Fecha de autorización", { exact: true }),
    ).toHaveValue("2026-07-14");
    await expect(
      section.getByLabel("Hora de autorización", { exact: true }),
    ).toHaveValue("10:20");
    await expect(
      section.getByText("Fuente: Bloque de opciones · Hora", { exact: true }),
    ).toBeVisible();
    await expect(
      section.getByText("Variante: Hora y minutos", { exact: true }),
    ).toBeVisible();
    await expect(
      section.getByText("Interpretado: 10:20", { exact: true }),
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
    // Todos los campos quedaron configurados (línea siguiente lo confirma:
    // "0 pendientes") — el toast lo refleja con el texto de completitud, no
    // el genérico de guardado parcial.
    await expect(
      page.getByText("Datos del índice completos.", { exact: true }),
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
      page.getByText("Partes restablecidas desde el machote."),
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
      section.getByLabel("Fecha de autorización", { exact: true }),
    ).toHaveValue("2026-07-15");
    await expect(
      section.getByLabel("Hora de autorización", { exact: true }),
    ).toHaveValue("11:00");
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
    // El documento ya había quedado completo en el test F — editar solo
    // Tomo no lo vuelve incompleto, así que sigue siendo el toast de
    // completitud, no el genérico.
    await expect(
      page.getByText("Datos del índice completos.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
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

  // Combobox buscable de Partes: verifica específicamente búsqueda/filtrado
  // y selección por teclado (Enter), no solo clic directo por nombre — ya
  // cubierto en el resto de este archivo (tests B/C). No se toca la
  // selección hecha por B/C: reordena y limpia lo que agrega, dejando el
  // machote como test C lo dejó.
  test("I: the searchable Partes combobox filters by typing and supports keyboard selection", async ({
    page,
  }) => {
    await openTemplate(page);
    const section = configurationSection(page);
    await openConfigIndexRow(page, "parties");

    const search = section.getByLabel("Buscar variable para Partes");
    await expect(search).toHaveAttribute("role", "combobox");
    await expect(search).toHaveAttribute("aria-expanded", "true");

    // Filtra: de 9 variables del machote, solo una coincide con "folio
    // inicial" — las 2 ya seleccionadas por B/C (vendedor, comprador) el
    // filtro nunca las oculta, así que la opción filtrada queda en la
    // tercera posición (índice 2) de la lista visible, no en la primera.
    await search.fill("folio inicial");
    await expect(
      section.getByRole("option", { name: /Folio inicial del instrumento/ }),
    ).toBeVisible();
    await expect(
      section.getByRole("option", { name: /Número del instrumento/ }),
    ).toHaveCount(0);

    // Selección por teclado: baja hasta la opción filtrada y Enter la
    // alterna, sin necesidad de clic.
    await search.press("ArrowDown");
    await search.press("ArrowDown");
    await search.press("Enter");
    await expect(
      section.getByRole("checkbox", { name: /Folio inicial del instrumento/ }),
    ).toBeChecked();

    // Deshace la selección hecha por este test (no por B/C): con el mismo
    // término de búsqueda, la opción vuelve a quedar en el índice 2.
    await search.press("ArrowDown");
    await search.press("ArrowDown");
    await search.press("Enter");
    await expect(
      section.getByRole("checkbox", { name: /Folio inicial del instrumento/ }),
    ).not.toBeChecked();
    await search.fill("");

    // Escape limpia la búsqueda sin cerrar la sección ni perder el estado.
    await search.fill("vendedor");
    await search.press("Escape");
    await expect(search).toHaveValue("");
  });

  // Item 3 del pedido: reabrir la Escritura y corregir una fuente que
  // alimenta el Índice debe re-derivar el valor automático, no conservar
  // el que ya se había mostrado/guardado antes de reabrir.
  test("J: reopening the document and correcting the Hora source re-derives the Índice value, not the stale one", async ({
    page,
  }) => {
    await open(page, firstDocumentId);
    const section = metadataSection(page);
    await openIndexRow(page, "Fecha y hora de autorización");
    await expect(
      section.getByLabel("Hora de autorización", { exact: true }),
    ).toHaveValue("10:20"); // hora.valor="diez", hora.minutos="veinte"

    await page.goto(`/dashboard/documents/${firstDocumentId}?section=revisar`);
    await page.getByRole("button", { name: "Reabrir escritura" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Reabrir escritura" })
      .click();

    await page.getByRole("tab", { name: "Completar" }).click();
    const documentRegion = page.getByRole("region", { name: "Documento", exact: true });
    await expect(async () => {
      await documentRegion.locator('[data-variable-key="hora.valor"]').first().click();
      const input = documentRegion.locator('input[data-variable-key="hora.valor"]');
      await input.fill("once");
      await input.blur();
      await expect(documentRegion.getByText("once").first()).toBeVisible({
        timeout: 2_000,
      });
    }).toPass({ timeout: 20_000 });
    await page.getByRole("button", { name: "Guardar" }).click();

    await page.getByRole("tab", { name: "Revisar y finalizar" }).click();
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Finalizar escritura" })
      .click();

    await page.getByRole("tab", { name: "Índice", exact: true }).click();
    await expect(section).toBeVisible();
    await openIndexRow(page, "Fecha y hora de autorización");
    // hora.valor ahora "once" (11), hora.minutos sigue "veinte" (20) —
    // 11:20, no el 10:20 que ya se había mostrado antes de reabrir.
    await expect(
      section.getByLabel("Hora de autorización", { exact: true }),
    ).toHaveValue("11:20");
  });
});
