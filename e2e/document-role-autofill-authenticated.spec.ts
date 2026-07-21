import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
  createTestTemplate,
  createTestTemplateField,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";

/**
 * "Completar desde Clientes": autollenado automático de roles (`rol.dato`)
 * desde un Cliente registrado, sin exigir configuración manual en el
 * Machote, con selector searchable y reflejo en la previsualización vía la
 * transformación de salida configurada.
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const buyerName = uniqueName("document-role-autofill", "comprador");
const buyerIdentification = "208390123";
const buyerAddress = "San José, Costa Rica — dirección de prueba";
const sellerName = uniqueName("document-role-autofill", "vendedor");
const sellerIdentification = "109870456";
let templateId = "";
let templateName = "";
let documentUrl = "";

function documentRegion(page: Page) {
  return page.getByRole("region", { name: "Documento", exact: true });
}

/**
 * Valor crudo persistido para una variable: el input oculto que el
 * formulario envía en el submit, única fuente de verdad ya que el panel de
 * datos ya no lista los campos uno a uno.
 */
function fieldValue(page: Page, key: string) {
  return page.locator(`input[name="${key}"]`);
}

async function fillInlineField(page: Page, key: string, value: string) {
  await documentRegion(page)
    .locator(`[data-variable-key="${key}"]`)
    .first()
    .click();
  const input = documentRegion(page).locator(`input[data-variable-key="${key}"]`);
  await input.fill(value);
  await input.blur();
}

function partsSection(page: Page) {
  return page.getByRole("region", { name: "Completar desde Clientes" });
}

function roleBlock(page: Page, role: string) {
  return partsSection(page)
    .locator("div")
    .filter({ has: page.getByRole("heading", { name: role, exact: true }) })
    .first();
}

