import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  createDisposableUser,
  deleteUser,
  restDelete,
  restInsert,
  restSelect,
} from "./support/supabase-admin";

// Cierra la deuda de UX por permisos identificada tras el gating superficial
// de listas/botones de creación (ver PR de "gate create/edit UI by role"):
// Machotes (Tiptap), Escrituras (compositor + ciclo de vida), Índice
// Notarial (exportar) y Cuentas por cobrar (formulario + pagos) seguían
// mostrando controles de escritura completos a roles sin permiso, aunque
// RLS ya rechazaba la escritura real en todos los casos (verificado
// empíricamente antes de este trabajo). Este spec cubre visualmente los
// tres roles relevantes — propietario (todo), asistente (escritura básica
// sin finalizar/anular/generar índice), solo_lectura (nada de escritura) —
// y confirma, para cada módulo, que una solicitud manipulada (formulario
// reactivado a mano vía DOM, o una llamada directa al endpoint) sigue
// siendo rechazada por el servidor, no solo ocultada en la UI.
//
// Autocontenido: crea su propio propietario + dos miembros (asistente,
// solo_lectura) directamente como filas de workspace_members (sin pasar
// por el flujo de invitación por correo, que ya tiene su propia cobertura
// dedicada en team-management-authenticated.spec.ts), y sus propios
// machote/cliente/escritura/cuenta de prueba vía REST con la service role
// key — igual que sample data. La ACCIÓN bajo prueba en cada caso sí pasa
// siempre por la app real.
test.setTimeout(180_000);

const PASSWORD = "Segura!DePrueba9";

function uniqueEmail(label: string): string {
  return `e2e-deep-gating-${label}-${randomUUID()}@example.com`;
}

async function loginAndExpectDashboard(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  // Cambiar de identidad en la MISMA página requiere cerrar la sesión
  // anterior primero — de lo contrario proxy.ts redirige /login a
  // /dashboard (isAuthRoute + sesión activa) y el formulario nunca
  // aparece. Limpiar cookies es más confiable que depender del botón
  // "Cerrar sesión" (que no siempre está montado en cada página).
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await page.getByRole("navigation", { name: "Navegación principal" }).waitFor();
}

