import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  createDisposableUser,
  deleteUser,
  restDelete,
  restInsert,
  restSelect,
} from "./support/supabase-admin";
import { waitForLatestEmail, extractFirstLink } from "./support/mailpit";

// Iteración 6 — Identidad notarial y auditoría de actores. Autocontenido,
// mismo patrón que team-management-authenticated.spec.ts: cada test crea
// sus propios usuarios/Workspaces desechables, invita por correo real
// (Mailpit) y usa un browser.newContext() separado por identidad (las
// pestañas de un mismo context comparten cookies). El machote se siembra
// vía service role (fixture neutral, no lo que este spec verifica) para no
// repetir el flujo caro del editor Tiptap, que ya tiene su propia
// cobertura E2E dedicada — la ACCIÓN bajo prueba (crear el borrador) sí
// pasa por la app real.
//
// "Índice usa nombre del Notario" y "DOCX e Índice correctos" (checklist de
// la Iteración 6) ya están cubiertos por el test unitario
// src/features/notarial-index/export/notarial-docx.test.ts, que verifica
// que el nombre del notario en la firma del DOCX viene del parámetro
// `notaryName` (resuelto en export-actions.ts desde lawyer_profiles,
// nunca del usuario autenticado) — no se duplica aquí.
test.setTimeout(120_000);

const PASSWORD = "Segura!DePrueba9";

function uniqueEmail(label: string): string {
  return `e2e-notary-${label}-${randomUUID()}@example.com`;
}

async function loginAndExpectDashboard(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await page.getByRole("navigation", { name: "Navegación principal" }).waitFor();
}

function normalizeLinkHost(rawLink: string, page: Page): string {
  const link = new URL(rawLink);
  link.host = new URL(page.url()).host;
  return link.toString();
}

async function documentActivity(page: Page) {
  await page.getByRole("button", { name: "Historial" }).click();
  const dialog = page.getByRole("dialog", { name: "Historial de la escritura" });
  await expect(dialog).toBeVisible();
  return dialog.getByRole("region", { name: "Actividad" });
}

