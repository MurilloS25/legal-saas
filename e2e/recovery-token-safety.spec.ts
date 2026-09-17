import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDisposableUser, deleteUser } from "./support/supabase-admin";
import { waitForLatestEmail, extractFirstLink } from "./support/mailpit";

// Regresión del mismo bug real ya corregido para invitaciones (ver
// e2e/invite-token-safety-authenticated.spec.ts y
// docs/AUTH_SECURITY.md): /auth/confirm?type=recovery ejecutaba
// verifyOtp — que consume el token de un solo uso — como efecto
// secundario de un simple GET. Cualquier prefetch de navegador, un
// antivirus o un escáner de enlaces de correo podían "usar" el enlace de
// recuperación antes que la persona real.
//
// e2e/auth-security-hardening.spec.ts (test E) ya cubre el flujo feliz
// completo (pedir enlace → restablecer → la contraseña vieja deja de
// servir, la nueva sí) con Mailpit real. Este archivo cubre
// específicamente la seguridad del token, con el mismo patrón usado para
// invitaciones: que un GET nunca lo consume, que un segundo uso falla
// limpio, y que un token inválido no permite continuar.
test.setTimeout(120_000);

const PASSWORD = "Segura!DePrueba9";

function uniqueEmail(label: string): string {
  return `e2e-recovery-safety-${label}-${randomUUID()}@example.com`;
}

function normalizeLinkHost(rawLink: string, page: Page): string {
  const link = new URL(rawLink);
  link.host = new URL(page.url()).host;
  return link.toString();
}

async function requestResetAndGetLink(
  page: Page,
  email: string,
): Promise<string> {
  const sentAfter = new Date();
  await page.goto("/forgot-password");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByText("Revisa tu correo")).toBeVisible();
  const message = await waitForLatestEmail(email, sentAfter);
  return normalizeLinkHost(extractFirstLink(message.HTML), page);
}

