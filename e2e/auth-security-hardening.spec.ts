import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  createDisposableUser,
  banUser,
  deleteUser,
} from "./support/supabase-admin";
import { waitForLatestEmail, extractFirstLink } from "./support/mailpit";

// Cobertura dirigida a la iteración de hardening de Auth. No depende de la
// sesión compartida (`playwright/.auth/user.json`) ni de la cadena de
// proyectos autenticados: cada test crea su propio usuario desechable vía la
// Admin API (necesaria para crear/revocar usuarios — no hay forma de hacerlo
// con la anon key + RLS, a diferencia del resto de los factories en
// `e2e/support/`). Esto evita interferir con `E2E_USER_EMAIL` y con el orden
// de ejecución de los demás módulos.
//
// Login inválido, signup bloqueado y rutas protegidas sin sesión ya están
// cubiertos por `e2e/auth-smoke.spec.ts` — no se duplican aquí.

const PASSWORD = "Segura!DePrueba9";

function uniqueEmail(label: string): string {
  return `e2e-auth-${label}-${randomUUID()}@example.com`;
}

// El primer request a cada ruta en un dev server recién arrancado compila
// bajo demanda y puede tardar varios segundos — más que el timeout por
// defecto de expect() (5s). Mismo margen que ya usa auth.setup.ts.
async function loginAndExpectDashboard(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test.describe("auth security hardening", () => {
  // Serial: cada test crea/loguea/borra su propio usuario desechable contra
  // el mismo dev server recién arrancado. Corriendo en paralelo, varios
  // workers compilan la misma ruta bajo demanda al mismo tiempo y el primer
  // login de cada uno se queda esperando la compilación — igual que
  // `auth.setup.ts` "calienta" el servidor una sola vez antes del resto de
  // la suite autenticada.
  test.describe.configure({ mode: "serial" });

  test("A: login válido con credenciales correctas entra al dashboard", async ({
    page,
  }) => {
    const email = uniqueEmail("valid-login");
    const userId = await createDisposableUser(email, PASSWORD);

    try {
      await page.goto("/login");
      await loginAndExpectDashboard(page, email, PASSWORD);
    } finally {
      await deleteUser(userId);
    }
  });

  test("B: logout invalida la sesión y las rutas protegidas vuelven a exigir login", async ({
    page,
  }) => {
    const email = uniqueEmail("logout");
    const userId = await createDisposableUser(email, PASSWORD);

    try {
      await page.goto("/login");
      await loginAndExpectDashboard(page, email, PASSWORD);

      await page.getByRole("button", { name: "Menú de usuario" }).click();
      await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
      await expect(page).toHaveURL(/\/login/);

      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login/);
    } finally {
      await deleteUser(userId);
    }
  });

  test("C: la sesión persiste después de recargar la página", async ({
    page,
  }) => {
    const email = uniqueEmail("persistent-session");
    const userId = await createDisposableUser(email, PASSWORD);

    try {
      await page.goto("/login");
      await loginAndExpectDashboard(page, email, PASSWORD);

      await page.reload();
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page).not.toHaveURL(/\/login/);
    } finally {
      await deleteUser(userId);
    }
  });

  test("D: un usuario revocado pierde el acceso de inmediato", async ({
    page,
  }) => {
    const email = uniqueEmail("revoked");
    const userId = await createDisposableUser(email, PASSWORD);

    try {
      await page.goto("/login");
      await loginAndExpectDashboard(page, email, PASSWORD);

      await banUser(userId);

      // La sesión ya emitida no se invalida instantáneamente en el cliente:
      // la próxima verificación server-side (proxy.ts llama a getUser() en
      // cada request) es la que corta el acceso.
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login/);
    } finally {
      await deleteUser(userId);
    }
  });

  test("E: recuperación de contraseña — enlace por correo permite establecer una nueva y la anterior deja de servir", async ({
    page,
  }) => {
    const email = uniqueEmail("recovery");
    const userId = await createDisposableUser(email, PASSWORD);
    const newPassword = "OtraClave!Segura7";

    try {
      const sentAfter = new Date();

      await page.goto("/forgot-password");
      await page.getByLabel("Correo electrónico").fill(email);
      await page.getByRole("button", { name: "Enviar enlace" }).click();
      await expect(page.getByText("Revisa tu correo")).toBeVisible();

      const message = await waitForLatestEmail(email, sentAfter);
      const rawLink = extractFirstLink(message.HTML);

      // El correo usa el host de site_url en config.toml (127.0.0.1), pero
      // /forgot-password se envió desde el baseURL de Playwright (localhost)
      // — la cookie code_verifier de PKCE quedó en ese host. Un usuario real
      // no tiene este problema (site_url == dominio real en producción); en
      // local, normalizamos el enlace al host actual de la página para no
      // perder la cookie al seguirlo.
      const link = new URL(rawLink);
      link.host = new URL(page.url()).host;

      await page.goto(link.toString());
      // Página intermedia (GET, sin sesión): el token todavía no se
      // consumió — solo se consume al enviar este botón, en un POST.
      await expect(
        page.getByRole("heading", { name: "Restablecer tu contraseña" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Continuar" }).click();
      await expect(
        page.getByRole("heading", { name: "Crear nueva contraseña" }),
      ).toBeVisible();

      await page.getByLabel("Contraseña nueva").fill(newPassword);
      await page.getByLabel("Confirmar contraseña").fill(newPassword);
      await page.getByRole("button", { name: "Guardar contraseña" }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

      await page.getByRole("button", { name: "Menú de usuario" }).click();
      await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
      await expect(page).toHaveURL(/\/login/);

      // La contraseña anterior ya no funciona.
      await page.getByLabel("Correo electrónico").fill(email);
      await page.getByLabel("Contraseña").fill(PASSWORD);
      await page.getByRole("button", { name: "Ingresar" }).click();
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(page).not.toHaveURL(/\/dashboard/);

      // La nueva contraseña sí funciona. Recarga a un formulario limpio en
      // vez de reutilizar los campos del intento anterior: el Server Action
      // fallido puede dejar el formulario en un estado transitorio del que
      // Playwright no espera automáticamente.
      await page.reload();
      await page.getByLabel("Correo electrónico").fill(email);
      await page.getByLabel("Contraseña").fill(newPassword);
      await expect(page.getByLabel("Correo electrónico")).toHaveValue(email);
      await expect(page.getByLabel("Contraseña")).toHaveValue(newPassword);
      await page.getByRole("button", { name: "Ingresar" }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    } finally {
      await deleteUser(userId);
    }
  });
});