test.describe("notary identity and actor audit", () => {
  test.describe.configure({ mode: "serial" });

  test("A: propietario edita su perfil, asistente genera un borrador auditado con su propia identidad, pierde acceso a la identidad notarial al ser removido, y el historial sobrevive", async ({
    page,
    browser,
  }) => {
    const ownerEmail = uniqueEmail("owner");
    const assistantEmail = uniqueEmail("assistant");
    const ownerId = await createDisposableUser(ownerEmail, PASSWORD);
    let assistantId: string | null = null;
    let templateId: string | null = null;
    let documentId: string | null = null;

    try {
      // ---- propietario modifica perfil (identidad notarial del Workspace)
      await loginAndExpectDashboard(page, ownerEmail, PASSWORD);
      await page.goto("/dashboard/settings");
      await page.getByLabel("Nombre completo").fill("Lic. Notaria de Prueba");
      await page.getByLabel("Código profesional").fill("NP-9999");
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByRole("status")).toBeVisible({ timeout: 15_000 });

      // ---- invita a un correo nuevo (flujo real de invitación por correo,
      // ya probado a fondo en team-management-authenticated.spec.ts — aquí
      // solo se necesita para tener un asistente real dentro del Workspace).
      await page.goto("/dashboard/team");
      const sentAfter = new Date();
      await page.getByLabel("Correo electrónico").fill(assistantEmail);
      await page.getByRole("button", { name: "Invitar" }).click();
      await expect(page.getByText("Invitación enviada.")).toBeVisible();

      const invitedRows = await restSelect<{ user_id: string }>(
        "workspace_members",
        `workspace_id=eq.${ownerId}&status=eq.invited&select=user_id`,
      );
      expect(invitedRows).toHaveLength(1);
      assistantId = invitedRows[0].user_id;

      const message = await waitForLatestEmail(assistantEmail, sentAfter);
      const link = normalizeLinkHost(extractFirstLink(message.HTML), page);

      const assistantContext = await browser.newContext();
      const assistantPage = await assistantContext.newPage();
      await assistantPage.goto(link);
      // Página intermedia (GET, sin sesión): el token todavía no se
      // consumió — solo se consume al enviar este botón, en un POST.
      await assistantPage
        .getByRole("button", { name: "Aceptar invitación" })
        .click();
      await assistantPage.waitForURL(/\/accept-invite\/set-password$/, {
        timeout: 15_000,
      });
      await assistantPage.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
      await assistantPage.getByLabel("Confirmar contraseña").fill(PASSWORD);
      await assistantPage
        .getByRole("button", { name: "Guardar contraseña y continuar" })
        .click();
      await assistantPage.waitForURL(/\/dashboard/, { timeout: 15_000 });
      await assistantPage
        .getByRole("navigation", { name: "Navegación principal" })
        .waitFor();

      // ---- siembra un machote activo sin variables (fixture neutral) para
      // que el asistente pueda crear un borrador sin pasar por el editor.
      const template = await restInsert<{ id: string; name: string }>(
        "templates",
        {
          owner_id: ownerId,
          workspace_id: ownerId,
          name: `E2E Notary Template ${randomUUID().slice(0, 8)}`,
          status: "active",
          content_json: { text: "ESCRITURA DE PRUEBA SIN VARIABLES." },
          text_preview: "ESCRITURA DE PRUEBA SIN VARIABLES.",
        },
      );
      templateId = template.id;

      // ---- el asistente genera un borrador (acción real vía la app).
      await assistantPage.goto("/dashboard/documents/new");
      await assistantPage
        .locator("li")
        .filter({ hasText: template.name })
        .getByRole("link", { name: "Usar este machote" })
        .click();
      await expect(assistantPage).toHaveURL(
        /\/dashboard\/documents\/new\/[^/]+$/,
        { timeout: 15_000 },
      );
      await assistantPage
        .getByRole("button", { name: "Guardar cambios" })
        .click();
      await expect(assistantPage).toHaveURL(
        /\/dashboard\/documents\/(?!new)[^/]+/,
        { timeout: 30_000 },
      );
      const documentPath = new URL(assistantPage.url()).pathname;
      documentId = documentPath.split("/").pop() ?? null;

      // ---- el asistente no puede modificar la identidad notarial: el
      // formulario de Configuración le llega en modo lectura.
      await assistantPage.goto("/dashboard/settings");
      await expect(
        assistantPage.getByText(
          "Solo el propietario o un administrador pueden editar esta",
        ),
      ).toBeVisible();
      await expect(assistantPage.getByLabel("Nombre completo")).toBeDisabled();
      await expect(
        assistantPage.getByRole("button", { name: "Guardar cambios" }),
      ).toHaveCount(0);
      await assistantContext.close();

      // ---- auditoría muestra asistente: el PROPIETARIO ve el nombre real
      // del asistente en el historial de la escritura, no un genérico.
      await page.goto(documentPath);
      const ownerActivityBeforeRemoval = await documentActivity(page);
      await expect(
        ownerActivityBeforeRemoval.getByText(
          new RegExp(`${assistantEmail} \\(Asistente\\)`),
        ),
      ).toBeVisible();
      await page.getByRole("button", { name: "Cerrar historial" }).click();

      // ---- el propietario remueve al asistente.
      await page.goto("/dashboard/team");
      await page.getByRole("button", { name: "Remover" }).click();
      await page.getByRole("button", { name: "Sí, remover" }).click();
      await expect(page.getByText("Miembros (1)")).toBeVisible();

      // ---- miembro removido conserva historial: el borrador que creó
      // sigue mostrando su nombre y rol, sin importar que ya no sea
      // miembro del Workspace.
      await page.goto(documentPath);
      const ownerActivityAfterRemoval = await documentActivity(page);
      await expect(
        ownerActivityAfterRemoval.getByText(
          new RegExp(`${assistantEmail} \\(Asistente\\)`),
        ),
      ).toBeVisible();
      await page.getByRole("button", { name: "Cerrar historial" }).click();

      // ---- la actividad de equipo también muestra identidades reales.
      await page.goto("/dashboard/team");
      await expect(
        page.getByText(new RegExp(`Invitó a ${assistantEmail}`)),
      ).toBeVisible();
      await expect(
        page.getByText(new RegExp(`Removió a ${assistantEmail}`)),
      ).toBeVisible();
    } finally {
      // Orden seguro: primero las filas de auditoría que referencian a
      // ambos usuarios SIN cascada (actor_user_id nunca tiene ON DELETE
      // CASCADE, a propósito, para que la auditoría sobreviva a una
      // remoción real de la app) — si no se limpian antes, borrar el
      // usuario de prueba falla por violación de llave foránea.
      await restDelete("workspace_activity", `workspace_id=eq.${ownerId}`);
      if (documentId) {
        await restDelete("document_activity", `document_id=eq.${documentId}`);
        await restDelete("documents", `id=eq.${documentId}`);
      }
      if (templateId) await restDelete("templates", `id=eq.${templateId}`);
      if (assistantId) await deleteUser(assistantId);
      await deleteUser(ownerId);
    }
  });
});
