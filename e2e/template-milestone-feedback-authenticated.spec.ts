import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";

// El hito de "recién creado" solo ocurre una vez, justo tras crear vía UI,
// y vive únicamente en el estado del cliente de esa página — cada test de
// Playwright abre su propia página nueva, así que cada test que necesita
// ver el hito crea su propio machote. Serie para evitar carreras sobre el
// mismo usuario de prueba.
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

function contentEditor(page: Page) {
  return page.getByRole("textbox", { name: "Contenido del machote" });
}

function milestoneBanner(page: Page) {
  return page
    .getByRole("status")
    .filter({ hasText: "Machote creado correctamente" });
}

async function createTemplateViaUi(page: Page, name: string) {
  await page.goto("/dashboard/templates/new");
  // El nombre vive en el paso "Información" del stepper, visible desde la
  // creación; el editor vive en "Documento".
  await page.getByRole("tab", { name: "Información", exact: true }).click();
  await page.getByLabel("Nombre del machote").fill(name);
  await page.getByRole("tab", { name: "Documento", exact: true }).click();
  await contentEditor(page).click();
  await page.keyboard.type("Contenido de prueba del hito.");
  await page.getByRole("button", { name: "Crear machote" }).click();
  // El `?created=1` es efímero (el propio workspace lo limpia de la URL
  // apenas monta el hito) y guardar desde "Documento" ahora sí conserva
  // `?section=document` en el redirect — solo se afirma el id persistido.
  await expect(page).toHaveURL(/\/dashboard\/templates\/(?!new)[^/]+/, {
    timeout: 30_000,
  });
}

test.describe("template milestone feedback", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "template-milestone-feedback");
  });

  test("A: creating a template for the first time shows the milestone banner, and its actions switch tabs without losing it", async ({
    page,
  }) => {
    const name = uniqueName("template-milestone", "machote-a");
    await createTemplateViaUi(page, name);
    await registerCreatedViaUi(registry, "templates", "name", name);

    const banner = milestoneBanner(page);
    await expect(banner).toBeVisible();
    await expect(
      banner.getByText(
        "Ahora puedes configurar sus Variables y la información del Índice Notarial.",
      ),
    ).toBeVisible();

    // El created=1 efímero se limpia de la URL — no debe sobrevivir.
    await expect(page).not.toHaveURL(/created=1/);

    await banner.getByRole("button", { name: "Revisar Variables" }).click();
    await expect(
      page.getByRole("tab", { name: "Variables", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("region", { name: "Variables del machote" }),
    ).toBeVisible();
    // Cambiar de tab no descarta el banner.
    await expect(banner).toBeVisible();

    await banner
      .getByRole("button", { name: "Configurar Índice Notarial" })
      .click();
    await expect(
      page.getByRole("tab", { name: "Índice", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(banner).toBeVisible();
  });

  test("B: dismissing the banner hides it and it does not reappear on reload", async ({
    page,
  }) => {
    const name = uniqueName("template-milestone", "machote-b");
    await createTemplateViaUi(page, name);
    await registerCreatedViaUi(registry, "templates", "name", name);

    const banner = milestoneBanner(page);
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Cerrar" }).click();
    await expect(banner).toHaveCount(0);

    await page.reload();
    await expect(milestoneBanner(page)).toHaveCount(0);
  });

  test("C: a real subsequent save shows the plain saved message, not the milestone again, and direct access never shows it", async ({
    page,
  }) => {
    const name = uniqueName("template-milestone", "machote-c");
    await createTemplateViaUi(page, name);
    await registerCreatedViaUi(registry, "templates", "name", name);
    const templateUrl = page.url();

    // Reabrir directamente (sin created=1 en la URL, como cualquier
    // acceso posterior) nunca debe mostrar el hito.
    await page.goto(templateUrl);
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(milestoneBanner(page)).toHaveCount(0);

    // La descripción vive en el paso "Información" del stepper de edición.
    await page.getByRole("tab", { name: "Información", exact: true }).click();
    await page.getByLabel("Descripción (opcional)").fill("Descripción editada");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(
      page.getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(milestoneBanner(page)).toHaveCount(0);
  });
});
