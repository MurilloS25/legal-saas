import fs from "fs";
import path from "path";
import { test as setup } from "@playwright/test";

const authDir = path.join(__dirname, "../playwright/.auth");
const authFile = path.join(authDir, "user.json");

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_USER_EMAIL and E2E_USER_PASSWORD are required.\n" +
        "Add them to .env.local:\n" +
        "  E2E_USER_EMAIL=e2e-test@example.com\n" +
        "  E2E_USER_PASSWORD=Test.E2E.Password.123",
    );
  }

  // 1. Try to sign up — succeeds on the first run (user does not exist yet).
  //    Supabase local has enable_confirmations = false so a successful signup
  //    redirects straight to /dashboard without email verification.
  await page.goto("/signup");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByLabel("Confirmar contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  const signedUp = await page
    .waitForURL(/\/dashboard/, { timeout: 8_000 })
    .then(() => true)
    .catch(() => false);

  // 2. If signup failed (user already exists), fall back to regular login.
  if (!signedUp) {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL(/\/dashboard/);
  }

  // 3. Persist the authenticated session for the chromium-authenticated project.
  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: authFile });
});
