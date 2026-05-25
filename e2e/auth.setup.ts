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
      "E2E_USER_EMAIL and E2E_USER_PASSWORD are required for authenticated E2E tests.\n" +
        "Add them to .env.local:\n" +
        "  E2E_USER_EMAIL=your-test-user@example.com\n" +
        "  E2E_USER_PASSWORD=your-test-password\n" +
        "Create the user via Supabase local dashboard or the signup page.",
    );
  }

  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();

  await page.waitForURL(/\/dashboard/);

  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: authFile });
});
