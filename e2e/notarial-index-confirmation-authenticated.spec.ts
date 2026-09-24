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

const templateName = uniqueName("nic", "machote");
const instrumentNumber = 300_000 + Math.floor(Math.random() * 90_000);
let docId = "";

function notarialSection(page: Page) {
  return page.getByRole("region", { name: "Datos para índice" });
}

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

// "document" (paso "Completar", default) sirve tanto para ver la hoja
// documental como para Reabrir/Finalizar — ambos viven en el encabezado
// del workspace, visible sin importar la sección activa. Ya no existe un
// paso "Revisar y finalizar" al que navegar aparte.
async function open(page: Page, section: "document" | "notarial" = "notarial") {
  await page.goto(
    section === "notarial"
      ? `/documents/${docId}?section=notarial`
      : `/documents/${docId}`,
  );
  if (section === "notarial") await expect(notarialSection(page)).toBeVisible();
}

async function fillCompleteMetadata(page: Page) {
  const section = notarialSection(page);
  await openIndexRow(page, "Número de instrumento");
  await section
    .getByLabel("Número de instrumento", { exact: true })
    .fill(String(instrumentNumber));
  await openIndexRow(page, "Fecha y hora de autorización");
  await section.getByLabel("Fecha de autorización", { exact: true }).fill("2026-07-13");
  await section.getByLabel("Hora de autorización", { exact: true }).fill("10:35");
  await openIndexRow(page, "Acto o contrato");
  await section.getByLabel("Acto o contrato", { exact: true }).fill("Compraventa");
  await openIndexRow(page, "Tomo");
  await section.getByLabel("Tomo", { exact: true }).fill("08");
  await openIndexRow(page, "Folios");
  await section.getByLabel("Folio inicial", { exact: true }).fill("23F");
  await section.getByLabel("Folio final", { exact: true }).fill("23V");
  await openIndexRow(page, "Partes");
  await section.getByLabel("Partes", { exact: true }).fill("PERSONA UNO Y PERSONA DOS");
}

