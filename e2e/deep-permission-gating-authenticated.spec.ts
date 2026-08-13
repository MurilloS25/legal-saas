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

/**
 * Extrae el access token de la sesión YA logueada en `page` — bypassa la
 * app de Next.js por completo (ni Server Action ni UI), igual que alguien
 * manipulando la petición HTTP directamente. Soporta cookies fragmentadas
 * (`sb-...-auth-token.0`, `.1`, ...), mismo patrón que
 * `e2e/support/supabase-api.ts`.
 */
async function getSessionAccessToken(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const chunks = cookies
    .map((cookie) => {
      const match = cookie.name.match(/^sb-.+-auth-token(?:\.(\d+))?$/);
      if (!match) return null;
      return { index: match[1] ? Number(match[1]) : 0, value: cookie.value };
    })
    .filter((c): c is { index: number; value: string } => c !== null)
    .sort((a, b) => a.index - b.index);
  if (chunks.length === 0) {
    throw new Error("No Supabase auth cookie found on the current page context");
  }

  const decode = (raw: string) => {
    const value = decodeURIComponent(raw);
    return value.startsWith("base64-")
      ? Buffer.from(value.slice("base64-".length), "base64url").toString("utf8")
      : value;
  };
  const session = JSON.parse(decode(chunks.map((c) => c.value).join(""))) as {
    access_token?: string;
  };
  if (!session.access_token) {
    throw new Error("Session cookie does not contain an access_token");
  }
  return session.access_token;
}

function supabaseRestHeaders(accessToken: string): Record<string, string> {
  const apiKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey) {
    throw new Error("Missing Supabase anon key env var for direct REST call");
  }
  return {
    apikey: apiKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

/** PATCH directo a PostgREST (`/rest/v1/documents`), bypassando la app. */
async function directPatchDocumentStatus(
  page: Page,
  documentId: string,
  status: string,
): Promise<{ ok: boolean; status: number }> {
  const accessToken = await getSessionAccessToken(page);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL env var for direct REST call");
  }
  const response = await fetch(
    `${supabaseUrl}/rest/v1/documents?id=eq.${documentId}`,
    {
      method: "PATCH",
      headers: { ...supabaseRestHeaders(accessToken), Prefer: "return=representation" },
      body: JSON.stringify({ status }),
    },
  );
  return { ok: response.ok, status: response.status };
}

/** Invoca una RPC directamente vía PostgREST (`/rest/v1/rpc/<name>`), bypassando la app. */
async function directRpcCall(
  page: Page,
  functionName: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; status: number }> {
  const accessToken = await getSessionAccessToken(page);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL env var for direct REST call");
  }
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: supabaseRestHeaders(accessToken),
    body: JSON.stringify(args),
  });
  return { ok: response.ok, status: response.status };
}

