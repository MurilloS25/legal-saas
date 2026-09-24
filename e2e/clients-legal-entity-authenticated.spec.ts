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
 * Clientes persona jurídica (sociedades) y autollenado completo del
 * Cliente hacia las Partes de una Escritura: estado civil y ocupación para
 * persona física; razón social, cédula jurídica (con guiones) y domicilio
 * para una sociedad, sin inventar datos personales.
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

const companyName = uniqueName("clients-legal-entity", "Sociedad Anónima");
const companyId = "3-101-123456";
const personName = uniqueName("clients-legal-entity", "persona");
let companyUrl = "";
let templateId = "";

async function openClientFromList(page: Page, name: string) {
  await page.goto("/clients");
  const link = page.getByRole("link").filter({ hasText: name }).first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  await page.goto(href!);
  await expect(page).toHaveURL(/\/clients\/(?!new)[^/]+$/);
  return page.url();
}

function fieldValue(page: Page, key: string) {
  return page.locator(`input[name="${key}"]`);
}

function roleChip(page: Page, role: string) {
  return page
    .getByRole("region", { name: "Cliente principal y Partes" })
    .getByRole("button", { name: new RegExp(`^${role}\\b`) });
}

function roleBlock(page: Page, role: string) {
  return page.getByRole("dialog", { name: new RegExp(`Completar ${role} `) });
}

