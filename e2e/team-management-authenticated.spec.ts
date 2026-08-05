import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  createDisposableUser,
  deleteUser,
  restDelete,
  restSelect,
} from "./support/supabase-admin";
import { waitForLatestEmail, extractFirstLink } from "./support/mailpit";

// El test A encadena varios logins independientes, una invitación real por
// correo (con espera activa a Mailpit) y varias acciones de gestión de
// equipo — supera con margen el timeout por defecto de Playwright (30s),
// igual que otros specs de flujos largos en este repo (ver
// document-milestone-feedback-authenticated.spec.ts, dashboard-panel-authenticated.spec.ts).
test.setTimeout(120_000);

// Roles, invitaciones y permisos (Iteración 5). Autocontenido, igual que
// auth-security-hardening.spec.ts: cada test crea sus propios usuarios
// desechables (Admin API) y limpia workspace_activity antes de borrarlos
// (actor_user_id/target_user_id no tienen ON DELETE CASCADE a propósito,
// para que la auditoría sobreviva a una remoción real de la app — ver
// comentario en remove_workspace_member).
//
// La matriz de permisos en sí (qué puede escribir cada rol, jerarquía de
// gestión, aislamiento entre Workspaces a nivel de fila) ya está cubierta a
// fondo por pgTAP (supabase/tests/rls_workspace_roles_and_invitations.test.sql)
// y por los tests unitarios de src/lib/server/permissions.ts. Esta suite
// cubre la plumbing real de UI que esos niveles no tocan: el correo de
// invitación real, el flujo de aceptación, y que la página "Mi equipo"
// aplica esos permisos.

const PASSWORD = "Segura!DePrueba9";

function uniqueEmail(label: string): string {
  return `e2e-team-${label}-${randomUUID()}@example.com`;
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
  // Espera a que el panel termine de asentarse antes de que el llamador
  // navegue de nuevo — si se llama a goto() mientras el RSC del dashboard
  // sigue en vuelo, Chromium puede abortar la navegación (ERR_ABORTED).
  await page.getByRole("navigation", { name: "Navegación principal" }).waitFor();
}

/** Normaliza el host del enlace de correo al host actual de la página (ver
 * el mismo ajuste en auth-security-hardening.spec.ts — site_url en
 * config.toml usa 127.0.0.1, pero la cookie de sesión queda en el host
 * desde el que se navegó, que en Playwright es localhost). */
function normalizeLinkHost(rawLink: string, page: Page): string {
  const link = new URL(rawLink);
  link.host = new URL(page.url()).host;
  return link.toString();
}

