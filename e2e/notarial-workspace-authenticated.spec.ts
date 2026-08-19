import { test, expect, type Page, type Locator } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
  createTestDocument,
  createTestNotarialMetadata,
  createTestTemplate,
  createTestTemplateField,
  runCleanup,
  setTestDocumentStatus,
  uniqueName,
} from "./support/factories";

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const token = uniqueName("niw", "t").split("-").pop() as string;
const templateName = uniqueName("niw", "machote");
const instrument = 600_000 + Math.floor(Math.random() * 100_000);
const actType = `Compraventa ${token}`;
const clientName = `Cliente ${token}`;
const authorizedAt = "2026-07-15T16:35:00.000Z"; // 10:35 CR el 2026-07-15
const liveSearchTerm = `Objetivo Dinámico ${token}`;

let completeId = "";
let incompleteId = "";
let missingId = "";
let noDateId = "";
let secondHalfId = "";
let draftId = "";
let liveSearchId = "";

async function seedFinal(
  templateId: string,
  title: string,
  metadata: Parameters<typeof createTestNotarialMetadata>[1] | null,
  createdAt?: string,
): Promise<string> {
  const doc = await createTestDocument(registry, templateId, {
    title,
    field_values: { "parte.nombre": "Persona" },
    rendered_content: "x",
    created_at: createdAt,
  });
  if (metadata) await createTestNotarialMetadata(doc.id, metadata);
  await setTestDocumentStatus(doc.id, "final");
  return doc.id;
}

async function search(page: Page, term: string, extra = "") {
  await page.goto(
    `/dashboard/notarial-index?year=2026&month=7&half=FIRST_HALF&search=${encodeURIComponent(term)}${extra}`,
  );
  await expect(
    page.getByRole("heading", { name: "Índice notarial", exact: true }),
  ).toBeVisible();
}

function rowFor(page: Page, docId: string): Locator {
  return page
    .locator("tr")
    .filter({ has: page.locator(`a[href="/dashboard/documents/${docId}"]`) });
}