/** Escribe el nombre en el combobox del rol y confirma la primera coincidencia. */
async function completeRoleFromClient(
  page: Page,
  role: string,
  clientName: string,
) {
  const combobox = roleBlock(page, role).getByLabel(
    "Completar desde Cliente registrado",
  );
  await combobox.fill(clientName);
  // Se acota al listbox del combobox: un `<option>` nativo del selector de
  // Cliente principal también expone role="option" y coincidiría igual.
  await expect(
    page.getByRole("listbox").getByRole("option", { name: new RegExp(clientName) }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
}

test.describe("document role autofill", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "document-role-autofill");
  });

  test("A: seed two clients and a template whose fields rely purely on automatic detection", async ({
    page,
  }) => {
    await createTestClient(registry, {
      full_name: buyerName,
      identification_number: buyerIdentification,
      exact_address: buyerAddress,
    });
    await createTestClient(registry, {
      full_name: sellerName,
      identification_number: sellerIdentification,
    });

    const template = await createTestTemplate(registry, {
      name: uniqueName("document-role-autofill", "machote"),
      content:
        "Comparece {{comprador.nombre}}, cédula {{comprador.cedula}}, con domicilio en {{comprador.direccion}}. Vende {{vendedor.nombre_completo}}, cédula {{vendedor.identificacion}}.",
    });
    templateId = template.id;
    templateName = template.name;

    // Ningún campo configura `autofill_source` explícitamente — la
    // detección debe reconocer nombre/cedula/direccion/nombre_completo/
    // identificacion por sí sola.
    await createTestTemplateField(registry, templateId, {
      field_key: "comprador.nombre",
      label: "Comprador - Nombre",
    });
    await createTestTemplateField(registry, templateId, {
      field_key: "comprador.cedula",
      label: "Comprador - Cédula",
      sort_order: 1,
      output_transform: "digits_to_words",
    });
    await createTestTemplateField(registry, templateId, {
      field_key: "comprador.direccion",
      label: "Comprador - Dirección",
      sort_order: 2,
    });
    await createTestTemplateField(registry, templateId, {
      field_key: "vendedor.nombre_completo",
      label: "Vendedor - Nombre completo",
      sort_order: 3,
    });
    await createTestTemplateField(registry, templateId, {
      field_key: "vendedor.identificacion",
      label: "Vendedor - Identificación",
      sort_order: 4,
    });

    void page;
  });

  test("B: the searchable selector completes only the matching role's fields, with the transform reflected in preview", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);
    await expect(
      partsSection(page).getByRole("heading", { name: "Comprador" }),
    ).toBeVisible();
    await expect(
      partsSection(page).getByRole("heading", { name: "Vendedor" }),
    ).toBeVisible();

    await completeRoleFromClient(page, "Comprador", buyerName);

    // Los valores copiados son crudos (sin transformar) y editables.
    await expect(fieldValue(page, "comprador.nombre")).toHaveValue(buyerName);
    await expect(fieldValue(page, "comprador.cedula")).toHaveValue(
      buyerIdentification,
    );
    await expect(fieldValue(page, "comprador.direccion")).toHaveValue(
      buyerAddress,
    );
    // El rol Vendedor no se tocó.
    await expect(fieldValue(page, "vendedor.nombre_completo")).toHaveValue("");
    await expect(fieldValue(page, "vendedor.identificacion")).toHaveValue("");

    // La hoja documental muestra la transformación aplicada en render, no el
    // valor crudo.
    await expect(
      documentRegion(page).getByText(
        "DOS CERO OCHO TRES NUEVE CERO UNO DOS TRES",
      ),
    ).toBeVisible();
    await expect(
      documentRegion(page).getByText(buyerIdentification),
    ).not.toBeVisible();

    // Referencia informativa, sin relación formal.
    await expect(
      roleBlock(page, "Comprador").getByText(
        `Datos copiados desde Cliente: ${buyerName}`,
      ),
    ).toBeVisible();

    // Ahora completa Vendedor con el mismo Cliente usado en Comprador — se
    // permite reutilizar el mismo Cliente en varios roles.
    await completeRoleFromClient(page, "Vendedor", buyerName);
    await expect(fieldValue(page, "vendedor.nombre_completo")).toHaveValue(
      buyerName,
    );
    // Comprador sigue intacto.
    await expect(fieldValue(page, "comprador.nombre")).toHaveValue(buyerName);

    // Completa Vendedor de nuevo, ahora con el segundo Cliente — cada rol
    // funciona de forma independiente y no requiere confirmación porque el
    // valor previo vino del propio autollenado, no de edición manual...
    // salvo que el mensaje de sobrescritura ya se probó en el test D, así
    // que aquí confirmamos directamente el reemplazo.
    await completeRoleFromClient(page, "Vendedor", sellerName);
    await page.getByRole("button", { name: "Reemplazar campos" }).click();
    await expect(fieldValue(page, "vendedor.nombre_completo")).toHaveValue(
      sellerName,
    );
    await expect(fieldValue(page, "vendedor.identificacion")).toHaveValue(
      sellerIdentification,
    );
    // Comprador nunca cambió.
    await expect(fieldValue(page, "comprador.nombre")).toHaveValue(buyerName);

    // Los campos siguen editables tras el autollenado.
    await fillInlineField(page, "comprador.nombre", `${buyerName} (editado)`);
    await expect(fieldValue(page, "comprador.nombre")).toHaveValue(
      `${buyerName} (editado)`,
    );

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/[0-9a-f-]{36}/, {
      timeout: 15_000,
    });
    documentUrl = page.url();
    await registerCreatedViaUi(
      registry,
      "documents",
      "title",
      `${templateName} — Borrador`,
    );
  });

  test("C: values persist after reload, but the visual selection reference does not need to", async ({
    page,
  }) => {
    await page.goto(documentUrl);
    await expect(fieldValue(page, "comprador.nombre")).toHaveValue(
      `${buyerName} (editado)`,
    );
    await expect(fieldValue(page, "comprador.cedula")).toHaveValue(
      buyerIdentification,
    );
    await expect(fieldValue(page, "vendedor.nombre_completo")).toHaveValue(
      sellerName,
    );
    await expect(
      documentRegion(page).getByText(
        "DOS CERO OCHO TRES NUEVE CERO UNO DOS TRES",
      ),
    ).toBeVisible();
  });

  test("D: re-selecting a client on a role that already has values requires confirmation before overwriting", async ({
    page,
  }) => {
    await page.goto(documentUrl);
    await completeRoleFromClient(page, "Comprador", buyerName);

    const dialog = page.getByRole("alertdialog", {
      name: "Este rol ya contiene información",
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/se reemplazarán únicamente los campos/),
    ).toBeVisible();

    // Cancelar no modifica el valor editado manualmente.
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(fieldValue(page, "comprador.nombre")).toHaveValue(
      `${buyerName} (editado)`,
    );

    // Confirmar sí reemplaza los campos mapeados.
    await completeRoleFromClient(page, "Comprador", buyerName);
    await page.getByRole("button", { name: "Reemplazar campos" }).click();
    await expect(fieldValue(page, "comprador.nombre")).toHaveValue(buyerName);
  });

  test("E: 'Limpiar selección' clears only the visual reference, never the copied values", async ({
    page,
  }) => {
    await page.goto(documentUrl);
    await completeRoleFromClient(page, "Comprador", buyerName);
    await page.getByRole("button", { name: "Reemplazar campos" }).click();
    await expect(
      roleBlock(page, "Comprador").getByText(
        `Datos copiados desde Cliente: ${buyerName}`,
      ),
    ).toBeVisible();

    await roleBlock(page, "Comprador")
      .getByRole("button", { name: "Limpiar selección" })
      .click();
    await expect(
      roleBlock(page, "Comprador").getByText(
        `Datos copiados desde Cliente: ${buyerName}`,
      ),
    ).not.toBeVisible();
    // Los valores copiados no se borran.
    await expect(fieldValue(page, "comprador.nombre")).toHaveValue(buyerName);
  });

  test("F: the document's main client selector is unaffected by role autofill", async ({
    page,
  }) => {
    await page.goto(documentUrl);
    await expect(page.getByLabel("Cliente principal")).toHaveValue("");
  });

  test("G: the searchable selector filters by name and by identification number", async ({
    page,
  }) => {
    await page.goto(documentUrl);
    const combobox = roleBlock(page, "Comprador").getByLabel(
      "Completar desde Cliente registrado",
    );

    await combobox.fill(buyerIdentification);
    const listbox = page.getByRole("listbox");
    await expect(
      listbox.getByRole("option", { name: new RegExp(buyerName) }),
    ).toBeVisible();
    await expect(
      listbox.getByRole("option", { name: new RegExp(sellerName) }),
    ).not.toBeVisible();

    await combobox.fill("no existe ningún cliente así");
    await expect(page.getByText("No hay clientes que coincidan.")).toBeVisible();
    await page.keyboard.press("Escape");
  });
});
