import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  createDisposableUser,
  deleteUser,
  restDelete,
  restSelect,
  restUpdate,
} from "./support/supabase-admin";
import { waitForLatestEmail, extractFirstLink } from "./support/mailpit";

// Regresión del bug real reportado: el enlace de invitación (formato
// viejo, /auth/confirm?type=invite) ejecutaba verifyOtp como efecto
// secundario de un simple GET — cualquier prefetch de navegador, un
// antivirus o un escáner de enlaces de correo podían "hacer clic" antes
// que la persona real, dejando el token consumido y el enlace inútil
// ("Invitación no válida o expirada") sin que el usuario lo hubiera
// abierto nunca. Ver el diagnóstico documentado en el PR y
// docs/AUTH_SECURITY.md.
//
// team-management-authenticated.spec.ts ya cubre el flujo feliz completo
// (invitar → aceptar → gestionar equipo → auditoría) con Mailpit real.
// Este archivo cubre específicamente la seguridad del token: que un GET
// nunca lo consume, que un segundo uso falla limpio, y los estados de
// invitación que no deben poder aceptarse.
test.setTimeout(120_000);

const PASSWORD = "Segura!DePrueba9";

function uniqueEmail(label: string): string {
  return `e2e-invite-safety-${label}-${randomUUID()}@example.com`;
}

