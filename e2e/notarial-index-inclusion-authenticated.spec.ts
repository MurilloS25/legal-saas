import { test, expect, type Page, type Locator } from "@playwright/test";
import {
  CleanupRegistry,
  createTestDocument,
  createTestTemplate,
  createTestTemplateField,
  runCleanup,
  setTestDocumentInclusion,
  setTestDocumentStatus,
  uniqueName,
} from "./support/factories";
import { currentCostaRicaFortnight } from "../src/features/notarial-index/model/fortnight";

/**
 * Semántica ACTUAL (desde feat/template-notarial-index-default):
 * pertenecer al Índice Notarial se decide por el default del Machote
 * (`templates.include_in_notarial_index_by_default`), tomado como snapshot
 * en `documents.include_in_notarial_index` al CREAR la Escritura — no al
 * finalizarla. Finalizar ya no vuelve a preguntar esa decisión: el diálogo
 * solo muestra texto estático que refleja el valor ya fijado. Una vez
 * finalizada, la única forma de cambiar la pertenencia es el control
 * incluir/excluir del paso Índice (`setNotarialIndexInclusionAction`), no un
 * checkbox del diálogo de finalizar (que ya no existe — ver
 * `template-notarial-index-default-authenticated.spec.ts` para la cobertura
 * completa Machote → Escritura → stepper).
 *
 * Este archivo cubre lo que esa otra spec NO cubre: el listado
 * `/notarial-index` (búsqueda, presencia/ausencia de filas) bajo
 * este modelo, incluyendo que un cambio hecho por navegación cliente (tabs,
 * sin `page.goto`) se refleje correctamente ahí.
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

const registry = new CleanupRegistry();

const token = uniqueName("nii", "t").split("-").pop() as string;
const templateOnName = uniqueName("nii", "machote-on");
const templateOffName = uniqueName("nii", "machote-off");

let templateOnId = "";
let templateOffId = "";
let includedId = "";
let excludedId = "";
let toggleId = "";

function stepper(page: Page) {
  return page.getByRole("navigation", { name: "Pasos de la escritura" });
}

function notarialSection(page: Page) {
  return page.getByRole("region", { name: "Datos para índice" });
}

function rowFor(page: Page, docId: string): Locator {
  return page
    .locator("tr")
    .filter({ has: page.locator(`a[href="/documents/${docId}"]`) });
}

// Los documentos de este spec se finalizan "ahora" (sin authorized_at
// fijo), así que su effective_index_date provisional (created_at) cae en la
// quincena ACTUAL de ejecución, no en una fecha fija — navegar a un período
// hardcodeado los dejaría invisibles en cualquier fecha real distinta.
async function search(page: Page, term: string) {
  const { year, month, half } = currentCostaRicaFortnight();
  await page.goto(
    `/notarial-index?year=${year}&month=${month}&half=${half}&search=${encodeURIComponent(term)}`,
  );
  await expect(
    page.getByRole("heading", { name: "Índice notarial", exact: true }),
  ).toBeVisible();
}

test.describe("notarial index inclusion", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "nii");
  });

  test("A: seed a default=true and a default=false template", async () => {
    const templateOn = await createTestTemplate(registry, {
      name: templateOnName,
      content: "ESCRITURA. Comparece {{parte.nombre}}.",
      includeInNotarialIndexByDefault: true,
    });
    templateOnId = templateOn.id;
    await createTestTemplateField(registry, templateOnId, {
      field_key: "parte.nombre",
      label: "Parte",
      required: true,
    });

    const templateOff = await createTestTemplate(registry, {
      name: templateOffName,
      content: "CONSTANCIA. Comparece {{parte.nombre}}.",
      includeInNotarialIndexByDefault: false,
    });
    templateOffId = templateOff.id;
    await createTestTemplateField(registry, templateOffId, {
      field_key: "parte.nombre",
      label: "Parte",
      required: true,
    });
  });

  // La pertenencia al Índice ya fue decidida por el Machote al crear la
  // Escritura (snapshot) — finalizar es un cambio de estado puro, no vuelve
  // a preguntar. El diálogo no tiene checkbox: solo confirma el valor ya
  // vigente.
  test("B: a document created from a default=true template has no checkbox at finalize, only static confirming text, and ends up in the índice", async ({
    page,
  }) => {
    const doc = await createTestDocument(registry, templateOnId, {
      title: `${token} Incluida por Machote`,
      field_values: { "parte.nombre": "Persona Uno" },
      rendered_content: "ESCRITURA. Comparece Persona Uno.",
    });
    includedId = doc.id;

    await page.goto(`/documents/${includedId}`);
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Finalizar escritura" });
    await expect(dialog.getByRole("checkbox")).toHaveCount(0);
    await expect(
      dialog.getByText("Esta Escritura se incluirá en el Índice Notarial según su configuración actual."),
    ).toBeVisible();

    await dialog.getByRole("button", { name: "Finalizar escritura" }).click();
    await expect(
      page.getByText("Finalizada", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });

    await search(page, token);
    await expect(rowFor(page, includedId)).toBeVisible();
  });

  // Simétrico a B: nace excluida porque su Machote tiene el default en
  // false — finalizar tampoco pregunta nada aquí. El paso "Índice" del
  // stepper sigue siendo alcanzable (iteración 6): nacer excluida no lo
  // saca de la navegación, solo cambia lo que muestra.
  test("C: a document created from a default=false template has no checkbox at finalize, only static excluding text, stays finalized, keeps the Índice step reachable, and never appears in the índice listing", async ({
    page,
  }) => {
    const doc = await createTestDocument(registry, templateOffId, {
      title: `${token} Excluida por Machote`,
      field_values: { "parte.nombre": "Persona Dos" },
      rendered_content: "CONSTANCIA. Comparece Persona Dos.",
    });
    excludedId = doc.id;

    await page.goto(`/documents/${excludedId}`);
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Finalizar escritura" });
    await expect(dialog.getByRole("checkbox")).toHaveCount(0);
    await expect(
      dialog.getByText("Esta Escritura no se incluirá en el Índice Notarial según su configuración actual."),
    ).toBeVisible();

    await dialog.getByRole("button", { name: "Finalizar escritura" }).click();
    await expect(
      page.getByText("Finalizada", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // La escritura sigue finalizada — nacer excluida no la reabre ni la
    // bloquea de otro modo.
    await expect(
      page.getByText("Finalizada", { exact: true }).first(),
    ).toBeVisible();

    // El paso "Índice" sigue apareciendo en la navegación normal del
    // stepper, y muestra la tarjeta compacta de exclusión al entrar.
    await expect(
      stepper(page).getByRole("tab", { name: "Índice", exact: true }),
    ).toBeVisible();
    await stepper(page).getByRole("tab", { name: "Índice", exact: true }).click();
    await expect(
      page.getByText("No pertenece al Índice Notarial", { exact: true }),
    ).toBeVisible();

    await search(page, token);
    await expect(rowFor(page, excludedId)).toHaveCount(0);
  });

  // Casos G/H del PR original, y C/D del bug de estado obsoleto reportado
  // en revisión de #184: corrección posterior desde el paso Índice, sin
  // pasar por una pantalla nueva — un control discreto dentro de la misma
  // sección, con confirmación vía el `ConfirmDialog` propio (no
  // `window.confirm`) y que sobrevive un refresh completo, no solo la
  // actualización optimista en memoria.
  //
  // Desde la iteración 6 del stepper, el paso "Índice" NUNCA desaparece de
  // la navegación normal por estar excluida — la exclusión solo cambia qué
  // muestra el paso (la tarjeta compacta "No pertenece al Índice Notarial"
  // en vez del formulario completo), no si es alcanzable. Excluir MIENTRAS
  // se está parado en "Índice" ya no navega a otro lado tampoco — el
  // usuario se queda viendo el resultado inmediato de su propia acción.
  test("D: the Índice step lets a finalized document be excluded and re-included later, surviving a reload, without ever disappearing from the stepper", async ({
    page,
  }) => {
    const doc = await createTestDocument(registry, templateOnId, {
      title: `${token} Alternar después`,
      field_values: { "parte.nombre": "Persona Tres" },
      rendered_content: "ESCRITURA. Comparece Persona Tres.",
    });
    toggleId = doc.id;
    await setTestDocumentStatus(toggleId, "final");

    await search(page, token);
    await expect(rowFor(page, toggleId)).toBeVisible();

    await page.goto(`/documents/${toggleId}?section=notarial`);
    const toggle = notarialSection(page).getByLabel("Incluir en el Índice Notarial");
    await expect(toggle).toBeChecked();

    // Caso C: incluida → excluir → se queda en "Índice", mostrando de
    // inmediato la tarjeta compacta — el cambio ya quedó persistido en el
    // servidor, no solo en memoria.
    await toggle.click();
    await page
      .getByRole("alertdialog", { name: "¿Excluir esta Escritura del Índice Notarial?" })
      .getByRole("button", { name: "Excluir" })
      .click();
    await expect(
      page.getByText("No pertenece al Índice Notarial", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      stepper(page).getByRole("tab", { name: "Índice", exact: true }),
    ).toHaveAttribute("aria-selected", "true");

    await search(page, token);
    await expect(rowFor(page, toggleId)).toHaveCount(0);

    // Un reload completo (de vuelta en la Escritura, tras el desvío al
    // listado del Índice) confirma que la exclusión sí persistió en
    // servidor (no solo estado optimista) — el paso sigue presente y
    // alcanzable, mostrando la misma tarjeta compacta.
    await page.goto(`/documents/${toggleId}?section=notarial`);
    await page.reload();
    await expect(
      page.getByText("No pertenece al Índice Notarial", { exact: true }),
    ).toBeVisible();
    await expect(
      stepper(page).getByRole("tab", { name: "Índice", exact: true }),
    ).toBeVisible();

    // Caso D: excluida → volver a incluir desde la tarjeta compacta → la
    // sección completa reaparece con el toggle marcado → sigue marcado tras
    // un refresh completo.
    await page.getByRole("button", { name: "Incluir en el Índice" }).click();
    await page
      .getByRole("alertdialog", { name: "¿Incluir esta Escritura en el Índice Notarial?" })
      .getByRole("button", { name: "Incluir" })
      .click();
    await expect(notarialSection(page)).toBeVisible({ timeout: 15_000 });
    await expect(
      notarialSection(page).getByLabel("Incluir en el Índice Notarial"),
    ).toBeChecked({ timeout: 15_000 });

    await search(page, token);
    await expect(rowFor(page, toggleId)).toBeVisible();

    await page.goto(`/documents/${toggleId}?section=notarial`);
    await expect(notarialSection(page)).toBeVisible();
    await expect(notarialSection(page).getByLabel("Incluir en el Índice Notarial")).toBeChecked();
  });

  // Bug real encontrado en revisión manual de #184 (el checkbox del paso
  // Índice podía mostrar un valor obsoleto tras navegar por los tabs del
  // stepper sin recargar, porque NotarialMetadataSection no se desmonta
  // entre pasos de la misma Escritura). Bajo el modelo actual, la única
  // forma de que la inclusión cambie DESPUÉS de finalizar es el control
  // incluir/excluir mismo — así que la regresión ahora se reformula
  // alrededor de ESE control: la exclusión hecha en una sesión que nunca
  // recargó la página (solo clics de tab) debe reflejarse tanto en la
  // tarjeta compacta del propio paso "Índice" (que ya no desaparece, iter.
  // 6) como en el listado del Índice, no solo en el estado local optimista
  // de este componente.
  test("F: excluding via the Índice step reached by stepper tab clicks (not page.goto) is correctly reflected in the stepper and the índice listing, not just local state", async ({
    page,
  }) => {
    const doc = await createTestDocument(registry, templateOnId, {
      title: `${token} Excluir sin reload`,
      field_values: { "parte.nombre": "Persona Cuatro" },
      rendered_content: "ESCRITURA. Comparece Persona Cuatro.",
    });

    // Un solo `page.goto` inicial: monta el compositor una vez, con la
    // Escritura ya nacida incluida (default=true del Machote). Todo lo
    // demás usa navegación en la app (clics de tab), sin recargar. Finalizar
    // vive en el encabezado del workspace, alcanzable sin cambiar de paso.
    await page.goto(`/documents/${doc.id}`);
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    const finalDialog = page.getByRole("alertdialog", { name: "Finalizar escritura" });
    await expect(finalDialog.getByRole("checkbox")).toHaveCount(0);
    await finalDialog.getByRole("button", { name: "Finalizar escritura" }).click();
    await expect(
      page.getByText("Finalizada", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Clic en el tab del stepper — navegación cliente sobre la MISMA ruta,
    // sin recarga completa. Es el paso donde el bug original reproducía.
    await page.getByRole("tab", { name: "Índice", exact: true }).click();
    const toggle = notarialSection(page).getByLabel("Incluir en el Índice Notarial");
    await expect(toggle).toBeChecked();

    await toggle.click();
    await page
      .getByRole("alertdialog", { name: "¿Excluir esta Escritura del Índice Notarial?" })
      .getByRole("button", { name: "Excluir" })
      .click();

    // Excluir mientras se está parado en "Índice" ya no navega a otro
    // lado (sin recargar) — el paso sigue en el stepper y muestra de
    // inmediato la tarjeta compacta, evidencia de que el cambio llegó al
    // servidor, no solo al estado local optimista de este componente.
    await expect(
      page.getByText("No pertenece al Índice Notarial", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      stepper(page).getByRole("tab", { name: "Índice", exact: true }),
    ).toBeVisible();

    // La exclusión (hecha sin recargar la página del documento) debe
    // reflejarse en el listado separado del Índice.
    await search(page, token);
    await expect(rowFor(page, doc.id)).toHaveCount(0);
  });

  // Caso E del PR: incluida, finalizada, sin authorized_at — sigue siendo
  // localizable en el listado, con el estado explícitamente pendiente, sin
  // inventar una fecha.
  test("E: an included document without authorized_at stays locatable and shows the pending-date message, never an invented date", async ({
    page,
  }) => {
    await setTestDocumentInclusion(toggleId, true);
    await search(page, token);
    await expect(rowFor(page, toggleId)).toBeVisible();
    await expect(
      rowFor(page, toggleId).getByText("Fecha de autorización pendiente"),
    ).toBeVisible();

    await page.goto(`/documents/${toggleId}?section=notarial`);
    await expect(
      notarialSection(page).getByText("Fecha de autorización pendiente"),
    ).toBeVisible();
  });
});