async function completeResetThroughUi(
  page: Page,
  link: string,
  newPassword: string,
): Promise<void> {
  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: "Crear nueva contraseña" }),
  ).toBeVisible();
  await page.getByLabel("Contraseña nueva").fill(newPassword);
  await page.getByLabel("Confirmar contraseña").fill(newPassword);
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe("seguridad del token de recuperación (un GET no debe consumirlo)", () => {
  test.describe.configure({ mode: "serial" });

  test("un GET simple, y varios GET consecutivos, al enlace no consumen el token", async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail("getsafe");
    const userId = await createDisposableUser(email, PASSWORD);

    try {
      const link = await requestResetAndGetLink(page, email);

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

      // El token sigue intacto: la contraseña original todavía funciona
      // para iniciar sesión.
      await page.goto("/login");
      await page.getByLabel("Correo electrónico").fill(email);
      await page.getByLabel("Contraseña").fill(PASSWORD);
      await page.getByRole("button", { name: "Ingresar" }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    } finally {
      await deleteUser(userId);
    }
  });

  test("un prefetch simulado (varios GET) seguido del clic real del usuario funciona igual que sin prefetch", async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail("prefetch");
    const userId = await createDisposableUser(email, PASSWORD);
    const newPassword = "OtraClave!Segura7";

    try {
      const link = await requestResetAndGetLink(page, email);

      const memberContext = await browser.newContext();
      const memberPage = await memberContext.newPage();

      // El "escáner" llega primero, como en el bug real reportado.
      for (let i = 0; i < 3; i++) {
        const response = await memberPage.request.get(link);
        expect(response.ok()).toBe(true);
      }

      // Y solo AHORA la persona real abre el enlace y hace clic.
      await completeResetThroughUi(memberPage, link, newPassword);
      await expect(memberPage).toHaveURL(/\/dashboard/);
      await memberContext.close();
    } finally {
      await deleteUser(userId);
    }
  });

  test("un segundo clic con el mismo token, tras ya haberse usado, falla de forma segura — mismo mensaje genérico que un token expirado", async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail("replay");
    const userId = await createDisposableUser(email, PASSWORD);
    const newPassword = "OtraClave!Segura7";

    try {
      const link = await requestResetAndGetLink(page, email);

      // Dos pestañas independientes abren el MISMO enlace antes de que
      // ninguna confirme — ambas quedan con el formulario ya renderizado
      // y el token_hash aún válido en un input oculto.
      const contextA = await browser.newContext();
      const pageA = await contextA.newPage();
      await pageA.goto(link);
      await expect(pageA.getByRole("button", { name: "Guardar contraseña" })).toBeVisible();

      const contextB = await browser.newContext();
      const pageB = await contextB.newPage();
      await pageB.goto(link);
      await expect(pageB.getByRole("button", { name: "Guardar contraseña" })).toBeVisible();

      // La pestaña A confirma primero — consume el token real, y completa
      // el restablecimiento.
      await expect(
        pageA.getByRole("heading", { name: "Crear nueva contraseña" }),
      ).toBeVisible();
      await pageA.getByLabel("Contraseña nueva").fill(newPassword);
      await pageA.getByLabel("Confirmar contraseña").fill(newPassword);
      await pageA.getByRole("button", { name: "Guardar contraseña" }).click();
      await pageA.waitForURL(/\/dashboard/, { timeout: 15_000 });

      // La pestaña B, con el MISMO formulario ya cargado (nunca se
      // recargó), envía el mismo token_hash. verifyOtp debe rechazarlo —
      // exactamente el mismo mensaje genérico que vería alguien con un
      // token realmente expirado, ya que el código no puede (ni necesita)
      // distinguir ambos casos.
      await pageB.getByLabel("Contraseña nueva").fill(newPassword);
      await pageB.getByLabel("Confirmar contraseña").fill(newPassword);
      await pageB.getByRole("button", { name: "Guardar contraseña" }).click();
      await expect(
        pageB.getByText("El enlace ya se usó o expiró. Solicita uno nuevo."),
      ).toBeVisible();
      await expect(pageB).toHaveURL(link);

      await contextA.close();
      await contextB.close();
    } finally {
      await deleteUser(userId);
    }
  });

  test("un token inválido o manipulado no permite continuar", async ({
    page,
  }) => {
    const email = uniqueEmail("invalid");
    const userId = await createDisposableUser(email, PASSWORD);

    try {
      await page.goto(
        `/reset-password?token_hash=not-a-real-token&email=${encodeURIComponent(email)}`,
      );
      await expect(
        page.getByRole("heading", { name: "Crear nueva contraseña" }),
      ).toBeVisible();
      await page.getByLabel("Contraseña nueva").fill("OtraClave!Segura7");
      await page.getByLabel("Confirmar contraseña").fill("OtraClave!Segura7");
      await page.getByRole("button", { name: "Guardar contraseña" }).click();
      await expect(
        page.getByText("El enlace ya se usó o expiró. Solicita uno nuevo."),
      ).toBeVisible();
      // Sin token_hash/email en absoluto: la página muestra directamente
      // el estado inválido, sin ofrecer ningún botón.
      await page.goto("/reset-password");
      await expect(
        page.getByRole("heading", { name: "Enlace no válido o expirado" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Guardar contraseña" }),
      ).not.toBeVisible();
    } finally {
      await deleteUser(userId);
    }
  });

  test("el token nunca aparece en la URL final ni en pantalla tras restablecer la contraseña", async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail("notoken");
    const userId = await createDisposableUser(email, PASSWORD);
    const newPassword = "OtraClave!Segura7";

    try {
      const link = await requestResetAndGetLink(page, email);
      const tokenHash = new URL(link).searchParams.get("token_hash");
      expect(tokenHash).toBeTruthy();

      const memberContext = await browser.newContext();
      const memberPage = await memberContext.newPage();
      await memberPage.goto(link);
      await memberPage.getByLabel("Contraseña nueva").fill(newPassword);
      await memberPage.getByLabel("Confirmar contraseña").fill(newPassword);
      await memberPage.getByRole("button", { name: "Guardar contraseña" }).click();
      await memberPage.waitForURL(/\/dashboard/, { timeout: 15_000 });
      expect(memberPage.url()).not.toContain(tokenHash!);
      await expect(memberPage.getByText(tokenHash!)).toHaveCount(0);

      await memberContext.close();
    } finally {
      await deleteUser(userId);
    }
  });
});
