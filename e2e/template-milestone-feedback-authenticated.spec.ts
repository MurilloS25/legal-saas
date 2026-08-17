import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";

/**
 * El antiguo banner azul "Machote creado correctamente" (`MilestoneFeedback`,
 * con los botones "Revisar Variables"/"Configurar Índice Notarial")
 * desapareció por completo. El primer guardado ahora muestra un toast
 * temporal ("Machote guardado.") — los dos botones de atajo se eliminaron
 * deliberadamente (simplificación consciente: el flujo guiado ya ofrece un
 * único siguiente paso claro vía auto-avance, y el stepper permanece
 * navegable en todo momento).
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

function contentEditor(page: Page) {
  return page.getByRole("textbox", { name: "Contenido del machote" });
}

async function createTemplateViaUi(page: Page, name: string) {
  await page.goto("/dashboard/templates/new");
  await page.getByRole("tab", { name: "Información", exact: true }).click();
  await page.getByLabel("Nombre del machote").fill(name);
  await page.getByRole("tab", { name: "Documento", exact: true }).click();
  await contentEditor(page).click();
  await page.keyboard.type("Contenido de prueba del hito.");
  await page.getByRole("button", { name: "Crear machote" }).click();
  await expect(page).toHaveURL(/\/dashboard\/templates\/(?!new)[^/]+/, {
    timeout: 30_000,
  });
}

test.describe("template milestone feedback (toast replacement)", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "template-milestone-feedback");
  });

  test("A: creating a template for the first time shows a toast (not the old banner or its shortcut buttons)", async ({
    page,
  }) => {
    const name = uniqueName("template-milestone", "machote-a");
    await createTemplateViaUi(page, name);
    await registerCreatedViaUi(registry, "templates", "name", name);

    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    // El `?created=1` efímero se limpia de la URL — no debe sobrevivir.
    await expect(page).not.toHaveURL(/created=1/);

    // El banner antiguo y sus botones de atajo ya no existen en ningún
    // lado de la página.
    await expect(page.getByText("Machote creado correctamente")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Revisar Variables" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Configurar Índice Notarial" }),
    ).toHaveCount(0);
  });

  test("B: a real subsequent save shows the same toast, not a milestone banner, and direct access never shows one", async ({
    page,
  }) => {
    const name = uniqueName("template-milestone", "machote-b");
    await createTemplateViaUi(page, name);
    await registerCreatedViaUi(registry, "templates", "name", name);
    const templateUrl = page.url();

    // Reabrir directamente (sin created=1 en la URL) nunca dispara el
    // toast de creación.
    await page.goto(templateUrl);
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toHaveCount(0);

    await page.getByRole("tab", { name: "Información", exact: true }).click();
    await page.getByLabel("Descripción (opcional)").fill("Descripción editada");
    await page.getByRole("button", { name: "Guardar y continuar" }).click();

    await expect(
      page.getByRole("status").getByText("Machote guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Machote creado correctamente")).toHaveCount(0);
  });
});