test.describe("notarial index workspace", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "niw");
  });

  test("A: seed finalized documents with varying completeness", async () => {
    const client = await createTestClient(registry, { full_name: clientName });
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "ESCRITURA {{parte.nombre}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "parte.nombre",
      label: "Parte",
      required: true,
    });

    const complete = await createTestDocument(registry, template.id, {
      title: `${token} Completo`,
      client_id: client.id,
      field_values: { "parte.nombre": "Persona" },
      rendered_content: "x",
    });
    await createTestNotarialMetadata(complete.id, {
      instrument_number: instrument,
      authorized_at: authorizedAt,
      act_type: actType,
      appearing_parties_summary: `Comparecientes ${token}`,
    });
    await setTestDocumentStatus(complete.id, "final");
    completeId = complete.id;
    incompleteId = await seedFinal(template.id, `${token} Incompleto`, {
      authorized_at: "2026-07-15T17:00:00.000Z",
      appearing_parties_summary: `Solo partes ${token}`,
    });
    // `created_at` fijo dentro de la primera quincena de julio 2026 (mismo
    // período que `authorizedAt`): sin `authorized_at`,
    // `effective_index_date` (notarial_index_entries) cae a `created_at`
    // como resguardo — solo para ubicación/navegación provisional, nunca
    // como fecha real. Sin este override el fixture quedaría en la
    // quincena real de ejecución del test, no en la esperada.
    const undatedCreatedAt = "2026-07-02T16:00:00.000Z";
    missingId = await seedFinal(
      template.id,
      `${token} SinDatos`,
      null,
      undatedCreatedAt,
    );
    // Caso 2 del reporte de smoke: distinto de "sin metadata" — SÍ tiene
    // metadata parcial (un número de instrumento), pero le falta
    // específicamente `authorized_at`. Antes del fix, `.gte()/.lte()`
    // encadenados sobre `authorized_at` excluían esta fila de CUALQUIER
    // quincena, sin importar cuál — nunca era localizable. Ahora
    // `effective_index_date` (authorized_at ?? created_at) siempre la ubica
    // en exactamente una quincena provisional — la de su `created_at` — en
    // vez de en ninguna.
    noDateId = await seedFinal(
      template.id,
      `${token} SinFecha`,
      { instrument_number: instrument + 500 },
      undatedCreatedAt,
    );
    secondHalfId = await seedFinal(template.id, `${token} SegundaQuincena`, {
      instrument_number: instrument + 1,
      authorized_at: "2026-07-16T16:35:00.000Z",
      act_type: actType,
      appearing_parties_summary: `Segunda quincena ${token}`,
    });

    const draft = await createTestDocument(registry, template.id, {
      title: `${token} Borrador`,
      field_values: { "parte.nombre": "Persona" },
      rendered_content: "x",
    });
    draftId = draft.id;

    // Más de una página de resultados para probar que la búsqueda se aplica
    // en servidor antes de paginar, no solo sobre las filas visibles.
    const liveInstrumentBase = 200_000 + Math.floor(Math.random() * 10_000);
    for (let index = 0; index < 16; index += 1) {
      const document = await createTestDocument(registry, template.id, {
        title: index === 15 ? liveSearchTerm : `Registro auxiliar ${index}`,
        field_values: { "parte.nombre": `Persona ${index}` },
        rendered_content: `Contenido auxiliar ${index}`,
      });
      await createTestNotarialMetadata(document.id, {
        instrument_number: liveInstrumentBase + index,
        authorized_at: `2026-07-${String((index % 15) + 1).padStart(2, "0")}T16:00:00.000Z`,
        act_type: "Donación de prueba",
        appearing_parties_summary: `Parte auxiliar ${index}`,
      });
      await setTestDocumentStatus(document.id, "final");
      if (index === 15) liveSearchId = document.id;
    }
  });

  test("B: shows finalized entries with the disclaimer, excludes drafts", async ({
    page,
  }) => {
    await search(page, token);
    await expect(
      page.getByText(/No sustituye el índice oficial/),
    ).toBeVisible();
    await expect(rowFor(page, completeId)).toBeVisible();
    await expect(rowFor(page, incompleteId)).toBeVisible();
    // Regresión del bug de smoke original: una Escritura finalizada sin
    // metadata (o sin `authorized_at`) NUNCA debe quedar invisible solo por
    // estarle faltando esos datos. `effective_index_date` (authorized_at ??
    // created_at) la ubica en su quincena provisional (la de created_at,
    // fijada por el fixture) en vez de excluirla de todas.
    await expect(rowFor(page, missingId)).toBeVisible();
    await expect(rowFor(page, noDateId)).toBeVisible();
    // secondHalfId sí tiene fecha real, solo que en la OTRA quincena — a
    // diferencia de missingId/noDateId, este caso correctamente no
    // pertenece a la quincena activa.
    await expect(rowFor(page, secondHalfId)).toHaveCount(0);
    // Un borrador no aparece en el índice.
    await expect(rowFor(page, draftId)).toHaveCount(0);
  });

  // Comportamiento corregido respecto a PR #177/#181: antes una Escritura
  // sin `authorized_at` aparecía en TODO período (filtro `authorized_at.is.
  // null OR rango`), lo que le quitaba sentido a Año/Mes/Quincena. Ahora
  // `effective_index_date` la ubica en exactamente UNA quincena provisional
  // (la de su `created_at`, ver 20260818130000_notarial_index_inclusion.sql)
  // — localizable, pero ya no omnipresente.
  test("B2: undated finalized entries are locatable in their provisional fortnight, not in every fortnight", async ({
    page,
  }) => {
    // Su propia quincena provisional (created_at fijado por el fixture,
    // misma primera quincena de julio que completeId) — ya cubierto por B,
    // se repite aquí solo como línea base del contraste.
    await search(page, token);
    await expect(rowFor(page, missingId)).toBeVisible();
    await expect(rowFor(page, noDateId)).toBeVisible();

    // Una quincena DISTINTA a la provisional: ya no deben aparecer — a
    // diferencia del comportamiento antiguo (omnipresente por NULL).
    await page.goto(
      `/dashboard/notarial-index?year=2026&month=7&half=SECOND_HALF&search=${token}`,
    );
    await expect(rowFor(page, missingId)).toHaveCount(0);
    await expect(rowFor(page, noDateId)).toHaveCount(0);
    // completeId sí pertenece a la primera quincena, no a esta — mismo
    // contraste que arriba, en la otra dirección.
    await expect(rowFor(page, completeId)).toHaveCount(0);

    await page.goto(
      `/dashboard/notarial-index?year=2020&month=1&half=FIRST_HALF&search=${token}`,
    );
    await expect(rowFor(page, missingId)).toHaveCount(0);
    await expect(rowFor(page, noDateId)).toHaveCount(0);
  });

  // El badge de la fila ahora refleja el ciclo de confirmación, no solo
  // completitud (ver 20260818140000_notarial_index_confirmation_lifecycle):
  // metadata completa pero nunca confirmada (seed directo, sin pasar por el
  // botón "Confirmar datos del Índice") se muestra "Listo para confirmar",
  // no "Completo"; metadata parcial se muestra "Pendiente", no "Incompleto".
  test("C: distinguishes ready-to-confirm and pending entries in the fortnight", async ({ page }) => {
    await search(page, token);
    await expect(
      rowFor(page, completeId).getByText("Listo para confirmar", { exact: true }),
    ).toBeVisible();
    await expect(
      rowFor(page, incompleteId).getByText("Pendiente", { exact: true }),
    ).toBeVisible();
    // Regresión de smoke (Commit 2): el export/warnings ya no excluye por
    // authorized_at NULL — el conteo ahora incluye también missingId y
    // noDateId (antes invisibles para este cálculo), no solo incompleteId.
    await expect(
      page.getByRole("alert").filter({ hasText: "registros incompletos" }),
    ).toBeVisible();
    await expect(
      page.getByRole("alert").filter({ hasText: "3 registros incompletos" }),
    ).toBeVisible();
  });

  test("C2: renders an accessible table with locally visible context columns", async ({
    page,
  }) => {
    await search(page, token);

    const table = page.getByRole("table", {
      name: "Escrituras finalizadas incluidas en el índice notarial interno",
    });
    await expect(table.getByRole("columnheader", { name: "Número" })).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Número" }),
    ).toHaveAttribute("aria-sort", "ascending");
    await expect(table.getByRole("columnheader", { name: "Cliente" })).toHaveCount(0);

    await page.getByText("Columnas", { exact: true }).click();
    await page.getByLabel("Cliente", { exact: true }).check();
    await page.getByLabel("Escritura", { exact: true }).check();

    await expect(table.getByRole("columnheader", { name: "Cliente" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Escritura" })).toBeVisible();
    await expect(rowFor(page, completeId).getByText(clientName)).toBeVisible();
    await expect(
      rowFor(page, completeId).getByText(`${token} Completo`, { exact: true }),
    ).toBeVisible();
  });

  test("D: filter by completeness = complete", async ({ page }) => {
    await search(page, token, "&completeness=complete");
    await expect(rowFor(page, completeId)).toBeVisible();
    await expect(rowFor(page, incompleteId)).toHaveCount(0);
    await expect(rowFor(page, missingId)).toHaveCount(0);
    await expect(rowFor(page, noDateId)).toHaveCount(0);
  });

  // Antes decía "missing metadata cannot be assigned to a fortnight" y
  // afirmaba exactamente lo contrario de lo correcto — codificaba el bug de
  // smoke como comportamiento esperado. `completeness=missing` es
  // precisamente el filtro que un usuario usaría para ENCONTRAR estas
  // Escrituras y completarlas; debe combinarse con Año/Mes/Quincena sin
  // perder la fila por falta de fecha EN SU PROPIA quincena provisional
  // (ver B2: ya no aparece en cualquier quincena, solo en la de created_at).
  test("E: the 'missing' completeness filter locates undated finalized entries in their provisional fortnight", async ({
    page,
  }) => {
    await search(page, token, "&completeness=missing");
    await expect(rowFor(page, missingId)).toBeVisible();
    // noDateId SÍ tiene metadata (instrument_number) — cae bajo
    // completeness=incomplete (ver test E2), no bajo "missing"
    // (has_metadata=false únicamente).
    await expect(rowFor(page, noDateId)).toHaveCount(0);
    // "completo"/"incompleto-con-fecha" no pertenecen al filtro "missing".
    await expect(rowFor(page, completeId)).toHaveCount(0);
    await expect(rowFor(page, incompleteId)).toHaveCount(0);

    // Una quincena a la que nunca podría "pertenecer" por fecha (ni la real
    // ni la provisional): ya no es localizable ahí, a diferencia del
    // comportamiento antiguo (omnipresente por NULL).
    await page.goto(
      `/dashboard/notarial-index?year=2019&month=12&half=SECOND_HALF&search=${token}&completeness=missing`,
    );
    await expect(rowFor(page, missingId)).toHaveCount(0);
  });

  test("E2: the 'incomplete' completeness filter also locates entries missing only the date", async ({
    page,
  }) => {
    // noDateId SÍ tiene metadata (instrument_number) — por diseño de
    // `is_complete` en la vista, sigue siendo "incompleto" mientras falte
    // `authorized_at` u otro campo requerido, así que cae bajo
    // completeness=incomplete, no completeness=missing (esa es solo para
    // has_metadata=false). Antes del fix esta combinación tampoco podía
    // encontrarlo, por la misma exclusión de fecha.
    await search(page, token, "&completeness=incomplete");
    await expect(rowFor(page, incompleteId)).toBeVisible();
    await expect(rowFor(page, noDateId)).toBeVisible();
    await expect(rowFor(page, missingId)).toHaveCount(0);
    await expect(rowFor(page, completeId)).toHaveCount(0);
  });

  test("F: filter by act type", async ({ page }) => {
    await search(page, token, `&act_type=${encodeURIComponent(actType)}`);
    await expect(rowFor(page, completeId)).toBeVisible();
    await expect(rowFor(page, incompleteId)).toHaveCount(0);
  });

  test("G: day 15 and day 16 belong to different fortnights", async ({ page }) => {
    await search(page, token);
    await expect(rowFor(page, completeId)).toBeVisible();
    await expect(rowFor(page, secondHalfId)).toHaveCount(0);
    await page.goto(
      `/dashboard/notarial-index?year=2026&month=7&half=SECOND_HALF&search=${token}`,
    );
    await expect(rowFor(page, completeId)).toHaveCount(0);
    await expect(rowFor(page, secondHalfId)).toBeVisible();
  });

  test("H: search by instrument number", async ({ page }) => {
    await search(page, String(instrument));
    await expect(rowFor(page, completeId)).toBeVisible();
    await expect(rowFor(page, missingId)).toHaveCount(0);
  });

  test("H2: live search queries all server rows, resets page and preserves filters", async ({
    page,
  }) => {
    await page.goto(
      "/dashboard/notarial-index?year=2026&month=7&half=FIRST_HALF&completeness=complete&page=2",
    );
    await expect(page.getByLabel("Buscar")).toBeVisible();

    const input = page.getByLabel("Buscar");
    await input.fill("Objetivo");
    await input.fill(liveSearchTerm);

    await expect
      .poll(() => new URL(page.url()).searchParams.get("search"), {
        timeout: 15_000,
      })
      .toBe(liveSearchTerm);
    const appliedUrl = new URL(page.url());
    expect(appliedUrl.searchParams.get("page")).toBeNull();
    expect(appliedUrl.searchParams.get("year")).toBe("2026");
    expect(appliedUrl.searchParams.get("month")).toBe("7");
    expect(appliedUrl.searchParams.get("half")).toBe("FIRST_HALF");
    expect(appliedUrl.searchParams.get("completeness")).toBe("complete");
    await expect(rowFor(page, liveSearchId)).toBeVisible();

    const filters = page.getByRole("group", {
      name: "Filtros del índice notarial",
    });
    await expect(filters).toHaveAttribute("aria-busy", "false");
    const exportUrl = new URL(
      (await page
        .getByRole("button", { name: "Exportar Word" })
        .getAttribute("data-export-href")) ?? "",
      "http://localhost:3000",
    );
    expect(exportUrl.searchParams.get("search")).toBe(liveSearchTerm);
    expect(exportUrl.searchParams.get("completeness")).toBe("complete");

    await page.getByLabel("Completitud").selectOption("");
    await expect(page).not.toHaveURL(/completeness=complete/);
    await page.goBack();
    await expect(page.getByLabel("Buscar")).toHaveValue(liveSearchTerm);
    await expect(page.getByLabel("Completitud")).toHaveValue("complete");
    await page.goForward();
    await expect(page.getByLabel("Buscar")).toHaveValue(liveSearchTerm);
    await expect(page.getByLabel("Completitud")).toHaveValue("");
    await page.goBack();
    await expect(page.getByLabel("Completitud")).toHaveValue("complete");

    await page.getByRole("button", { name: "Limpiar búsqueda" }).click();
    await expect(page).not.toHaveURL(/(?:\?|&)search=/, { timeout: 15_000 });
    expect(new URL(page.url()).searchParams.get("completeness")).toBe("complete");
  });

  test("I: special-character-only search does not broaden results", async ({
    page,
  }) => {
    await search(page, "%_(),'\"\\");
    await expect(
      page.getByText("No hay escrituras finalizadas con esos filtros"),
    ).toBeVisible();
    await expect(rowFor(page, completeId)).toHaveCount(0);
  });

  test("J: out-of-range page redirects to a valid page", async ({ page }) => {
    await search(page, token, "&page=999999");
    await expect(page).not.toHaveURL(/page=999999/);
    await expect(rowFor(page, completeId)).toBeVisible();
  });

  test("K: invalid query params are handled safely", async ({ page }) => {
    await page.goto(
      "/dashboard/notarial-index?year=bad&month=99&half=hack&completeness=x&page=-1",
    );
    await expect(
      page.getByRole("heading", { name: "Índice notarial", exact: true }),
    ).toBeVisible();
  });

  test("L: the sidebar link opens the index", async ({ page }) => {
    await page.goto("/dashboard");
    await page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Índice Notarial" })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/notarial-index/, {
      timeout: 15_000,
    });
  });

  test("M: the toolbar is usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard/notarial-index?year=2026&month=7&half=FIRST_HALF");
    await expect(page.getByLabel("Año")).toBeVisible();
    await expect(page.getByLabel("Mes")).toBeVisible();
    await expect(page.getByLabel("Quincena")).toBeVisible();
    await expect(page.getByLabel("Buscar")).toBeVisible();
    await expect(page.getByLabel("Completitud")).toBeVisible();
    await expect(
      page.getByRole("table", {
        name: "Escrituras finalizadas incluidas en el índice notarial interno",
      }),
    ).toBeVisible();
    const tableRegion = page.getByRole("region", {
      name: "Tabla del índice notarial",
    });
    await expect(tableRegion).toBeVisible();
    const box = await tableRegion.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
  });

  // Regresión de smoke: cambiar de un período con datos a uno sin datos
  // debía mostrar el estado vacío, nunca las filas del período anterior.
  // Se conduce por los propios controles del toolbar (no navegación directa
  // por URL) para ejercer el mismo router.push() real que usa un usuario.
  // completeness=complete además del token: aísla completeId de
  // missingId/noDateId (mismo token), que ahora viven en su propia quincena
  // provisional (julio, ver B2) y ya no contaminarían agosto de todos modos.
  test("N: switching from a fortnight with data to an empty one never keeps stale rows", async ({
    page,
  }) => {
    // completeId está fechado el 2026-07-15 (hora CR) — Primera quincena de
    // julio. Agosto (misma quincena) no tiene ninguna fila completa con
    // este token.
    await page.goto(
      `/dashboard/notarial-index?year=2026&month=8&half=FIRST_HALF&search=${encodeURIComponent(token)}&completeness=complete`,
    );
    await expect(
      page.getByRole("heading", { name: "Índice notarial", exact: true }),
    ).toBeVisible();
    await expect(rowFor(page, completeId)).toHaveCount(0);
    await expect(
      page.getByText("No hay escrituras finalizadas con esos filtros"),
    ).toBeVisible();

    await page.getByLabel("Mes").selectOption("7");
    await expect(rowFor(page, completeId)).toBeVisible();
    await expect(
      page.getByText("No hay escrituras finalizadas con esos filtros"),
    ).toHaveCount(0);

    await page.getByLabel("Mes").selectOption("9");
    await expect(rowFor(page, completeId)).toHaveCount(0);
    await expect(
      page.getByText("No hay escrituras finalizadas con esos filtros"),
    ).toBeVisible();

    await page.getByLabel("Mes").selectOption("7");
    await expect(rowFor(page, completeId)).toBeVisible();
    await expect(
      rowFor(page, completeId).getByText("Listo para confirmar", { exact: true }),
    ).toBeVisible();
  });
});