test.describe("notarial index confirmation lifecycle", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "nic");
  });

  test("A: seed a finalized document; partial save stays Pendiente", async ({ page }) => {
    const template = await createTestTemplate(registry, {
      name: templateName,
      content: "ESCRITURA. Comparece {{parte.nombre}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "parte.nombre",
      label: "Parte",
      required: true,
    });
    const doc = await createTestDocument(registry, template.id, {
      title: uniqueName("nic", "escritura"),
      status: "final",
      field_values: { "parte.nombre": "Persona Uno" },
      rendered_content: "ESCRITURA. Comparece Persona Uno.",
    });
    docId = doc.id;

    await open(page, "notarial");
    await expect(
      notarialSection(page).getByText(/Estado de los datos del Índice: Pendiente/),
    ).toBeVisible();
    await expect(
      page.locator("[data-workspace-action-dock]").getByRole("button", { name: "Confirmar Índice" }),
    ).toHaveCount(0);

    await openIndexRow(page, "Número de instrumento");
    await notarialSection(page)
      .getByLabel("Número de instrumento", { exact: true })
      .fill(String(instrumentNumber));
    await page.locator("[data-workspace-action-dock]").getByRole("button", { name: "Guardar", exact: true })
      .click();
    await expect(
      page.getByText("Cambios del índice guardados.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      notarialSection(page).getByText(/Estado de los datos del Índice: Pendiente/),
    ).toBeVisible();
  });

  test("B: completing all fields moves to Listo para confirmar", async ({ page }) => {
    await open(page, "notarial");
    await fillCompleteMetadata(page);
    await page.locator("[data-workspace-action-dock]").getByRole("button", { name: "Guardar", exact: true })
      .click();
    await expect(
      page.getByText("Datos del índice completos.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      notarialSection(page).getByText(/Estado de los datos del Índice: Listo para confirmar/),
    ).toBeVisible();
    await expect(
      page.locator("[data-workspace-action-dock]").getByRole("button", { name: "Confirmar Índice" }),
    ).toBeVisible();
  });

  test("C: confirming shows the dialog, locks fields, checks the stepper", async ({ page }) => {
    await open(page, "notarial");
    await page.locator("[data-workspace-action-dock]").getByRole("button", { name: "Confirmar Índice" })
      .click();

    const dialog = page.getByRole("alertdialog", { name: "¿Confirmar Índice?" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/quedarán bloqueados para edición normal/),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Confirmar Índice" }).click();

    await expect(
      page.getByText("Datos del Índice confirmados.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      notarialSection(page).getByText("Datos del Índice confirmados", { exact: true }),
    ).toBeVisible();

    // Campos bloqueados — el botón "Guardar" desaparece, "Corregir datos" aparece.
    await expect(
      page.locator("[data-workspace-action-dock]").getByRole("button", { name: "Guardar", exact: true }),
    ).toHaveCount(0);
    await expect(
      notarialSection(page).getByRole("button", { name: "Corregir datos" }),
    ).toBeVisible();
    await openIndexRow(page, "Tomo");
    await expect(
      notarialSection(page).getByLabel("Tomo", { exact: true }),
    ).toBeDisabled();

    // El check del stepper representa "confirmado", no solo completo — el
    // encabezado (y su stepper) es el mismo sin importar la sección activa,
    // pero el paso activo nunca muestra su propio check (convención
    // existente del stepper): hay que mirarlo desde otro paso.
    const stepper = page.getByRole("navigation", { name: "Pasos de la escritura" });
    await open(page, "document");
    await expect(
      stepper.getByRole("tab", { name: "Índice", exact: true }).getByText("✓", { exact: true }),
    ).toBeVisible();
  });

  test("E: correcting unlocks fields, preserves values, moves to Revisión requerida", async ({
    page,
  }) => {
    await open(page, "notarial");
    await notarialSection(page)
      .getByRole("button", { name: "Corregir datos" })
      .click();

    const dialog = page.getByRole("alertdialog", { name: "¿Corregir datos del Índice?" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/deberás confirmarlos nuevamente al terminar/),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Corregir datos" }).click();

    await expect(
      page.getByText("Corrección de datos del Índice iniciada.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      notarialSection(page).getByText(/Estado de los datos del Índice: Revisión requerida/),
    ).toBeVisible();

    // Editable de nuevo, y el valor previo se conservó (no se borró nada).
    await openIndexRow(page, "Tomo");
    const tomoInput = notarialSection(page).getByLabel("Tomo", { exact: true });
    await expect(tomoInput).toBeEnabled();
    await expect(tomoInput).toHaveValue("08");
    // El dock es el único Guardar: sin cambios queda deshabilitado y lo que
    // falta es volver a confirmar; en cuanto se edita algo, Guardar se
    // habilita y Confirmar Índice deja de ofrecerse.
    const save = page.locator("[data-workspace-action-dock]").getByRole("button", { name: "Guardar", exact: true });
    const confirm = page.locator("[data-workspace-action-dock]").getByRole("button", { name: "Confirmar Índice" });
    await expect(confirm).toBeVisible();
    await expect(save).toBeDisabled();
    await tomoInput.fill("09");
    await expect(save).toBeEnabled();
    await expect(confirm).toHaveCount(0);
    await tomoInput.fill("08");
    await expect(confirm).toBeVisible();

    // El check del stepper desaparece: ya no está confirmado.
    const stepper = page.getByRole("navigation", { name: "Pasos de la escritura" });
    await expect(
      stepper.getByRole("tab", { name: "Índice", exact: true }).getByText("✓", { exact: true }),
    ).toHaveCount(0);
  });

  test("F: reconfirming after a correction returns to Confirmado", async ({ page }) => {
    await open(page, "notarial");
    await page.locator("[data-workspace-action-dock]").getByRole("button", { name: "Confirmar Índice" })
      .click();
    await page
      .getByRole("alertdialog", { name: "¿Confirmar Índice?" })
      .getByRole("button", { name: "Confirmar Índice" })
      .click();
    await expect(
      notarialSection(page).getByText("Datos del Índice confirmados", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("G: reopening invalidates the confirmation without deleting metadata", async ({
    page,
  }) => {
    await open(page, "document");
    await page.getByRole("button", { name: "Reabrir escritura" }).click();
    const dialog = page.getByRole("alertdialog", { name: "¿Reabrir la escritura?" });
    await expect(
      dialog.getByText(/confirmación de sus datos del Índice quedará invalidada/),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Reabrir escritura" }).click();
    await expect(
      page.getByText("Borrador", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("H: re-finalizing keeps Revisión requerida — no automatic reconfirmation", async ({
    page,
  }) => {
    await open(page, "document");
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Finalizar escritura" });
    await dialog.getByRole("button", { name: "Finalizar escritura" }).click();
    await expect(
      page.getByText("Finalizada", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });

    await open(page, "notarial");
    await expect(
      notarialSection(page).getByText(/Estado de los datos del Índice: Revisión requerida/),
    ).toBeVisible();
    // Los valores siguen ahí, tal como quedaron antes de reabrir.
    await openIndexRow(page, "Tomo");
    await expect(
      notarialSection(page).getByLabel("Tomo", { exact: true }),
    ).toHaveValue("08");

    const stepper = page.getByRole("navigation", { name: "Pasos de la escritura" });
    await expect(
      stepper.getByRole("tab", { name: "Índice", exact: true }).getByText("✓", { exact: true }),
    ).toHaveCount(0);
  });
});