test.describe("deep permission gating (propietario / asistente / solo_lectura)", () => {
  test.describe.configure({ mode: "serial" });

  const ownerEmail = uniqueEmail("owner");
  const assistantEmail = uniqueEmail("assistant");
  const readerEmail = uniqueEmail("reader");
  let ownerId: string;
  let assistantId: string;
  let readerId: string;

  let templateId: string;
  let clientId: string;
  let documentId: string;
  let secondDocumentId: string;
  let receivableId: string;

  test.beforeAll(async () => {
    ownerId = await createDisposableUser(ownerEmail, PASSWORD);
    assistantId = await createDisposableUser(assistantEmail, PASSWORD);
    readerId = await createDisposableUser(readerEmail, PASSWORD);

    await restInsert("workspace_members", {
      workspace_id: ownerId,
      user_id: assistantId,
      role: "asistente",
      status: "active",
      invited_by: ownerId,
    });
    await restInsert("workspace_members", {
      workspace_id: ownerId,
      user_id: readerId,
      role: "solo_lectura",
      status: "active",
      invited_by: ownerId,
    });

    const template = await restInsert<{ id: string }>("templates", {
      owner_id: ownerId,
      name: `Machote gating ${randomUUID().slice(0, 8)}`,
      status: "active",
      content_json: { text: "Contenido de prueba." },
      text_preview: "Contenido de prueba.",
    });
    templateId = template.id;

    const client = await restInsert<{ id: string }>("clients", {
      owner_id: ownerId,
      full_name: "Cliente Gating Profundo",
      identification_type: "cedula_fisica",
      identification_number: "111110000",
      marital_status: "soltero",
      nationality: "costarricense",
      occupation: "Prueba",
      exact_address: "San José, Costa Rica",
    });
    clientId = client.id;

    const document = await restInsert<{ id: string }>("documents", {
      owner_id: ownerId,
      template_id: templateId,
      client_id: clientId,
      title: "Escritura gating profundo",
      status: "draft",
      field_values: {},
      rendered_content: "Contenido de prueba.",
    });
    documentId = document.id;

    const secondDocument = await restInsert<{ id: string }>("documents", {
      owner_id: ownerId,
      template_id: templateId,
      client_id: clientId,
      title: "Escritura gating profundo (finalizar)",
      status: "draft",
      field_values: {},
      rendered_content: "Contenido de prueba.",
    });
    secondDocumentId = secondDocument.id;

    const receivable = await restInsert<{ id: string }>("receivables", {
      owner_id: ownerId,
      client_id: clientId,
      concept: "Honorarios de prueba",
      currency: "CRC",
      amount_total: "100000.00",
      issued_at: "2026-07-13",
    });
    receivableId = receivable.id;

    await restInsert("receivable_payments", {
      owner_id: ownerId,
      receivable_id: receivableId,
      amount: "20000.00",
      currency: "CRC",
      paid_at: "2026-07-14",
      method: "cash",
    });
  });

  test.afterAll(async () => {
    await restDelete("receivable_payments", `receivable_id=eq.${receivableId}`);
    await restDelete("receivables", `id=eq.${receivableId}`);
    await restDelete("documents", `id=eq.${documentId}`);
    await restDelete("documents", `id=eq.${secondDocumentId}`);
    await restDelete("clients", `id=eq.${clientId}`);
    await restDelete("templates", `id=eq.${templateId}`);
    await restDelete("workspace_activity", `workspace_id=eq.${ownerId}`);
    await deleteUser(assistantId);
    await deleteUser(readerId);
    await deleteUser(ownerId);
  });

  // ================= Machotes =================

  test("Machote: propietario y asistente pueden editar; solo_lectura lo ve de solo lectura y un envío manipulado del DOM es rechazado por el servidor", async ({
    page,
  }) => {
    await loginAndExpectDashboard(page, readerEmail, PASSWORD);
    await page.goto(`/dashboard/templates/${templateId}`);

    await expect(
      page.getByText("Tu rol no permite editar machotes"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Negrita" })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Insertar variable" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: /^Guardar cambios$/ }),
    ).not.toBeVisible();

    // Solicitud manipulada: reactiva el campo "Nombre" a mano vía DOM (como
    // haría alguien inspeccionando/editando el HTML) y fuerza el envío. El
    // servidor debe rechazarlo igual — RLS exige templates.write.
    const nameInput = page.getByLabel("Nombre del machote");
    await nameInput.evaluate((el: HTMLInputElement) => {
      el.disabled = false;
    });
    await nameInput.fill("Nombre manipulado por DOM");
    await page.evaluate(() => {
      document.querySelector("form")?.requestSubmit();
    });
    await page.waitForTimeout(1000);

    const rows = await restSelect<{ name: string }>(
      "templates",
      `id=eq.${templateId}&select=name`,
    );
    expect(rows[0].name).not.toBe("Nombre manipulado por DOM");

    await loginAndExpectDashboard(page, assistantEmail, PASSWORD);
    await page.goto(`/dashboard/templates/${templateId}`);
    await expect(
      page.getByText("Tu rol no permite editar machotes"),
    ).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Negrita" })).toBeEnabled();
    await expect(
      page.getByRole("button", { name: /^Guardar cambios$/ }),
    ).toBeVisible();
  });

  // ================= Escrituras =================

  test("Escritura: asistente puede editar pero no finalizar ni duplicar sin permiso adecuado; solo_lectura ve el compositor completo de solo lectura", async ({
    page,
  }) => {
    await loginAndExpectDashboard(page, readerEmail, PASSWORD);
    await page.goto(`/dashboard/documents/${documentId}`);

    await expect(
      page.getByText("Tu rol no permite editar escrituras"),
    ).toBeVisible();
    await expect(page.getByLabel("Título de la escritura")).toBeDisabled();
    await expect(
      page.getByRole("button", { name: /^Guardar cambios$/ }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Finalizar escritura" }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Duplicar" }),
    ).not.toBeVisible();

    // Solicitud manipulada: reactiva el título y fuerza el envío del form
    // principal del compositor.
    const titleInput = page.getByLabel("Título de la escritura");
    await titleInput.evaluate((el: HTMLInputElement) => {
      el.disabled = false;
    });
    await titleInput.fill("Título manipulado por DOM");
    await page.evaluate(() => {
      document.querySelector("form")?.requestSubmit();
    });
    await page.waitForTimeout(1000);
    const rows = await restSelect<{ title: string }>(
      "documents",
      `id=eq.${documentId}&select=title`,
    );
    expect(rows[0].title).not.toBe("Título manipulado por DOM");

    await loginAndExpectDashboard(page, assistantEmail, PASSWORD);
    await page.goto(`/dashboard/documents/${documentId}`);
    await expect(
      page.getByText("Tu rol no permite editar escrituras"),
    ).not.toBeVisible();
    await expect(page.getByLabel("Título de la escritura")).toBeEnabled();
    await expect(
      page.getByRole("button", { name: /^Guardar cambios$/ }),
    ).toBeVisible();
    // asistente sí puede duplicar (documents.create) pero no finalizar
    // (documents.finalize es solo propietario/administrador).
    await expect(page.getByRole("button", { name: "Duplicar" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Finalizar escritura" }),
    ).not.toBeVisible();
  });

  test("Escritura: propietario finaliza; asistente ya no ve Reabrir pero sí puede corregir el índice; solo_lectura no ve ningún control de escritura", async ({
    page,
  }) => {
    await loginAndExpectDashboard(page, ownerEmail, PASSWORD);
    await page.goto(`/dashboard/documents/${secondDocumentId}`);
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Finalizar escritura" })
      .click();
    await expect(page.getByRole("alertdialog")).not.toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText("Finalizada es de solo lectura"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reabrir escritura" }),
    ).toBeVisible();

    await loginAndExpectDashboard(page, assistantEmail, PASSWORD);
    await page.goto(`/dashboard/documents/${secondDocumentId}`);
    await expect(page.getByText("Finalizada es de solo lectura")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reabrir escritura" }),
    ).not.toBeVisible();

    await page.getByRole("link", { name: "Completar datos del índice" }).click();
    await expect(page).toHaveURL(/section=notarial/);
    await expect(
      page.getByText("Tu rol no permite editar los datos del índice"),
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Guardar datos del índice" }),
    ).toBeVisible();

    await loginAndExpectDashboard(page, readerEmail, PASSWORD);
    await page.goto(`/dashboard/documents/${secondDocumentId}`);
    await expect(
      page.getByRole("button", { name: "Reabrir escritura" }),
    ).not.toBeVisible();
    await page.goto(`/dashboard/documents/${secondDocumentId}?section=notarial`);
    await expect(
      page.getByText("Tu rol no permite editar los datos del índice"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Guardar datos del índice" }),
    ).not.toBeVisible();
  });

  // ================= Índice Notarial =================

  test("Índice Notarial: asistente no ve el botón de exportar y una llamada directa al endpoint de exportación es rechazada; propietario sí puede exportar", async ({
    page,
  }) => {
    await loginAndExpectDashboard(page, assistantEmail, PASSWORD);
    await page.goto("/dashboard/notarial-index");
    await expect(
      page.getByText("Tu rol no permite generar el índice notarial"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Exportar Word" }),
    ).not.toBeVisible();

    // Solicitud manipulada: golpea el endpoint de exportación directamente
    // (como si alguien copiara la URL o manipulara la petición), sin pasar
    // por el enlace oculto. export-actions.ts valida notarial_index.generate
    // server-side — debe rechazarlo igual.
    const response = await page.request.get(
      "/api/notarial-index/export?year=2026&month=7&half=first",
    );
    expect(response.ok()).toBe(false);

    await loginAndExpectDashboard(page, ownerEmail, PASSWORD);
    await page.goto("/dashboard/notarial-index");
    await expect(
      page.getByRole("link", { name: "Exportar Word" }),
    ).toBeVisible();
  });

  // ================= Cuentas por cobrar =================

  test("Cuenta por cobrar: asistente puede editar y registrar pagos pero no anularlos; solo_lectura ve todo de solo lectura y un envío manipulado es rechazado", async ({
    page,
  }) => {
    await loginAndExpectDashboard(page, readerEmail, PASSWORD);
    await page.goto(`/dashboard/receivables/${receivableId}`);

    await expect(
      page.getByText("Tu rol no permite editar cuentas por cobrar"),
    ).toBeVisible();
    await expect(page.getByLabel("Concepto")).toBeDisabled();
    await expect(
      page.getByRole("button", { name: /^Guardar cambios$/ }),
    ).not.toBeVisible();

    await page.getByRole("tab", { name: "Pagos" }).click();
    await expect(
      page.getByRole("button", { name: "Registrar pago" }),
    ).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Anular" })).not.toBeVisible();
    await page.getByRole("tab", { name: "Datos de la cuenta" }).click();

    // Solicitud manipulada sobre el formulario de la cuenta.
    const conceptInput = page.getByLabel("Concepto");
    await conceptInput.evaluate((el: HTMLInputElement) => {
      el.disabled = false;
    });
    await conceptInput.fill("Concepto manipulado por DOM");
    await page.evaluate(() => {
      document.querySelector("form")?.requestSubmit();
    });
    await page.waitForTimeout(1000);
    const rows = await restSelect<{ concept: string }>(
      "receivables",
      `id=eq.${receivableId}&select=concept`,
    );
    expect(rows[0].concept).not.toBe("Concepto manipulado por DOM");

    await loginAndExpectDashboard(page, assistantEmail, PASSWORD);
    await page.goto(`/dashboard/receivables/${receivableId}`);
    await expect(page.getByLabel("Concepto")).toBeEnabled();
    await expect(
      page.getByRole("button", { name: /^Guardar cambios$/ }),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Pagos" }).click();
    await expect(
      page.getByRole("button", { name: "Registrar pago" }),
    ).toBeVisible();
    // asistente no tiene payments.void.
    await expect(page.getByRole("button", { name: "Anular" })).not.toBeVisible();

    await loginAndExpectDashboard(page, ownerEmail, PASSWORD);
    await page.goto(`/dashboard/receivables/${receivableId}?section=payments`);
    await expect(page.getByRole("button", { name: "Anular" })).toBeVisible();
  });

  // ================= Navegación directa =================

  test("Navegación directa: solo_lectura no puede llegar a ninguna ruta /new escribiendo la URL a mano", async ({
    page,
  }) => {
    await loginAndExpectDashboard(page, readerEmail, PASSWORD);

    await page.goto("/dashboard/templates/new");
    await expect(page).toHaveURL(/\/dashboard\/templates$/);

    await page.goto("/dashboard/documents/new");
    await expect(page).toHaveURL(/\/dashboard\/documents$/);

    await page.goto(`/dashboard/documents/new/${templateId}`);
    await expect(page).toHaveURL(/\/dashboard\/documents$/);

    await page.goto("/dashboard/receivables/new");
    await expect(page).toHaveURL(/\/dashboard\/receivables$/);

    await page.goto("/dashboard/clients/new");
    await expect(page).toHaveURL(/\/dashboard\/clients$/);
  });
});