function normalizeLinkHost(rawLink: string, page: Page): string {
  const link = new URL(rawLink);
  link.host = new URL(page.url()).host;
  return link.toString();
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

async function inviteMemberAndGetLink(
  page: Page,
  memberEmail: string,
  role?: string,
): Promise<string> {
  await page.goto("/dashboard/team");
  const sentAfter = new Date();
  await page.getByLabel("Correo electrónico").fill(memberEmail);
  if (role) {
    await page.getByLabel("Rol").selectOption(role);
  }
  await page.getByRole("button", { name: "Invitar" }).click();
  await expect(page.getByText("Invitación enviada.")).toBeVisible();
  const message = await waitForLatestEmail(memberEmail, sentAfter);
  return normalizeLinkHost(extractFirstLink(message.HTML), page);
}

async function acceptInviteThroughUi(page: Page, link: string): Promise<void> {
  await page.goto(link);
  await page.getByRole("button", { name: "Aceptar invitación" }).click();
  await page.waitForURL(/\/accept-invite\/set-password$/, { timeout: 15_000 });
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirmar contraseña").fill(PASSWORD);
  await page
    .getByRole("button", { name: "Guardar contraseña y continuar" })
    .click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe("seguridad del token de invitación (un GET no debe consumirlo)", () => {
  test.describe.configure({ mode: "serial" });

  test("un GET simple, y varios GET consecutivos, al enlace no consumen el token", async ({
    page,
    browser,
  }) => {
    const ownerEmail = uniqueEmail("owner-getsafe");
    const memberEmail = uniqueEmail("member-getsafe");
    const ownerId = await createDisposableUser(ownerEmail, PASSWORD);
    let memberId: string | null = null;

    try {
      await loginAndExpectDashboard(page, ownerEmail, PASSWORD);
      const link = await inviteMemberAndGetLink(page, memberEmail);

      const invitedRows = await restSelect<{ user_id: string }>(
        "workspace_members",
        `workspace_id=eq.${ownerId}&status=eq.invited&select=user_id`,
      );
      expect(invitedRows).toHaveLength(1);
      memberId = invitedRows[0].user_id;

      // Simula un prefetch de navegador / escáner de enlaces de correo: un
      // GET simple, y luego varios consecutivos más, a la MISMA URL — sin
      // ningún clic humano.
      const scannerContext = await browser.newContext();
      const scanner = await scannerContext.newPage();
      for (let i = 0; i < 4; i++) {
        const response = await scanner.request.get(link);
        expect(response.ok()).toBe(true);
      }
      await scannerContext.close();

      // El token sigue intacto: el estado en base de datos no cambió.
      const stillInvited = await restSelect<{ status: string }>(
        "workspace_members",
        `user_id=eq.${memberId}&workspace_id=eq.${ownerId}&select=status`,
      );
      expect(stillInvited).toHaveLength(1);
      expect(stillInvited[0].status).toBe("invited");
    } finally {
      await restDelete("workspace_activity", `workspace_id=eq.${ownerId}`);
      if (memberId) await deleteUser(memberId);
      await deleteUser(ownerId);
    }
  });

  test("un prefetch simulado (varios GET) seguido del clic real del usuario funciona igual que sin prefetch", async ({
    page,
    browser,
  }) => {
    const ownerEmail = uniqueEmail("owner-prefetch");
    const memberEmail = uniqueEmail("member-prefetch");
    const ownerId = await createDisposableUser(ownerEmail, PASSWORD);
    let memberId: string | null = null;

    try {
      await loginAndExpectDashboard(page, ownerEmail, PASSWORD);
      const link = await inviteMemberAndGetLink(page, memberEmail);

      const invitedRows = await restSelect<{ user_id: string }>(
        "workspace_members",
        `workspace_id=eq.${ownerId}&status=eq.invited&select=user_id`,
      );
      memberId = invitedRows[0].user_id;

      const memberContext = await browser.newContext();
      const memberPage = await memberContext.newPage();

      // El "escáner" llega primero, como en el bug real reportado (el
      // usuario todavía no ha abierto el correo).
      for (let i = 0; i < 3; i++) {
        const response = await memberPage.request.get(link);
        expect(response.ok()).toBe(true);
      }

      // Y solo AHORA la persona real abre el enlace y hace clic.
      await acceptInviteThroughUi(memberPage, link);
      await expect(memberPage).toHaveURL(/\/dashboard/);

      const activeRows = await restSelect<{ status: string }>(
        "workspace_members",
        `user_id=eq.${memberId}&workspace_id=eq.${ownerId}&select=status`,
      );
      expect(activeRows).toHaveLength(1);
      expect(activeRows[0].status).toBe("active");

      await memberContext.close();
    } finally {
      await restDelete("workspace_activity", `workspace_id=eq.${ownerId}`);
      if (memberId) await deleteUser(memberId);
      await deleteUser(ownerId);
    }
  });

  test("un segundo clic con el mismo token, tras ya haberse usado, falla de forma segura sin duplicar la membresía", async ({
    page,
    browser,
  }) => {
    const ownerEmail = uniqueEmail("owner-replay");
    const memberEmail = uniqueEmail("member-replay");
    const ownerId = await createDisposableUser(ownerEmail, PASSWORD);
    let memberId: string | null = null;

    try {
      await loginAndExpectDashboard(page, ownerEmail, PASSWORD);
      const link = await inviteMemberAndGetLink(page, memberEmail);

      const invitedRows = await restSelect<{ user_id: string }>(
        "workspace_members",
        `workspace_id=eq.${ownerId}&status=eq.invited&select=user_id`,
      );
      memberId = invitedRows[0].user_id;

      // Dos pestañas independientes abren el MISMO enlace antes de que
      // ninguna acepte — ambas quedan con el formulario ya renderizado y
      // el token_hash aún válido en un input oculto.
      const contextA = await browser.newContext();
      const pageA = await contextA.newPage();
      await pageA.goto(link);
      await expect(
        pageA.getByRole("button", { name: "Aceptar invitación" }),
      ).toBeVisible();

      const contextB = await browser.newContext();
      const pageB = await contextB.newPage();
      await pageB.goto(link);
      await expect(
        pageB.getByRole("button", { name: "Aceptar invitación" }),
      ).toBeVisible();

      // La pestaña A acepta primero — consume el token real.
      await pageA.getByRole("button", { name: "Aceptar invitación" }).click();
      await pageA.waitForURL(/\/accept-invite\/set-password$/, {
        timeout: 15_000,
      });

      // La pestaña B, con el MISMO formulario ya cargado (nunca se
      // recargó), envía el mismo token_hash. verifyOtp debe rechazarlo:
      // se queda en la misma página con un mensaje de error, sin sesión
      // nueva ni segunda aceptación.
      await pageB.getByRole("button", { name: "Aceptar invitación" }).click();
      await expect(
        pageB.getByText(
          "El enlace ya se usó o expiró. Pide una nueva invitación.",
        ),
      ).toBeVisible();
      await expect(pageB).toHaveURL(link);

      await contextA.close();
      await contextB.close();

      // Exactamente una membresía activa, y exactamente un evento de
      // aceptación en la auditoría — el segundo intento no dejó rastro.
      const rows = await restSelect<{ status: string }>(
        "workspace_members",
        `user_id=eq.${memberId}&workspace_id=eq.${ownerId}&select=status`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("active");

      const acceptedEvents = await restSelect<{ id: string }>(
        "workspace_activity",
        `workspace_id=eq.${ownerId}&target_user_id=eq.${memberId}&event_type=eq.member_invitation_accepted&select=id`,
      );
      expect(acceptedEvents).toHaveLength(1);
    } finally {
      await restDelete("workspace_activity", `workspace_id=eq.${ownerId}`);
      if (memberId) await deleteUser(memberId);
      await deleteUser(ownerId);
    }
  });

  test("una invitación revocada antes de aceptarse no puede aceptarse", async ({
    page,
    browser,
  }) => {
    const ownerEmail = uniqueEmail("owner-revoked");
    const memberEmail = uniqueEmail("member-revoked");
    const ownerId = await createDisposableUser(ownerEmail, PASSWORD);
    let memberId: string | null = null;

    try {
      await loginAndExpectDashboard(page, ownerEmail, PASSWORD);
      const link = await inviteMemberAndGetLink(page, memberEmail);

      const invitedRows = await restSelect<{ user_id: string }>(
        "workspace_members",
        `workspace_id=eq.${ownerId}&status=eq.invited&select=user_id`,
      );
      memberId = invitedRows[0].user_id;

      // Simula lo que suspend_workspace_member dejaría (la UI no expone el
      // botón "Suspender" para una fila 'invited' — ver MemberRow.tsx —
      // pero el RPC no lo impide: un propietario podría revocar el acceso
      // de alguien justo después de invitarlo, antes de que acepte).
      await restUpdate(
        "workspace_members",
        `workspace_id=eq.${ownerId}&user_id=eq.${memberId}`,
        { status: "revoked" },
      );

      const memberContext = await browser.newContext();
      const memberPage = await memberContext.newPage();
      await memberPage.goto(link);
      await expect(
        memberPage.getByRole("heading", { name: "Esta invitación fue revocada" }),
      ).toBeVisible();
      await expect(
        memberPage.getByRole("button", { name: "Aceptar invitación" }),
      ).not.toBeVisible();
      await memberContext.close();

      const rows = await restSelect<{ status: string }>(
        "workspace_members",
        `user_id=eq.${memberId}&workspace_id=eq.${ownerId}&select=status`,
      );
      expect(rows[0].status).toBe("revoked");
    } finally {
      await restDelete("workspace_activity", `workspace_id=eq.${ownerId}`);
      if (memberId) await deleteUser(memberId);
      await deleteUser(ownerId);
    }
  });

  test("remover a un invitado y volver a invitarlo funciona: el correo nuevo con el nuevo rol se acepta, y el enlace viejo queda invalidado", async ({
    page,
    browser,
  }) => {
    const ownerEmail = uniqueEmail("owner-reinvite");
    const memberEmail = uniqueEmail("member-reinvite");
    const ownerId = await createDisposableUser(ownerEmail, PASSWORD);
    let memberId: string | null = null;

    try {
      await loginAndExpectDashboard(page, ownerEmail, PASSWORD);
      const firstLink = await inviteMemberAndGetLink(page, memberEmail);

      const invitedRows = await restSelect<{ user_id: string; role: string }>(
        "workspace_members",
        `workspace_id=eq.${ownerId}&status=eq.invited&select=user_id,role`,
      );
      memberId = invitedRows[0].user_id;
      expect(invitedRows[0].role).toBe("asistente"); // rol por defecto del formulario

      // El propietario remueve al invitado antes de que acepte nada.
      await page.reload();
      await page.getByRole("button", { name: "Remover" }).click();
      await page.getByRole("button", { name: "Sí, remover" }).click();
      await expect(page.getByText("Miembros (1)")).toBeVisible();

      // Nota: NO se filtra solo por user_id — a diferencia del caso normal
      // (donde accept_workspace_invitation ya borró el Workspace personal
      // de bootstrap al aceptar), aquí se remueve ANTES de aceptar, así
      // que ese Workspace de bootstrap (workspace_id === memberId, propio,
      // ver bootstrap_workspace_for_new_user) sigue existiendo — lo único
      // que remove_workspace_member borra es la fila del Workspace real.
      const rowsAfterRemoval = await restSelect<{ id: string }>(
        "workspace_members",
        `user_id=eq.${memberId}&workspace_id=eq.${ownerId}&select=id`,
      );
      expect(rowsAfterRemoval).toHaveLength(0);

      // Lo reinvita, ahora con otro rol. A diferencia del caso cubierto en
      // team-management-authenticated.spec.ts (donde el removido YA tenía
      // contraseña — cuenta confirmada — y por eso inviteUserByEmail
      // responde email_exists sin enviar correo), esta cuenta nunca llegó
      // a aceptar la primera invitación: sigue sin confirmar, así que
      // Supabase Auth SÍ trata esto como una invitación nueva — emite un
      // token nuevo y envía un correo nuevo, invalidando el de antes.
      const secondSentAfter = new Date();
      await page.reload();
      await page.getByLabel("Correo electrónico").fill(memberEmail);
      await page.getByLabel("Rol").selectOption("solo_lectura");
      await page.getByRole("button", { name: "Invitar" }).click();
      await expect(page.getByText("Invitación enviada.")).toBeVisible();

      const reinvitedRows = await restSelect<{ user_id: string; role: string }>(
        "workspace_members",
        `workspace_id=eq.${ownerId}&status=eq.invited&select=user_id,role`,
      );
      expect(reinvitedRows).toHaveLength(1);
      expect(reinvitedRows[0].role).toBe("solo_lectura");

      const secondMessage = await waitForLatestEmail(memberEmail, secondSentAfter);
      const secondLink = normalizeLinkHost(
        extractFirstLink(secondMessage.HTML),
        page,
      );
      expect(secondLink).not.toBe(firstLink);

      // El enlace NUEVO acepta correctamente, con el rol de la NUEVA
      // invitación.
      const memberContext = await browser.newContext();
      const memberPage = await memberContext.newPage();
      await acceptInviteThroughUi(memberPage, secondLink);
      await expect(memberPage).toHaveURL(/\/dashboard/);

      const finalRows = await restSelect<{ status: string; role: string }>(
        "workspace_members",
        `user_id=eq.${memberId}&workspace_id=eq.${ownerId}&select=status,role`,
      );
      expect(finalRows).toHaveLength(1);
      expect(finalRows[0]).toEqual({ status: "active", role: "solo_lectura" });

      // Bono: el enlace VIEJO (de la primera invitación, ya superada por
      // la reinvitación y ya aceptada vía secondLink) no ofrece ningún
      // botón para "revivir" la invitación — el correo ya es miembro
      // activo, así que la vista previa lo dice explícitamente en vez de
      // mostrar "Aceptar invitación".
      const staleContext = await browser.newContext();
      const stalePage = await staleContext.newPage();
      await stalePage.goto(firstLink);
      await expect(
        stalePage.getByRole("heading", { name: "Esta invitación ya fue aceptada" }),
      ).toBeVisible();
      await expect(
        stalePage.getByRole("button", { name: "Aceptar invitación" }),
      ).not.toBeVisible();
      await staleContext.close();

      await memberContext.close();
    } finally {
      await restDelete("workspace_activity", `workspace_id=eq.${ownerId}`);
      if (memberId) await deleteUser(memberId);
      await deleteUser(ownerId);
    }
  });

  test("el token nunca aparece en la URL final ni en pantalla tras aceptar la invitación", async ({
    page,
    browser,
  }) => {
    const ownerEmail = uniqueEmail("owner-notoken");
    const memberEmail = uniqueEmail("member-notoken");
    const ownerId = await createDisposableUser(ownerEmail, PASSWORD);
    let memberId: string | null = null;

    try {
      await loginAndExpectDashboard(page, ownerEmail, PASSWORD);
      const link = await inviteMemberAndGetLink(page, memberEmail);
      const tokenHash = new URL(link).searchParams.get("token_hash");
      expect(tokenHash).toBeTruthy();

      const invitedRows = await restSelect<{ user_id: string }>(
        "workspace_members",
        `workspace_id=eq.${ownerId}&status=eq.invited&select=user_id`,
      );
      memberId = invitedRows[0].user_id;

      const memberContext = await browser.newContext();
      const memberPage = await memberContext.newPage();
      await memberPage.goto(link);
      await memberPage.getByRole("button", { name: "Aceptar invitación" }).click();

      await memberPage.waitForURL(/\/accept-invite\/set-password$/, {
        timeout: 15_000,
      });
      expect(memberPage.url()).not.toContain(tokenHash!);
      await expect(memberPage.getByText(tokenHash!)).toHaveCount(0);

      await memberPage.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
      await memberPage.getByLabel("Confirmar contraseña").fill(PASSWORD);
      await memberPage
        .getByRole("button", { name: "Guardar contraseña y continuar" })
        .click();
      await memberPage.waitForURL(/\/dashboard/, { timeout: 15_000 });
      expect(memberPage.url()).not.toContain(tokenHash!);
      await expect(memberPage.getByText(tokenHash!)).toHaveCount(0);

      await memberContext.close();
    } finally {
      await restDelete("workspace_activity", `workspace_id=eq.${ownerId}`);
      if (memberId) await deleteUser(memberId);
      await deleteUser(ownerId);
    }
  });
});