test.describe("team management", () => {
  test.describe.configure({ mode: "serial" });

  test("A: invitar por correo, aceptar, y el rol invitado no ve Mi equipo — luego cambiar rol/suspender/reactivar/remover conserva la auditoría", async ({
    page,
    browser,
  }) => {
    const ownerEmail = uniqueEmail("owner-a");
    const memberEmail = uniqueEmail("member-a");
    const ownerId = await createDisposableUser(ownerEmail, PASSWORD);
    let memberId: string | null = null;

    try {
      await loginAndExpectDashboard(page, ownerEmail, PASSWORD);
      await page.goto("/dashboard/team");
      await expect(
        page.getByRole("heading", { name: "Mi equipo" }),
      ).toBeVisible();

      const sentAfter = new Date();
      await page.getByLabel("Correo electrónico").fill(memberEmail);
      await page.getByRole("button", { name: "Invitar" }).click();
      await expect(page.getByText("Invitación enviada.")).toBeVisible();

      const invitedRows = await restSelect<{ user_id: string }>(
        "workspace_members",
        `workspace_id=eq.${ownerId}&status=eq.invited&select=user_id`,
      );
      expect(invitedRows).toHaveLength(1);
      memberId = invitedRows[0].user_id;

      const message = await waitForLatestEmail(memberEmail, sentAfter);
      const link = normalizeLinkHost(extractFirstLink(message.HTML), page);

      // Acepta la invitación en un BrowserContext aparte — no solo una
      // pestaña nueva: las pestañas de un mismo context comparten cookies,
      // así que reutilizar `context.newPage()` pisaría la sesión del
      // propietario en cuanto el invitado inicie sesión (la necesitamos de
      // nuevo abajo).
      const memberContext = await browser.newContext();
      const memberPage = await memberContext.newPage();
      await memberPage.goto(link);
      await expect(
        memberPage.getByRole("heading", { name: /Te invitaron a/ }),
      ).toBeVisible();
      await expect(memberPage.getByText("Asistente")).toBeVisible();

      await memberPage.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
      await memberPage.getByLabel("Confirmar contraseña").fill(PASSWORD);
      await memberPage.getByRole("button", { name: "Unirme al equipo" }).click();
      await memberPage.waitForURL(/\/dashboard/, { timeout: 15_000 });
      // Espera a que el panel termine de asentarse antes de navegar de
      // nuevo — si se llama a goto() mientras el RSC del dashboard sigue
      // en vuelo, Chromium puede abortar la navegación (ERR_ABORTED).
      await memberPage
        .getByRole("navigation", { name: "Navegación principal" })
        .waitFor();

      // Un asistente no puede gestionar miembros: la propia página redirige.
      await memberPage.goto("/dashboard/team");
      await expect(memberPage).toHaveURL(/\/dashboard$/);
      await memberContext.close();

      // El propietario cambia el rol a administrador, y ahora sí puede
      // entrar a Mi equipo.
      await page.reload();
      const roleSelect = page.getByRole("combobox", {
        name: `Rol de ${memberEmail}`,
      });
      await roleSelect.selectOption("administrador");
      await expect(roleSelect).toHaveValue("administrador");

      const adminContext = await browser.newContext();
      const asAdminPage = await adminContext.newPage();
      await loginAndExpectDashboard(asAdminPage, memberEmail, PASSWORD);
      await asAdminPage.goto("/dashboard/team");
      await expect(
        asAdminPage.getByRole("heading", { name: "Mi equipo" }),
      ).toBeVisible();
      await adminContext.close();

      // Suspender corta el acceso a los datos del Workspace de inmediato,
      // pero la cuenta y la sesión de Supabase Auth siguen siendo válidas
      // — no es un ban. El login funciona y aterriza en
      // /workspace-unavailable (nunca /login), con el mensaje específico
      // de suspensión y un botón para cerrar sesión.
      await page.getByRole("button", { name: "Suspender" }).click();
      await expect(page.getByText("Suspendido")).toBeVisible();

      const suspendedContext = await browser.newContext();
      const suspendedPage = await suspendedContext.newPage();
      await suspendedPage.goto("/login");
      await suspendedPage.getByLabel("Correo electrónico").fill(memberEmail);
      await suspendedPage.getByLabel("Contraseña").fill(PASSWORD);
      await suspendedPage.getByRole("button", { name: "Ingresar" }).click();
      await expect(suspendedPage).toHaveURL(/\/workspace-unavailable$/, {
        timeout: 15_000,
      });
      await expect(
        suspendedPage.getByRole("heading", {
          name: "Su acceso a este espacio de trabajo fue suspendido",
        }),
      ).toBeVisible();

      // No tiene acceso a los datos del Workspace del que fue suspendido:
      // navegar directo a una ruta de negocio también rebota aquí, nunca
      // muestra datos ajenos ni cae en /login.
      await suspendedPage.goto("/dashboard/receivables");
      await expect(suspendedPage).toHaveURL(/\/workspace-unavailable$/);

      // La pantalla permite cerrar sesión.
      await suspendedPage.getByRole("button", { name: "Cerrar sesión" }).click();
      await expect(suspendedPage).toHaveURL(/\/login/, { timeout: 15_000 });
      await suspendedContext.close();

      // Reactivar restablece el acceso.
      await page.reload();
      await page.getByRole("button", { name: "Reactivar" }).click();
      await expect(page.getByText("Activo").last()).toBeVisible();

      const reactivatedContext = await browser.newContext();
      const reactivatedPage = await reactivatedContext.newPage();
      await loginAndExpectDashboard(reactivatedPage, memberEmail, PASSWORD);
      await reactivatedContext.close();

      // Remover: la membresía desaparece pero la auditoría sobrevive.
      await page.reload();
      await page.getByRole("button", { name: "Remover" }).click();
      await page.getByRole("button", { name: "Sí, remover" }).click();
      await expect(page.getByText("Miembros (1)")).toBeVisible();

      // Removido (no baneado): las credenciales siguen siendo válidas, pero
      // ya no queda ninguna membresía (ni activa ni de ningún otro tipo —
      // su Workspace personal se eliminó al aceptar la invitación real, ver
      // accept_workspace_invitation, y remove_workspace_member no crea uno
      // nuevo). Aterriza en /workspace-unavailable con el mensaje genérico
      // (distinto del de suspensión), nunca en /login.
      const removedContext = await browser.newContext();
      const removedPage = await removedContext.newPage();
      await removedPage.goto("/login");
      await removedPage.getByLabel("Correo electrónico").fill(memberEmail);
      await removedPage.getByLabel("Contraseña").fill(PASSWORD);
      await removedPage.getByRole("button", { name: "Ingresar" }).click();
      await expect(removedPage).toHaveURL(/\/workspace-unavailable$/, {
        timeout: 15_000,
      });
      await expect(
        removedPage.getByRole("heading", {
          name: "Ya no tiene acceso a ningún espacio de trabajo",
        }),
      ).toBeVisible();
      await removedPage.goto("/dashboard/team");
      await expect(removedPage).toHaveURL(/\/workspace-unavailable$/);
      await removedContext.close();

      // No se le recreó ningún Workspace personal al ser removido.
      const rowsAfterRemoval = await restSelect<{ id: string }>(
        "workspace_members",
        `user_id=eq.${memberId}&select=id`,
      );
      expect(rowsAfterRemoval).toHaveLength(0);

      // Una invitación posterior al mismo correo funciona. El correo ya
      // tiene cuenta (inviteUserByEmail responde email_exists), así que no
      // se reenvía ningún correo — el mensaje lo deja explícito — pero la
      // membresía 'invited' sí se crea igual. El login (con la MISMA
      // contraseña de siempre — nunca se le pidió cambiarla) lo manda a
      // /accept-invite, no a /workspace-unavailable ni a /dashboard,
      // porque su única fila ahora es 'invited'.
      await page.reload();
      await page.getByLabel("Correo electrónico").fill(memberEmail);
      await page.getByRole("button", { name: "Invitar" }).click();
      await expect(
        page.getByText("este correo ya tiene cuenta en LexCR"),
      ).toBeVisible();

      const reinvitedContext = await browser.newContext();
      const reinvitedPage = await reinvitedContext.newPage();
      await reinvitedPage.goto("/login");
      await reinvitedPage.getByLabel("Correo electrónico").fill(memberEmail);
      await reinvitedPage.getByLabel("Contraseña").fill(PASSWORD);
      await reinvitedPage.getByRole("button", { name: "Ingresar" }).click();
      await expect(reinvitedPage).toHaveURL(/\/accept-invite$/, {
        timeout: 15_000,
      });
      await reinvitedContext.close();

      const activity = await restSelect<{ event_type: string }>(
        "workspace_activity",
        `workspace_id=eq.${ownerId}&target_user_id=eq.${memberId}&select=event_type&order=created_at.asc`,
      );
      expect(activity.map((a) => a.event_type)).toEqual([
        "member_invited",
        "member_invitation_accepted",
        "member_role_changed",
        "member_suspended",
        "member_reactivated",
        "member_removed",
        "member_invited",
      ]);
    } finally {
      await restDelete("workspace_activity", `workspace_id=eq.${ownerId}`);
      if (memberId) await deleteUser(memberId);
      await deleteUser(ownerId);
    }
  });

  test("B: aislamiento entre Workspaces — cada propietario solo ve su propio equipo", async ({
    page,
  }) => {
    const ownerAEmail = uniqueEmail("iso-owner-a");
    const ownerBEmail = uniqueEmail("iso-owner-b");
    const ownerAId = await createDisposableUser(ownerAEmail, PASSWORD);
    const ownerBId = await createDisposableUser(ownerBEmail, PASSWORD);

    try {
      await loginAndExpectDashboard(page, ownerAEmail, PASSWORD);
      await page.goto("/dashboard/team");
      await expect(page.getByText("Miembros (1)")).toBeVisible();
      // El email del propietario también aparece en el sidebar (usuario
      // logueado) y en el menú móvil — .first() basta para confirmar que
      // la fila de "Mi equipo" lo muestra.
      await expect(page.getByText(ownerAEmail).first()).toBeVisible();
      await expect(page.getByText(ownerBEmail)).not.toBeVisible();
    } finally {
      await restDelete("workspace_activity", `workspace_id=eq.${ownerAId}`);
      await restDelete("workspace_activity", `workspace_id=eq.${ownerBId}`);
      await deleteUser(ownerAId);
      await deleteUser(ownerBId);
    }
  });
});
