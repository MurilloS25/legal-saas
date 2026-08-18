import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestDocument,
  createTestTemplate,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";
import { currentCostaRicaFortnight } from "../src/features/notarial-index/model/fortnight";

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
    // El mensaje explica la relación con el Índice sin afirmar que sus
    // datos ya están completos — finalizar solo cambia status a "final".
    await expect(
      page
        .getByRole("status")
        .getByText(
          "Escritura finalizada. Ya puede aparecer en el Índice Notarial. Revisa el paso Índice para completar o corregir sus datos.",
          { exact: true },
        ),
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

    // Finalizar con la casilla "Incluir en el Índice Notarial" en su valor
    // por defecto (activada) ya la hace pertenecer al universo del Índice,
    // aunque nunca se configuró su metadata notarial — visible como "Sin
    // datos" (has_metadata=false), no ausente del listado. "Acto o
    // contrato" cae al nombre del machote (nunca "Sin configurar" habiendo
    // una fuente real). Sin authorized_at, effective_index_date la ubica
    // provisionalmente por created_at (hoy) — se navega a la quincena
    // actual, no a una fecha fija, porque ya no aparece en TODO período
    // (ver 20260818130000_notarial_index_inclusion.sql).
    const { year, month, half } = currentCostaRicaFortnight();
    await page.goto(
      `/dashboard/notarial-index?year=${year}&month=${month}&half=${half}&search=${encodeURIComponent(title)}`,
    );
    const row = page
      .locator("tr")
      .filter({ has: page.locator(`a[href="/dashboard/documents/${doc.id}"]`) });
    await expect(row).toBeVisible();
    await expect(row.getByText("Sin datos", { exact: true })).toBeVisible();
    await expect(row).toContainText(template.name);

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
