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

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

const registry = new CleanupRegistry();

const token = uniqueName("nii", "t").split("-").pop() as string;
const templateName = uniqueName("nii", "machote");

let templateId = "";
let draftId = "";
let excludedId = "";
let toggleId = "";

function notarialSection(page: Page) {
  return page.getByRole("region", { name: "Datos para índice" });
}

function rowFor(page: Page, docId: string): Locator {
  return page
    .locator("tr")
    .filter({ has: page.locator(`a[href="/dashboard/documents/${docId}"]`) });
}

// Los documentos de este spec se finalizan "ahora" (sin authorized_at
// fijo), así que su effective_index_date provisional (created_at) cae en la
// quincena ACTUAL de ejecución, no en una fecha fija — navegar a un período
// hardcodeado los dejaría invisibles en cualquier fecha real distinta.
async function search(page: Page, term: string) {
  const { year, month, half } = currentCostaRicaFortnight();
  await page.goto(
    `/dashboard/notarial-index?year=${year}&month=${month}&half=${half}&search=${encodeURIComponent(term)}`,
  );
  await expect(
    page.getByRole("heading", { name: "Índice notarial", exact: true }),
  ).toBeVisible();
}

test.describe("notarial index inclusion", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "nii");
  });

  test("A: seed a template and a draft document", async () => {
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "ESCRITURA. Comparece {{parte.nombre}}.",
    });
    templateId = template.id;
    await createTestTemplateField(registry, template.id, {
      field_key: "parte.nombre",
      label: "Parte",
      required: true,
    });

    const draft = await createTestDocument(registry, template.id, {
      title: `${token} Borrador`,
      field_values: { "parte.nombre": "Persona Uno" },
      rendered_content: "ESCRITURA. Comparece Persona Uno.",
    });
    draftId = draft.id;
  });

  // Caso A del PR: un borrador nunca aparece en el Índice, sin importar el
  // valor por defecto de include_in_notarial_index.
  test("B: the finalize checkbox defaults to checked and includes the document once finalized", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/${draftId}?section=revisar`);
    const dialogTrigger = page.getByRole("button", { name: "Finalizar escritura" });
    await dialogTrigger.click();

    const dialog = page.getByRole("alertdialog", { name: "Finalizar escritura" });
    const checkbox = dialog.getByRole("checkbox", {
      name: /Incluir en el Índice Notarial/,
    });
    await expect(checkbox).toBeChecked();
    await expect(
      dialog.getByText(/aparecerá en el Índice Notarial al finalizar/),
    ).toBeVisible();

    await dialog.getByRole("button", { name: "Finalizar escritura" }).click();
    await expect(
      page.getByText("Finalizada", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });

    await search(page, token);
    await expect(rowFor(page, draftId)).toBeVisible();
  });

  // Caso B del PR: desmarcar la casilla al finalizar mantiene la Escritura
  // finalizada pero fuera del universo del Índice.
  test("C: unchecking the box at finalize excludes the document from the index while it stays finalized", async ({
    page,
  }) => {
    const doc = await createTestDocument(registry, templateId, {
      title: `${token} Excluida al finalizar`,
      field_values: { "parte.nombre": "Persona Dos" },
      rendered_content: "ESCRITURA. Comparece Persona Dos.",
    });
    excludedId = doc.id;

    await page.goto(`/dashboard/documents/${excludedId}?section=revisar`);
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Finalizar escritura" });
    await dialog
      .getByRole("checkbox", { name: /Incluir en el Índice Notarial/ })
      .uncheck();
    await dialog.getByRole("button", { name: "Finalizar escritura" }).click();
    await expect(
      page.getByText("Finalizada", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });

    await search(page, token);
    await expect(rowFor(page, excludedId)).toHaveCount(0);

    // La escritura sigue finalizada — excluirla del Índice no la reabre.
    await page.goto(`/dashboard/documents/${excludedId}?section=revisar`);
    await expect(
      page.getByText("Finalizada", { exact: true }).first(),
    ).toBeVisible();
  });

  // Casos G/H del PR original, y C/D del bug de estado obsoleto reportado
  // en revisión de #184: corrección posterior desde el paso Índice, sin
  // pasar por una pantalla nueva — un control discreto dentro de la misma
  // sección, con confirmación vía el `ConfirmDialog` propio (no
  // `window.confirm`) y que sobrevive un refresh completo, no solo la
  // actualización optimista en memoria.
  test("D: the Índice step lets a finalized document be excluded and re-included later, surviving a reload", async ({
    page,
  }) => {
    const doc = await createTestDocument(registry, templateId, {
      title: `${token} Alternar después`,
      field_values: { "parte.nombre": "Persona Tres" },
      rendered_content: "ESCRITURA. Comparece Persona Tres.",
    });
    toggleId = doc.id;
    await setTestDocumentStatus(toggleId, "final");

    await search(page, token);
    await expect(rowFor(page, toggleId)).toBeVisible();

    await page.goto(`/dashboard/documents/${toggleId}?section=notarial`);
    const section = notarialSection(page);
    const toggle = section.getByLabel("Incluir en el Índice Notarial");
    await expect(toggle).toBeChecked();

    // Caso C: incluida → excluir → desmarcado de inmediato (sin reload) →
    // sigue desmarcado tras un refresh completo (no solo optimista).
    await toggle.click();
    await page
      .getByRole("alertdialog", { name: "¿Excluir esta Escritura del Índice Notarial?" })
      .getByRole("button", { name: "Excluir" })
      .click();
    await expect(toggle).not.toBeChecked({ timeout: 15_000 });
    await expect(
      section.getByText(/está excluida del Índice Notarial/),
    ).toBeVisible({ timeout: 15_000 });

    await search(page, token);
    await expect(rowFor(page, toggleId)).toHaveCount(0);

    await page.goto(`/dashboard/documents/${toggleId}?section=notarial`);
    await expect(notarialSection(page)).toBeVisible();
    await expect(notarialSection(page).getByLabel("Incluir en el Índice Notarial")).not.toBeChecked();

    // Caso D: excluida → volver a incluir → marcado de inmediato → sigue
    // marcado tras un refresh completo.
    const reincludeToggle = notarialSection(page).getByLabel(
      "Incluir en el Índice Notarial",
    );
    await reincludeToggle.click();
    await page
      .getByRole("alertdialog", { name: "¿Incluir esta Escritura en el Índice Notarial?" })
      .getByRole("button", { name: "Incluir" })
      .click();
    await expect(reincludeToggle).toBeChecked({ timeout: 15_000 });
    await expect(
      notarialSection(page).getByText(/aparece en el Índice Notarial/),
    ).toBeVisible({ timeout: 15_000 });

    await search(page, token);
    await expect(rowFor(page, toggleId)).toBeVisible();

    await page.goto(`/dashboard/documents/${toggleId}?section=notarial`);
    await expect(notarialSection(page)).toBeVisible();
    await expect(notarialSection(page).getByLabel("Incluir en el Índice Notarial")).toBeChecked();
  });

  // Bug real encontrado en revisión manual de #184: el checkbox del paso
  // Índice mostraba `true` aunque `documents.include_in_notarial_index`
  // fuera `false`, porque `NotarialMetadataSection` no se desmonta al
  // navegar entre pasos de la misma Escritura (mismo route [id], solo
  // cambian los searchParams) — `useState(includeInNotarialIndex)` solo
  // capturaba el prop del primer montaje. Se reproduce navegando por los
  // tabs del stepper (clic real, no `page.goto`), que es exactamente el
  // caso que NO desmonta el componente y por eso no lo detectaban los
  // demás tests de este archivo (todos usan `page.goto`, que sí fuerza un
  // remount y enmascaraba el bug).
  test("F: the Índice toggle reflects the real persisted value after finalizing, navigated via the stepper tabs (not page.goto)", async ({
    page,
  }) => {
    const doc = await createTestDocument(registry, templateId, {
      title: `${token} Stepper sin reload`,
      field_values: { "parte.nombre": "Persona Cuatro" },
      rendered_content: "ESCRITURA. Comparece Persona Cuatro.",
    });

    // Un solo `page.goto` inicial: monta el compositor una vez, mientras
    // el documento sigue en borrador (include_in_notarial_index = true por
    // default en esa fila). Todo lo demás usa navegación en la app.
    await page.goto(`/dashboard/documents/${doc.id}`);
    await page.getByRole("tab", { name: "Revisar y finalizar" }).click();
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    const finalDialog = page.getByRole("alertdialog", { name: "Finalizar escritura" });
    await finalDialog
      .getByRole("checkbox", { name: /Incluir en el Índice Notarial/ })
      .uncheck();
    await finalDialog.getByRole("button", { name: "Finalizar escritura" }).click();
    await expect(
      page.getByText("Finalizada", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Clic en el tab del stepper — navegación cliente sobre la MISMA ruta,
    // sin recarga completa. Es el paso donde el bug reproducía.
    await page.getByRole("tab", { name: "Índice", exact: true }).click();
    const toggle = notarialSection(page).getByLabel("Incluir en el Índice Notarial");
    await expect(toggle).not.toBeChecked();
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

    await page.goto(`/dashboard/documents/${toggleId}?section=notarial`);
    await expect(
      notarialSection(page).getByText("Fecha de autorización pendiente"),
    ).toBeVisible();
  });
});
