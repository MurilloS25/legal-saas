import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
  createTestTemplate,
  createTestTemplateField,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";
import { restSelect } from "./support/supabase-api";

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
  // Esperar a que carguen los chunks de JS (hidratación): si `fill` corre
  // mientras React hidrata el <textarea>, el cursor vuelve al inicio y el
  // texto nuevo queda antepuesto al anterior.
  await page.waitForLoadState("networkidle");
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
    await expect(page.getByLabel("Domicilio")).toHaveValue(
      "Heredia, Belén, domicilio editado",
    );
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
      // Valor legacy (canónico anterior): debe abrir y autocompletar como
      // "Casado/a una vez" sin migrar datos.
      marital_status: "Casado/a",
      occupation: "Abogado",
      nationality: "costarricense",
      exact_address: "Heredia, Barva",
    });

    await openClientFromList(page, personName);
    await expect(page.getByLabel("Estado civil")).toHaveValue("Casado/a una vez");

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
    await expect(page.getByLabel("Estado civil")).toHaveValue("Casado/a una vez");
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
    await expect(fieldValue(page, "comprador.estado_civil")).toHaveValue(
      "Casado/a una vez",
    );
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

  test("E: a legacy 'Libre' client opens as 'Unión libre' and saving persists the canonical value", async ({
    page,
  }) => {
    const legacyName = uniqueName("clients-legal-entity", "union-libre");
    const { id } = await createTestClient(registry, {
      full_name: legacyName,
      identification_number: "108880999",
      marital_status: "Libre",
      occupation: "Docente",
      nationality: "costarricense",
      exact_address: "Cartago, Paraíso",
    });

    await openClientFromList(page, legacyName);
    await expect(page.getByLabel("Estado civil")).toHaveValue("Unión libre");

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page).toHaveURL(/\/clients(\?.*)?$/, { timeout: 15_000 });

    const [row] = await restSelect<{ marital_status: string }>(
      `clients?select=marital_status&id=eq.${id}`,
    );
    expect(row.marital_status).toBe("Unión libre");
  });

  test("F: the visible marital status options are the approved canonical list in create, edit and the contextual dialog", async ({
    page,
  }) => {
    const expected = [
      "Soltero/a",
      "Casado/a una vez",
      "Casado/a dos veces",
      "Casado/a tres veces",
      "Divorciado/a",
      "Divorciado/a dos veces",
      "Divorciado/a tres veces",
      "Viudo/a",
      "Unión libre",
    ];
    const visibleOptions = (select: Locator) =>
      select.locator("option:not([disabled])").allTextContents();

    await page.goto("/clients/new");
    expect(await visibleOptions(page.getByLabel("Estado civil"))).toEqual(expected);

    await openClientFromList(page, personName);
    expect(await visibleOptions(page.getByLabel("Estado civil"))).toEqual(expected);

    await page.goto("/receivables/new");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "+ Crear nuevo cliente" }).click();
    const dialog = page.getByRole("dialog", { name: "Crear nuevo cliente" });
    expect(await visibleOptions(dialog.getByLabel("Estado civil"))).toEqual(expected);
  });

  test("G: replacing a persona física with a sociedad in the same role clears the personal data, with confirmation", async ({
    page,
  }) => {
    await page.goto(`/documents/new/${templateId}`);
    await expect(roleChip(page, "Vendedor")).toBeVisible();

    // Primero una persona física en Vendedor: su estado civil llega al rol.
    await completeRoleFromClient(page, "Vendedor", personName);
    await expect(fieldValue(page, "vendedor.estado_civil")).toHaveValue("Casado/a una vez");

    // Después la sociedad en el mismo rol: nunca debe quedar ese estado civil.
    await completeRoleFromClient(page, "Vendedor", companyName);
    const dialog = page.getByRole("alertdialog", { name: "Este rol ya contiene información" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/Se vaciarán porque no aplican a una persona jurídica: vendedor\.estado_civil/),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Reemplazar campos" }).click();

    await expect(fieldValue(page, "vendedor.nombre")).toHaveValue(companyName);
    await expect(fieldValue(page, "vendedor.cedula_juridica")).toHaveValue(companyId);
    await expect(fieldValue(page, "vendedor.estado_civil")).toHaveValue("");
  });

  test("H: the Clientes selector finds a sociedad by cédula jurídica typed without hyphens", async ({
    page,
  }) => {
    await page.goto(`/documents/new/${templateId}`);
    await roleChip(page, "Vendedor").click();
    await roleBlock(page, "Vendedor")
      .getByLabel("Completar desde Cliente registrado")
      .fill(companyId.replace(/-/g, ""));
    const option = page.getByRole("listbox").getByRole("option", { name: new RegExp(companyName) });
    await expect(option).toBeVisible();
    await expect(option).toContainText(`Cédula jurídica: ${companyId}`);
  });

  test("I: a sociedad created from the role's contextual dialog fills any role, keeping hyphens and inventing nothing", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("clients-legal-entity", "poder"),
      content:
        "Comparece {{apoderado.nombre}}, cédula {{apoderado.cedula}}, domiciliada en {{apoderado.domicilio}}, {{apoderado.estado_civil}}, {{apoderado.ocupacion}}.",
    });
    for (const [index, key] of [
      "apoderado.nombre",
      "apoderado.cedula",
      "apoderado.domicilio",
      "apoderado.estado_civil",
      "apoderado.ocupacion",
    ].entries()) {
      await createTestTemplateField(registry, template.id, { field_key: key, label: key, sort_order: index });
    }
    const newCompany = uniqueName("clients-legal-entity", "Nueva S.R.L.");
    const newCompanyId = "3-102-765432";

    await page.goto(`/documents/new/${template.id}`);
    await page.waitForLoadState("networkidle");
    await roleChip(page, "Apoderado").click();
    await roleBlock(page, "Apoderado").getByRole("button", { name: "+ Crear nuevo cliente" }).click();
    const dialog = page.getByRole("dialog", { name: "Crear nuevo cliente" });
    await dialog.getByLabel("Tipo de identificación").selectOption({ label: "Cédula jurídica" });
    await dialog.getByLabel("Razón social").fill(newCompany);
    await dialog.getByLabel("Cédula jurídica").fill(newCompanyId);
    await dialog.getByLabel("Domicilio").fill("Alajuela, centro");
    await dialog.getByRole("button", { name: "Crear cliente" }).click();
    await expect(dialog).toHaveCount(0, { timeout: 15_000 });
    await registerCreatedViaUi(registry, "clients", "full_name", newCompany);

    await expect(fieldValue(page, "apoderado.nombre")).toHaveValue(newCompany);
    await expect(fieldValue(page, "apoderado.cedula")).toHaveValue(newCompanyId);
    await expect(fieldValue(page, "apoderado.domicilio")).toHaveValue("Alajuela, centro");
    await expect(fieldValue(page, "apoderado.estado_civil")).toHaveValue("");
    await expect(fieldValue(page, "apoderado.ocupacion")).toHaveValue("");
    await expect(
      roleBlock(page, "Apoderado").getByText(/No aplican a una persona jurídica/),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Documento", exact: true }).getByText(newCompanyId).first(),
    ).toBeVisible();
  });
});