async function completeRoleFromClient(page: Page, role: string, clientName: string) {
  const dialog = roleBlock(page, role);
  if (!(await dialog.isVisible())) {
    await roleChip(page, role).click();
    await expect(dialog).toBeVisible();
  }
  await dialog.getByLabel("Completar desde Cliente registrado").fill(clientName);
  await expect(
    page.getByRole("listbox").getByRole("option", { name: new RegExp(clientName) }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
}

async function closeRolePopover(page: Page, role: string) {
  const dialog = roleBlock(page, role);
  if (!(await dialog.isVisible())) return;
  await roleChip(page, role).click();
  await expect(dialog).toBeHidden();
}

test.describe("clients — persona jurídica", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "clients-legal-entity");
  });

  test("A: a sociedad is created without personal fields and keeps the cédula jurídica hyphens", async ({
    page,
  }) => {
    await page.goto("/clients/new");

    // Persona física por defecto: campos personales visibles.
    await expect(page.getByLabel("Estado civil")).toBeVisible();

    await page
      .getByLabel("Tipo de identificación")
      .selectOption({ label: "Cédula jurídica" });

    await expect(page.getByLabel("Estado civil")).toBeHidden();
    await expect(page.getByLabel("Ocupación")).toBeHidden();
    await expect(page.getByLabel("Nacionalidad")).toBeHidden();

    await page.getByLabel("Razón social").fill(companyName);
    await page.getByLabel("Cédula jurídica").fill(companyId);
    await page.getByLabel("Domicilio").fill("San José, Escazú, oficentro de prueba");
    await page.getByRole("button", { name: "Crear cliente" }).click();

    await expect(page).toHaveURL(/\/clients(\?.*)?$/, { timeout: 15_000 });
    await registerCreatedViaUi(registry, "clients", "full_name", companyName);

    const row = page.getByRole("row").filter({ hasText: companyName });
    await expect(row).toContainText(companyId);
    await expect(row).toContainText("Persona jurídica");
  });

  test("B: editing a sociedad preserves the exact cédula jurídica format", async ({
    page,
  }) => {
    companyUrl = await openClientFromList(page, companyName);

    await expect(page.getByLabel("Tipo de identificación")).toHaveValue(
      "cedula_juridica",
    );
    await expect(page.getByLabel("Cédula jurídica")).toHaveValue(companyId);
    await expect(page.getByLabel("Estado civil")).toBeHidden();

    await page.getByLabel("Domicilio").fill("Heredia, Belén, domicilio editado");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page).toHaveURL(/\/clients(\?.*)?$/, { timeout: 15_000 });

    await page.goto(companyUrl);
    await expect(page.getByLabel("Cédula jurídica")).toHaveValue(companyId);
    await expect(page.getByLabel("Domicilio")).toHaveValue(
      "Heredia, Belén, domicilio editado",
    );
  });

  test("C: switching a persona física to jurídica warns and never loses typed data silently", async ({
    page,
  }) => {
    await createTestClient(registry, {
      full_name: personName,
      identification_number: "108880777",
      marital_status: "Casado/a",
      occupation: "Abogado",
      nationality: "costarricense",
      exact_address: "Heredia, Barva",
    });

    await openClientFromList(page, personName);
    await expect(page.getByLabel("Estado civil")).toHaveValue("Casado/a");

    await page
      .getByLabel("Tipo de identificación")
      .selectOption({ label: "Cédula jurídica" });
    await expect(
      page.getByRole("status").filter({ hasText: "se eliminarán" }),
    ).toBeVisible();

    // Volver a física antes de guardar conserva lo que había.
    await page
      .getByLabel("Tipo de identificación")
      .selectOption({ label: "Cédula física" });
    await expect(page.getByLabel("Estado civil")).toHaveValue("Casado/a");
    await expect(page.getByLabel("Ocupación")).toHaveValue("Abogado");
    await expect(
      page.getByRole("status").filter({ hasText: "se eliminarán" }),
    ).toHaveCount(0);
  });

  test("D: selecting clients as Partes fills estado civil/ocupación for a persona física and only razón social, cédula and domicilio for a sociedad", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("clients-legal-entity", "machote"),
      content:
        "Comparece {{comprador.nombre}}, cédula {{comprador.cedula}}, {{comprador.estado_civil}}, {{comprador.ocupacion}}, vecino de {{comprador.direccion}}. Vende {{vendedor.nombre}}, cédula jurídica {{vendedor.cedula_juridica}}, domiciliada en {{vendedor.domicilio}}, estado civil {{vendedor.estado_civil}}.",
    });
    templateId = template.id;
    const keys = [
      "comprador.nombre",
      "comprador.cedula",
      "comprador.estado_civil",
      "comprador.ocupacion",
      "comprador.direccion",
      "vendedor.nombre",
      "vendedor.cedula_juridica",
      "vendedor.domicilio",
      "vendedor.estado_civil",
    ];
    for (const [index, key] of keys.entries()) {
      await createTestTemplateField(registry, templateId, {
        field_key: key,
        label: key,
        sort_order: index,
      });
    }

    await page.goto(`/documents/new/${templateId}`);
    await expect(roleChip(page, "Comprador")).toBeVisible();

    await completeRoleFromClient(page, "Comprador", personName);
    await expect(fieldValue(page, "comprador.nombre")).toHaveValue(personName);
    await expect(fieldValue(page, "comprador.cedula")).toHaveValue("108880777");
    await expect(fieldValue(page, "comprador.estado_civil")).toHaveValue("Casado/a");
    await expect(fieldValue(page, "comprador.ocupacion")).toHaveValue("Abogado");
    await expect(fieldValue(page, "comprador.direccion")).toHaveValue("Heredia, Barva");
    await closeRolePopover(page, "Comprador");

    await completeRoleFromClient(page, "Vendedor", companyName);
    await expect(fieldValue(page, "vendedor.nombre")).toHaveValue(companyName);
    await expect(fieldValue(page, "vendedor.cedula_juridica")).toHaveValue(companyId);
    await expect(fieldValue(page, "vendedor.domicilio")).toHaveValue(
      "Heredia, Belén, domicilio editado",
    );
    // No se inventa un estado civil para la sociedad.
    await expect(fieldValue(page, "vendedor.estado_civil")).toHaveValue("");
    await expect(
      roleBlock(page, "Vendedor").getByText(/No aplican a una persona jurídica/),
    ).toBeVisible();

    // La cédula jurídica llega al documento con sus guiones.
    await expect(
      page.getByRole("region", { name: "Documento", exact: true }).getByText(companyId).first(),
    ).toBeVisible();
  });
});
