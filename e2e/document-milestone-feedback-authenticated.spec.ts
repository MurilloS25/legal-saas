import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestDocument,
  createTestTemplate,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";

// Los hitos de "recién guardado"/"recién finalizado" viven solo en el
// estado del cliente de esa carga de página — cada test de Playwright abre
// su propia página, así que cada uno que necesita ver un hito produce el
// suyo. Serie para evitar carreras sobre el mismo usuario de prueba.
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

function contentEditor(page: Page) {
  return page.getByRole("region", { name: "Documento", exact: true });
}

function savedMilestoneBanner(page: Page) {
  return page
    .getByRole("status")
    .filter({ hasText: "Escritura guardada como borrador" });
}

function finalizedMilestoneBanner(page: Page) {
  return page.getByRole("status").filter({ hasText: "Escritura finalizada" });
}

test.describe("document milestone feedback", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "document-milestone-feedback");
  });

  test("A: creating a draft for the first time shows the milestone banner, its action jumps to Cuentas por cobrar, and a real subsequent save shows the plain message instead", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("document-milestone", "machote-a"),
      content: "ESCRITURA de prueba sin variables.",
    });

    await page.goto(`/dashboard/documents/new/${template.id}`);
    const title = uniqueName("document-milestone", "escritura-a");
    await page.getByLabel("Título de la escritura").fill(title);
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/?]+$/, {
      timeout: 30_000,
    });
    await registerCreatedViaUi(registry, "documents", "title", title);

    const banner = savedMilestoneBanner(page);
    await expect(banner).toBeVisible();
    await expect(
      banner.getByText(
        "La Escritura ya fue creada. Ahora puedes asociar cuentas por cobrar y continuar completando el documento.",
      ),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/saved=1/);

    const documentId = new URL(page.url()).pathname.split("/").pop();
    await expect(
      banner.getByRole("link", { name: "Ver Cuentas por cobrar" }),
    ).toHaveAttribute(
      "href",
      `/dashboard/documents/${documentId}?section=receivables`,
    );
    await banner.getByRole("link", { name: "Ver Cuentas por cobrar" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/dashboard/documents/${documentId}\\?section=receivables`),
    );
    await expect(
      page.getByRole("link", { name: "Nueva cuenta" }),
    ).toBeVisible();

    // Un guardado real posterior muestra el mensaje simple, no el hito.
    await page.goto(`/dashboard/documents/${documentId}`);
    await expect(savedMilestoneBanner(page)).toHaveCount(0);
    await page.getByLabel("Título de la escritura").fill(`${title} editado`);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByText("Borrador guardado.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(savedMilestoneBanner(page)).toHaveCount(0);
  });

  test("B: dismissing the saved milestone hides it and it does not reappear on reload", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("document-milestone", "machote-b"),
      content: "ESCRITURA de prueba sin variables.",
    });
    await page.goto(`/dashboard/documents/new/${template.id}`);
    const title = uniqueName("document-milestone", "escritura-b");
    await page.getByLabel("Título de la escritura").fill(title);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/(?!new)[^/?]+$/, {
      timeout: 30_000,
    });
    await registerCreatedViaUi(registry, "documents", "title", title);

    const banner = savedMilestoneBanner(page);
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Cerrar" }).click();
    await expect(banner).toHaveCount(0);

    await page.reload();
    await expect(savedMilestoneBanner(page)).toHaveCount(0);
  });

  test("C: finalizing shows the milestone banner with both actions, and reopening shows the plain (unchanged) reopened message", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("document-milestone", "machote-c"),
      content: "ESCRITURA de prueba sin variables.",
    });
    const title = uniqueName("document-milestone", "escritura-c");
    const doc = await createTestDocument(registry, template.id, {
      title,
      rendered_content: "ESCRITURA de prueba sin variables.",
    });

    await page.goto(`/dashboard/documents/${doc.id}`);
    await expect(contentEditor(page)).toBeVisible();
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    const dialog = page.getByRole("alertdialog", {
      name: "Finalizar escritura",
    });
    await dialog.getByRole("button", { name: "Finalizar escritura" }).click();

    const banner = finalizedMilestoneBanner(page);
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(
      banner.getByText(
        "Ahora puedes completar los datos del Índice Notarial y descargar el documento Word.",
      ),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/lifecycle=/);

    await expect(
      banner.getByRole("link", { name: "Ir al Índice Notarial" }),
    ).toHaveAttribute(
      "href",
      `/dashboard/documents/${doc.id}?section=notarial`,
    );
    await expect(
      banner.getByRole("button", { name: /Descargar Word/ }),
    ).toBeVisible();

    await banner.getByRole("link", { name: "Ir al Índice Notarial" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/dashboard/documents/${doc.id}\\?section=notarial`),
    );

    // "Reabrir escritura" vive en la sección Documento, no en Índice
    // notarial — volver ahí primero.
    await page.goto(`/dashboard/documents/${doc.id}`);

    // Reabrir usa el mensaje simple existente, sin cambios — no es un hito
    // de esta iteración.
    await page.getByRole("button", { name: "Reabrir escritura" }).click();
    const reopenDialog = page.getByRole("alertdialog", {
      name: "¿Reabrir la escritura?",
    });
    await reopenDialog.getByRole("button", { name: "Reabrir escritura" }).click();
    await expect(
      page.getByText("Escritura reabierta como borrador.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(finalizedMilestoneBanner(page)).toHaveCount(0);
  });
});