/** Cuenta filas vía PostgREST (`Prefer: count=exact`), bypassando la app. */
async function directRestCount(page: Page, table: string): Promise<number> {
  const accessToken = await getSessionAccessToken(page);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL env var for direct REST call");
  }
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id`, {
    headers: { ...supabaseRestHeaders(accessToken), Prefer: "count=exact", Range: "0-0" },
  });
  const range = response.headers.get("content-range"); // "0-0/<total>"
  return Number(range?.split("/")[1] ?? 0);
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
  let reopenTargetDocumentId: string;
  let receivableId: string;
  /** Creada por el test del paso "Cobro" contextual — limpiada aparte
   * porque no existe hasta que ese test corre. */
  let cobroReceivableId: string | undefined;

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

    // Ya finalizada desde el inicio, dedicada a probar el bypass directo de
    // reabrir (Fix B) sin interferir con el flujo de finalizar/reabrir por
    // UI que usa secondDocumentId.
    const reopenTargetDocument = await restInsert<{ id: string }>("documents", {
      owner_id: ownerId,
      template_id: templateId,
      client_id: clientId,
      title: "Escritura gating profundo (reabrir directo)",
      status: "final",
      field_values: {},
      rendered_content: "Contenido de prueba.",
    });
    reopenTargetDocumentId = reopenTargetDocument.id;

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
    if (cobroReceivableId) {
      await restDelete(
        "receivable_payments",
        `receivable_id=eq.${cobroReceivableId}`,
      );
      await restDelete("receivables", `id=eq.${cobroReceivableId}`);
    }
    await restDelete("receivable_payments", `receivable_id=eq.${receivableId}`);
    await restDelete("receivables", `id=eq.${receivableId}`);
    await restDelete("documents", `id=eq.${documentId}`);
    await restDelete("documents", `id=eq.${secondDocumentId}`);
    await restDelete("documents", `id=eq.${reopenTargetDocumentId}`);
    await restDelete("clients", `id=eq.${clientId}`);
    await restDelete("templates", `id=eq.${templateId}`);
    await restDelete("workspace_activity", `workspace_id=eq.${ownerId}`);
    await restDelete("notarial_index_exports", `workspace_id=eq.${ownerId}`);
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
    // El editor vive en el paso "Documento" — una entrada normal abre en
    // "Información".
    await page.getByRole("tab", { name: "Documento", exact: true }).click();
    await expect(page.getByRole("button", { name: "Negrita" })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Insertar variable" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: /^Guardar cambios$/ }),
    ).not.toBeVisible();

    // Solicitud manipulada: reactiva el campo "Nombre" a mano vía DOM (como
    // haría alguien inspeccionando/editando el HTML) y fuerza el envío. El
    // servidor debe rechazarlo igual — RLS exige templates.write. El nombre
    // vive en el paso "Información" del stepper de edición.
    await page.getByRole("tab", { name: "Información", exact: true }).click();
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
    await page.getByRole("tab", { name: "Documento", exact: true }).click();
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
      page.getByRole("button", { name: "Duplicar" }),
    ).not.toBeVisible();
    await page.getByRole("tab", { name: "Revisar y finalizar" }).click();
    await expect(
      page.getByRole("button", { name: "Finalizar escritura" }),
    ).not.toBeVisible();
    await page.getByRole("tab", { name: "Completar" }).click();

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
    await page.getByRole("tab", { name: "Revisar y finalizar" }).click();
    await expect(
      page.getByRole("button", { name: "Finalizar escritura" }),
    ).not.toBeVisible();
  });

  test("Escritura: propietario finaliza; asistente ya no ve Reabrir pero sí puede corregir el índice; solo_lectura no ve ningún control de escritura", async ({
    page,
  }) => {
    await loginAndExpectDashboard(page, ownerEmail, PASSWORD);
    await page.goto(`/dashboard/documents/${secondDocumentId}`);
    await page.getByRole("tab", { name: "Revisar y finalizar" }).click();
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Finalizar escritura" })
      .click();
    await expect(page.getByRole("alertdialog")).not.toBeVisible({
      timeout: 15_000,
    });
    // Finalizar redirige de verdad y reinicia el paso a "Completar".
    await page.getByRole("tab", { name: "Revisar y finalizar" }).click();
    await expect(
      page.getByText("Finalizada es de solo lectura"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reabrir escritura" }),
    ).toBeVisible();

    await loginAndExpectDashboard(page, assistantEmail, PASSWORD);
    await page.goto(`/dashboard/documents/${secondDocumentId}`);
    await page.getByRole("tab", { name: "Revisar y finalizar" }).click();
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
    await page.getByRole("tab", { name: "Revisar y finalizar" }).click();
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

  test("Escritura: reabrir una escritura finalizada por PATCH directo a la API es rechazado para asistente y solo_lectura, y aceptado para propietario", async ({
    page,
  }) => {
    // Fix B: `transitionDocument` en lifecycle-actions.ts es UX — el
    // enforcement real es el trigger `enforce_document_finalize_permission`
    // (RLS deja pasar el UPDATE hasta el `with check`). Golpear PostgREST
    // directamente, sin pasar por la app ni por ningún Server Action, prueba
    // que el rechazo sostiene incluso si alguien evita la UI por completo.
    await loginAndExpectDashboard(page, assistantEmail, PASSWORD);
    const assistantAttempt = await directPatchDocumentStatus(
      page,
      reopenTargetDocumentId,
      "draft",
    );
    expect(assistantAttempt.ok).toBe(false);

    await loginAndExpectDashboard(page, readerEmail, PASSWORD);
    const readerAttempt = await directPatchDocumentStatus(
      page,
      reopenTargetDocumentId,
      "draft",
    );
    expect(readerAttempt.ok).toBe(false);

    const stillFinal = await restSelect<{ status: string }>(
      "documents",
      `id=eq.${reopenTargetDocumentId}&select=status`,
    );
    expect(stillFinal[0].status).toBe("final");

    await loginAndExpectDashboard(page, ownerEmail, PASSWORD);
    const ownerAttempt = await directPatchDocumentStatus(
      page,
      reopenTargetDocumentId,
      "draft",
    );
    expect(ownerAttempt.ok).toBe(true);

    const reopened = await restSelect<{ status: string }>(
      "documents",
      `id=eq.${reopenTargetDocumentId}&select=status`,
    );
    expect(reopened[0].status).toBe("draft");
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

  test("Índice Notarial: la RPC de registro de exportación (log_notarial_index_export) rechaza a asistente y acepta a propietario, invocada directamente vía PostgREST", async ({
    page,
  }) => {
    // Gap A: el RPC ya valida membresía activa del Workspace + permiso
    // notarial_index.generate (pgTAP: rls_notarial_index_export_
    // workspace_roles.test.sql) — esto prueba lo mismo con una sesión real
    // de asistente/propietario, golpeando PostgREST directamente sin pasar
    // por ningún Server Action ni ruta de la app. La RPC nunca lanza error
    // por rol insuficiente (retorna silenciosamente sin registrar), así que
    // la prueba real es si el conteo de exportaciones cambia o no.
    await loginAndExpectDashboard(page, ownerEmail, PASSWORD);
    const countBefore = await directRestCount(page, "notarial_index_exports");

    await loginAndExpectDashboard(page, assistantEmail, PASSWORD);
    const assistantAttempt = await directRpcCall(page, "log_notarial_index_export", {
      p_format: "docx",
      p_from: "2026-07-01",
      p_to: "2026-07-15",
      p_row_count: 1,
    });
    expect(assistantAttempt.ok).toBe(true); // no lanza error — solo no registra nada.

    await loginAndExpectDashboard(page, ownerEmail, PASSWORD);
    const countAfterAssistant = await directRestCount(page, "notarial_index_exports");
    expect(countAfterAssistant).toBe(countBefore);

    const ownerAttempt = await directRpcCall(page, "log_notarial_index_export", {
      p_format: "docx",
      p_from: "2026-07-01",
      p_to: "2026-07-15",
      p_row_count: 1,
    });
    expect(ownerAttempt.ok).toBe(true);

    const countAfterOwner = await directRestCount(page, "notarial_index_exports");
    expect(countAfterOwner).toBe(countBefore + 1);
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

  test("Escritura → Cobro contextual: solo_lectura no ve ninguna acción", async ({
    page,
  }) => {
    await loginAndExpectDashboard(page, readerEmail, PASSWORD);
    await page.goto(`/dashboard/documents/${documentId}?section=cobro`);
    const cobroSection = page.getByRole("region", {
      name: "Cuentas por cobrar de la escritura",
    });
    await expect(cobroSection).toBeVisible();
    await expect(
      cobroSection.getByRole("button", { name: "Crear cuenta por cobrar" }),
    ).not.toBeVisible();
  });

  // Antes bloqueado por un bug preexistente en
  // `default_workspace_id_from_actor()` (resolvía el Workspace de arranque
  // del actor en vez del compartido cuando pertenece a más de uno) —
  // corregido en 20260812120000_fix_default_workspace_id_from_actor.sql
  // (PR #170, mergeado a develop). Ver ese commit para el diagnóstico
  // completo; este test ya no necesita saltarse.
  test("Escritura → Cobro contextual: asistente puede crear una cuenta y registrar un pago sin salir de la Escritura", async ({
    page,
  }) => {
    await loginAndExpectDashboard(page, assistantEmail, PASSWORD);
    await page.goto(`/dashboard/documents/${documentId}?section=cobro`);
    await page
      .getByRole("button", { name: "Crear cuenta por cobrar" })
      .click();
    const createDialog = page.getByRole("dialog", {
      name: "Crear cuenta por cobrar",
    });
    await expect(createDialog).toBeVisible();
    await createDialog
      .getByLabel("Cliente", { exact: true })
      .selectOption({ label: "Cliente Gating Profundo" });
    await createDialog.getByPlaceholder("Honorarios por escritura de compraventa").fill("Honorarios gating cobro");
    await createDialog.getByPlaceholder("150000.00").fill("40000");
    await createDialog.getByRole("button", { name: "Crear cuenta" }).click();

    // Nunca navega fuera de la Escritura — mismo documentId en la URL.
    await expect(page).toHaveURL(
      new RegExp(`/dashboard/documents/${documentId}`),
    );
    await expect(createDialog).toBeHidden();
    await expect(page.getByText("Honorarios gating cobro")).toBeVisible();

    const registeredId = await restSelect<{ id: string }>(
      "receivables",
      `document_id=eq.${documentId}&select=id`,
    );
    cobroReceivableId = registeredId[0]?.id;
    expect(cobroReceivableId).toBeTruthy();

    await page.getByRole("button", { name: "Registrar pago" }).click();
    const payDialog = page.getByRole("dialog", { name: "Registrar pago" });
    await expect(payDialog).toBeVisible();
    await payDialog.getByLabel(/^Monto del pago/).fill("40000");
    await payDialog.getByRole("button", { name: "Registrar pago" }).click();

    // Tampoco navega fuera al registrar el pago — sigue en la Escritura.
    await expect(page).toHaveURL(
      new RegExp(`/dashboard/documents/${documentId}`),
    );
    await expect(payDialog).toBeHidden();
    await expect(page.getByText("Pagada", { exact: true })).toBeVisible();
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
