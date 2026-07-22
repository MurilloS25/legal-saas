import fs from "fs";
import path from "path";
import { test as setup } from "@playwright/test";

const authDir = path.join(__dirname, "../playwright/.auth");
const authFile = path.join(authDir, "user.json");

setup("authenticate", async ({ page }) => {
  setup.setTimeout(30_000);

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

  // Public signup is disabled for the private pilot (/signup redirects to
  // /login — see the "disable public signup" release fix), so this can no
  // longer bootstrap the test user by signing up. Log in directly instead:
  // create the local E2E user once via Supabase Studio (Authentication →
  // Users) if it does not exist yet — the same "pilot users created
  // manually" model the production app now uses.
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();

  const loggedIn = await page
    .waitForURL(/\/dashboard/, { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);

  if (!loggedIn) {
    throw new Error(
      `Could not log in as ${email}. Create this user once in the local ` +
        "Supabase Studio (Authentication → Users → Add user, with email " +
        "confirmed) before running authenticated E2E tests.",
    );
  }

  // Persist the authenticated session for the authenticated projects.
  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: authFile });
});
