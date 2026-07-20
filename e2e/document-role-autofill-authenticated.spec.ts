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
 * Autollenado de roles (`rol.dato`) desde un Cliente registrado en la
 * Escritura, y su reflejo en la previsualización vía la transformación de
 * salida configurada.
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const clientName = uniqueName("document-role-autofill", "cliente");
const clientIdentification = "208390123";
const clientAddress = "San José, Costa Rica — dirección de prueba";
let clientId = "";
let templateId = "";
let templateName = "";
let documentUrl = "";

function documentRegion(page: Page) {
  return page.getByRole("region", { name: "Documento" });
}

function panelField(page: Page, label: string | RegExp) {
  return page
    .getByRole("region", { name: "Datos de la escritura" })
    .getByLabel(label);
}

function roleAutofillSection(page: Page) {
  return page.getByRole("region", { name: "Autollenado por rol" });
}

test.describe("document role autofill", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "document-role-autofill");
  });

  test("A: seed a client and a template with role-configured variables", async ({
    page,
  }) => {
    const client = await createTestClient(registry, {
      full_name: clientName,
      identification_number: clientIdentification,
      exact_address: clientAddress,
    });
    clientId = client.id;

    const template = await createTestTemplate(registry, {
      name: uniqueName("document-role-autofill", "machote"),
      content:
        "Comparece {{comprador.nombre}}, cédula {{comprador.cedula}}, con domicilio en {{comprador.direccion}}.",
    });
    templateId = template.id;
    templateName = template.name;

    await createTestTemplateField(registry, templateId, {
      field_key: "comprador.nombre",
      label: "Comprador - Nombre",
      autofill_source: "client_full_name",
    });
    await createTestTemplateField(registry, templateId, {
      field_key: "comprador.cedula",
      label: "Comprador - Cédula",
      sort_order: 1,
      autofill_source: "client_identification",
      output_transform: "digits_to_words",
    });
    await createTestTemplateField(registry, templateId, {
      field_key: "comprador.direccion",
      label: "Comprador - Dirección",
      sort_order: 2,
      autofill_source: "client_address",
    });

    void page;
  });

  test("B: selecting a client in the role block copies its data, editable, with the transform reflected in preview", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/new/${templateId}`);
    await expect(panelField(page, "Comprador - Nombre")).toBeVisible();

    const section = roleAutofillSection(page);
    await expect(section.getByRole("heading", { name: "Comprador" })).toBeVisible();
    await section.getByLabel("Completar desde Cliente registrado").selectOption(
      clientId,
    );

    // Los valores copiados son crudos (sin transformar) y editables.
    await expect(panelField(page, "Comprador - Nombre")).toHaveValue(clientName);
    await expect(panelField(page, "Comprador - Cédula")).toHaveValue(
      clientIdentification,
    );
    await expect(panelField(page, "Comprador - Dirección")).toHaveValue(
      clientAddress,
    );

    // La hoja documental muestra la transformación aplicada en render, no el
    // valor crudo.
    await expect(
      documentRegion(page).getByText(
        "DOS CERO OCHO TRES NUEVE CERO UNO DOS TRES",
      ),
    ).toBeVisible();
    await expect(
      documentRegion(page).getByText(clientIdentification),
    ).not.toBeVisible();

    // Referencia informativa, sin relación formal.
    await expect(
      section.getByText(`Datos copiados desde: ${clientName}`),
    ).toBeVisible();

    // Los campos siguen editables tras el autollenado.
    await panelField(page, "Comprador - Nombre").fill(`${clientName} (editado)`);
    await expect(panelField(page, "Comprador - Nombre")).toHaveValue(
      `${clientName} (editado)`,
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

  test("C: values and the transformed preview persist after reload", async ({
    page,
  }) => {
    await page.goto(documentUrl);
    await expect(panelField(page, "Comprador - Nombre")).toHaveValue(
      `${clientName} (editado)`,
    );
    await expect(panelField(page, "Comprador - Cédula")).toHaveValue(
      clientIdentification,
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
    const section = roleAutofillSection(page);
    await section.getByLabel("Completar desde Cliente registrado").selectOption(
      clientId,
    );

    const dialog = page.getByRole("alertdialog", {
      name: "Este rol ya tiene información",
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/reemplazar los campos disponibles/),
    ).toBeVisible();

    // Cancelar no modifica el valor editado manualmente.
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(panelField(page, "Comprador - Nombre")).toHaveValue(
      `${clientName} (editado)`,
    );

    // Confirmar sí reemplaza los campos mapeados.
    await section.getByLabel("Completar desde Cliente registrado").selectOption(
      clientId,
    );
    await page.getByRole("button", { name: "Reemplazar" }).click();
    await expect(panelField(page, "Comprador - Nombre")).toHaveValue(clientName);
  });

  test("E: the document's main client selector is unaffected by role autofill", async ({
    page,
  }) => {
    await page.goto(documentUrl);
    await expect(page.getByLabel("Cliente principal")).toHaveValue("");
  });
});
