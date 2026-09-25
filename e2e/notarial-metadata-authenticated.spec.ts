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
let partialId = "";
let noInstrumentId = "";

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
// "Acto o contrato" se autocompleta con el nombre del machote
// (act_name_snapshot) incluso antes de que el usuario llene nada a mano.
// "Partes" NO se autocompleta aquí: requiere que el machote tenga configurado
// explícitamente el mapeo de Índice → Partes (save_template_index_configuration),
// que este seed nunca configura — descubierto al validar contra un workspace
// limpio (`--no-deps`); la constante decía "2" pero solo hay 1 campo real.
const AUTO_CONFIGURED_FIELDS = 1;

async function open(page: Page, id: string, section: "document" | "notarial" = "notarial") {
  await page.goto(
    section === "notarial"
      ? `/documents/${id}?section=notarial`
      : `/documents/${id}`,
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

    const partial = await createTestDocument(registry, template.id, {
      title: uniqueName("notarial", "parcial"),
      status: "final",
      field_values: { "parte.nombre": "Persona Tres" },
      rendered_content: "ESCRITURA. Comparece Persona Tres.",
    });
    partialId = partial.id;

    // Caso Bug 2 del reporte de smoke: una Escritura finalizada que nunca
    // tuvo metadata notarial guardada — el número de instrumento debe leerse
    // "Sin configurar"/pendiente, nunca "1" (regresión de la sugerencia
    // MAX+1 auto-poblando el campo como si fuera un valor real guardado).
    const noInstrument = await createTestDocument(registry, template.id, {
      title: uniqueName("notarial", "sin-instrumento"),
      status: "final",
      field_values: { "parte.nombre": "Persona Cuatro" },
      rendered_content: "ESCRITURA. Comparece Persona Cuatro.",
    });
    noInstrumentId = noInstrument.id;
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
    await section.getByLabel("Fecha de autorización", { exact: true }).fill("2026-07-13");
    await section.getByLabel("Hora de autorización", { exact: true }).fill("10:35");
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

    await page.locator("[data-workspace-action-dock]").getByRole("button", { name: "Guardar", exact: true })
      .click();
    // Con todos los campos configurados, el guardado es realmente completo
    // — el toast lo confirma con ese texto exacto, no el genérico de
    // "guardado" que también se muestra para un guardado parcial.
    await expect(
      page.getByText("Datos del índice completos.", { exact: true }),
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
      section.getByLabel("Fecha de autorización", { exact: true }),
    ).toHaveValue("2026-07-13");
    await expect(
      section.getByLabel("Hora de autorización", { exact: true }),
    ).toHaveValue("10:35");
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

    await page.getByRole("button", { name: "Reabrir escritura" }).click();
    await page
      .getByRole("alertdialog", { name: "¿Reabrir la escritura?" })
      .getByRole("button", { name: "Reabrir escritura" })
      .click();
    await expect(
      page.getByText("Borrador", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Reabrir redirige de verdad y aterriza en "Completar" (el paso por
    // defecto) — la edición inline ya está justo ahí.
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
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page.locator('p[role="status"]').filter({ hasText: /^Guardado$/ }),
    ).toBeVisible({ timeout: 15_000 });

    // El guardado deja al usuario en "Completar" — Finalizar vive en el
    // encabezado del workspace, alcanzable sin cambiar de paso.
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

    await page.locator("[data-workspace-action-dock]").getByRole("button", { name: "Guardar", exact: true })
      .click();
    await expect(
      page.getByText("Datos del índice completos.", { exact: true }),
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
      section.getByText(/se guardan y se confirman aparte/),
    ).toBeVisible();
    await expect(
      page.locator("[data-workspace-action-dock]").getByRole("button", { name: "Guardar", exact: true }),
    ).toBeVisible();
  });

  // Regresión directa del reporte de smoke: guardar metadata incompleta no
  // debe leerse como "la Escritura ya quedó agregada al Índice". El toast
  // debe ser el genérico de "cambios guardados" (nunca "completo"/"agregado")
  // y debe quedar visible, cerca del resumen, cuáles campos faltan.
  test("G: saving partial metadata shows a modest toast and lists what's missing — never a false success", async ({
    page,
  }) => {
    await open(page, partialId);
    const section = notarialSection(page);

    await openIndexRow(page, "Número de instrumento");
    await section
      .getByLabel("Número de instrumento", { exact: true })
      .fill(String(900_000 + Math.floor(Math.random() * 90_000)));

    // Todavía faltan Fecha, Tomo, Folios — el resumen ya lo refleja en vivo,
    // antes de guardar.
    await expect(
      section.getByText(/Faltan datos para completar el Índice:/),
    ).toBeVisible();

    await page.locator("[data-workspace-action-dock]").getByRole("button", { name: "Guardar", exact: true })
      .click();

    // Nunca el texto que implicaría que el Índice quedó completo/agregado.
    await expect(
      page.getByText("Cambios del índice guardados.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText("Datos del índice completos.", { exact: true }),
    ).toHaveCount(0);

    // Y el aviso de campos faltantes sigue visible después de guardar — no
    // desaparece solo porque hubo un guardado exitoso.
    await expect(
      section.getByText(/Faltan datos para completar el Índice:/),
    ).toBeVisible();
    await expect(section.getByText(/fecha y hora de autorización/)).toBeVisible();
  });

  // El check ✓ del paso "Índice" representa "datos confirmados", no solo
  // "completos" (ver 20260818140000_notarial_index_confirmation_lifecycle,
  // que sustituye la semántica anterior de este test — cobertura completa
  // del ciclo de confirmación vive en
  // notarial-index-confirmation-authenticated.spec.ts). Completar los
  // campos ya no basta: hace falta confirmar explícitamente.
  test("H: the stepper only checkmarks Índice once the data is confirmed, never just complete", async ({
    page,
  }) => {
    const stepper = page.getByRole("navigation", { name: "Pasos de la escritura" });
    const indiceTab = stepper.getByRole("tab", { name: "Índice", exact: true });

    // workingId quedó completo (sin confirmar) en el test B/E de esta misma
    // corrida serial — completo ya no implica ✓.
    await page.goto(`/documents/${workingId}?section=cobro`);
    await expect(indiceTab.getByText("✓", { exact: true })).toHaveCount(0);

    await page.goto(`/documents/${workingId}?section=notarial`);
    await page.locator("[data-workspace-action-dock]").getByRole("button", { name: "Confirmar Índice" })
      .click();
    await page
      .getByRole("alertdialog", { name: "¿Confirmar Índice?" })
      .getByRole("button", { name: "Confirmar Índice" })
      .click();
    await expect(
      page.getByText("Datos del Índice confirmados.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    // El paso activo nunca muestra su propio ✓ (convención ya existente del
    // stepper, ver otros pasos) — hay que mirar "Índice" desde un paso
    // distinto para que su check, si corresponde, sea visible.
    await page.goto(`/documents/${workingId}?section=cobro`);
    await expect(indiceTab.getByText("✓", { exact: true })).toBeVisible();

    // partialId solo tiene el número de instrumento configurado (test G) —
    // sigue incompleto (y sin confirmar), así que el paso no debe mostrar ✓.
    await page.goto(`/documents/${partialId}?section=cobro`);
    await expect(indiceTab.getByText("✓", { exact: true })).toHaveCount(0);
  });

  // Regresión directa del segundo bug de smoke: en una Escritura donde el
  // número de instrumento nunca se configuró, el paso mostraba "1" /
  // "Configurado" — una sugerencia (MAX+1 del Workspace, o 1 si no hay
  // ninguna) confundida con un valor realmente guardado. Además, como el
  // mismo estado se envía siempre en el submit (ver comentario en el
  // componente), esa sugerencia sin confirmar podía terminar persistida
  // como si el usuario la hubiera escrito, con solo guardar otro campo.
  test("I: an unconfigured instrument number never shows as '1'/Configurado, and never gets silently saved", async ({
    page,
  }) => {
    await open(page, noInstrumentId);
    const section = notarialSection(page);

    const instrumentRow = indexRow(page, "Número de instrumento");
    await expect(instrumentRow).toContainText("Sin configurar");
    await expect(instrumentRow).toContainText("Pendiente");
    await expect(instrumentRow).not.toContainText("Configurado");

    await openIndexRow(page, "Número de instrumento");
    await expect(
      section.getByLabel("Número de instrumento", { exact: true }),
    ).toHaveValue("");

    // Guardar otro campo no debe filtrar la sugerencia sin confirmar hacia
    // instrument_number — el submit siempre envía el estado completo del
    // formulario compartido (ver comentario en NotarialMetadataSection).
    await openIndexRow(page, "Acto o contrato");
    await section
      .getByLabel("Acto o contrato", { exact: true })
      .fill("Donación");
    await page.locator("[data-workspace-action-dock]").getByRole("button", { name: "Guardar", exact: true })
      .click();
    // Solo "Acto o contrato" quedó configurado — el guardado es parcial, así
    // que el toast es el genérico ("guardados"), no el de completitud.
    await expect(
      page.getByText("Cambios del índice guardados.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(notarialSection(page)).toBeVisible();
    const instrumentRowAfterSave = indexRow(page, "Número de instrumento");
    await expect(instrumentRowAfterSave).toContainText("Sin configurar");
    await expect(instrumentRowAfterSave).toContainText("Pendiente");
    await openIndexRow(page, "Número de instrumento");
    await expect(
      section.getByLabel("Número de instrumento", { exact: true }),
    ).toHaveValue("");
  });

  // El fix de I no debe sobrecorregir: un número de instrumento real "1",
  // explícitamente escrito y guardado por el usuario, sigue siendo un valor
  // válido — la distinción es "sugerencia sin confirmar" vs "dato guardado",
  // nunca el valor literal 1 en sí.
  test("J: an explicitly typed instrument number of 1 still saves and persists as Configurado", async ({
    page,
  }) => {
    await open(page, noInstrumentId);
    const section = notarialSection(page);

    await openIndexRow(page, "Número de instrumento");
    await section
      .getByLabel("Número de instrumento", { exact: true })
      .fill("1");
    await page.locator("[data-workspace-action-dock]").getByRole("button", { name: "Guardar", exact: true })
      .click();
    // El resto de los campos requeridos siguen vacíos — sigue siendo un
    // guardado parcial, mismo toast genérico que en I.
    await expect(
      page.getByText("Cambios del índice guardados.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(notarialSection(page)).toBeVisible();
    const instrumentRow = indexRow(page, "Número de instrumento");
    await expect(instrumentRow).toContainText("Configurado");
    await expect(instrumentRow).not.toContainText("Sin configurar");
    await openIndexRow(page, "Número de instrumento");
    await expect(
      section.getByLabel("Número de instrumento", { exact: true }),
    ).toHaveValue("1");
  });
});
