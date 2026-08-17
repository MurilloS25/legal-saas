import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestDocument,
  createTestTemplate,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";

/**
 * El antiguo banner azul "Escritura guardada como borrador"/"Escritura
 * finalizada" (`MilestoneFeedback`) desapareció por completo — el primer
 * guardado y la finalización ahora muestran un toast temporal
 * (`useToast()`) que se autodescarta, sin ocupar espacio de layout ni un
 * botón "Ir a Revisar"/"Ir al Índice Notarial" redundante (la navegación ya
 * es automática). Este spec verifica ese reemplazo específicamente; el
 * resto del flujo guiado (auto-avance, ✓, errores) vive en
 * `document-guided-progression-authenticated.spec.ts`.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

function contentEditor(page: Page) {
  return page.getByRole("region", { name: "Documento", exact: true });
}

test.describe("document milestone feedback (toast replacement)", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "document-milestone-feedback");
  });

  test("A: creating a draft for the first time shows a toast (not the old banner), and no 'Ir a Revisar' link exists anywhere", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("document-milestone", "machote-a"),
      content: "ESCRITURA de prueba sin variables.",
    });

    await page.goto(`/dashboard/documents/new/${template.id}`);
    const title = uniqueName("document-milestone", "escritura-a");
    await page.getByLabel("Título de la escritura").fill(title);
    await page.getByRole("button", { name: "Guardar y continuar" }).click();

    // El primer guardado avanza automáticamente a "Revisar y finalizar".
    await expect(
      page,
    ).toHaveURL(/\/dashboard\/documents\/(?!new)[^/?]+\?.*section=revisar/, {
      timeout: 30_000,
    });
    await registerCreatedViaUi(registry, "documents", "title", title);

    // Toast de confirmación — se limpia también el `?saved=1` de la URL.
    await expect(
      page.getByRole("status").getByText("Escritura guardada.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page).not.toHaveURL(/saved=1/);

    // El banner antiguo (y su acción "Ir a Revisar") ya no existe.
    await expect(page.getByText("Escritura guardada como borrador")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ir a Revisar" })).toHaveCount(0);

    // El toast se autodescarta — no queda como banner permanente.
    await expect(
      page.getByText("Escritura guardada.", { exact: true }),
    ).toHaveCount(0, { timeout: 6_000 });

    // Un guardado real posterior también muestra el toast, no un banner.
    const documentId = new URL(page.url()).pathname.split("/").pop();
    await page.goto(`/dashboard/documents/${documentId}`);
    await page.getByLabel("Título de la escritura").fill(`${title} editado`);
    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(
      page.getByRole("status").getByText("Escritura guardada.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("B: finalizing shows a toast and lands on Cobro (not the old banner), and reopening still shows its own toast", async ({
    page,
  }) => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("document-milestone", "machote-b"),
      content: "ESCRITURA de prueba sin variables.",
    });
    const title = uniqueName("document-milestone", "escritura-b");
    const doc = await createTestDocument(registry, template.id, {
      title,
      rendered_content: "ESCRITURA de prueba sin variables.",
    });

    await page.goto(`/dashboard/documents/${doc.id}`);
    await expect(contentEditor(page)).toBeVisible();
    await page.getByRole("tab", { name: "Revisar y finalizar" }).click();
    await page.getByRole("button", { name: "Finalizar escritura" }).click();
    const dialog = page.getByRole("alertdialog", {
      name: "Finalizar escritura",
    });
    await dialog.getByRole("button", { name: "Finalizar escritura" }).click();

    // Toast, no banner — y aterriza en "Cobro" (regresión ya cubierta en
    // el spec de progresión guiada; aquí solo se confirma el feedback).
    await expect(
      page.getByRole("status").getByText("Escritura finalizada.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page).not.toHaveURL(/lifecycle=/);
    // El banner antiguo describía el hito con este texto y ofrecía un
    // enlace directo al Índice — ninguno de los dos existe ya.
    await expect(
      page.getByText(
        "Ahora puedes completar los datos del Índice Notarial y descargar el documento Word.",
      ),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Ir al Índice Notarial" }),
    ).toHaveCount(0);

    // "Reabrir escritura" vive en el paso "Revisar y finalizar".
    await page.goto(`/dashboard/documents/${doc.id}`);
    await page.getByRole("tab", { name: "Revisar y finalizar" }).click();
    await page.getByRole("button", { name: "Reabrir escritura" }).click();
    const reopenDialog = page.getByRole("alertdialog", {
      name: "¿Reabrir la escritura?",
    });
    await reopenDialog.getByRole("button", { name: "Reabrir escritura" }).click();
    await expect(
      page
        .getByRole("status")
        .getByText("Escritura reabierta como borrador.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page).not.toHaveURL(/lifecycle=/);
  });
});
