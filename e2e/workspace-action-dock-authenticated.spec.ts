import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestDocument,
  createTestTemplate,
  createTestTemplateField,
  runCleanup,
  uniqueName,
} from "./support/factories";

/**
 * El dock flotante de acciones (`WorkspaceActionDock`) nunca debe tapar
 * controles de la página: ni al llegar al final del scroll (el espacio
 * reservado sigue la altura real del dock, que crece cuando sus acciones
 * pasan a otra línea) ni al llevar un control a la vista (scroll-padding).
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

const registry = new CleanupRegistry();
const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 800, height: 600 },
  { width: 390, height: 700 },
];
const targets: Array<{ name: string; url: string }> = [];

/** Controles visibles de la página que el dock tapa (excluye los del dock). */
async function controlsUnderDock(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const dock = document.querySelector("[data-workspace-action-dock]");
    if (!dock) return [];
    const box = dock.getBoundingClientRect();
    return [...document.querySelectorAll("main button, main input, main select, main textarea, main a")]
      .filter((el) => !dock.contains(el))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.height > 0 &&
          r.width > 0 &&
          r.bottom > box.top &&
          r.top < box.bottom &&
          r.right > box.left &&
          r.left < box.right
        );
      })
      .map((el) => (el.textContent || el.getAttribute("name") || el.tagName).trim().slice(0, 40));
  });
}

test.describe("workspace action dock", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "workspace-dock");
  });

  test("A: seed a template, a draft and a finalized Escritura", async () => {
    const template = await createTestTemplate(registry, {
      name: uniqueName("workspace-dock", "machote"),
      content: "Comparece {{parte.nombre}}.",
    });
    await createTestTemplateField(registry, template.id, {
      field_key: "parte.nombre",
      label: "Parte",
      required: true,
    });
    const draft = await createTestDocument(registry, template.id, {
      title: uniqueName("workspace-dock", "borrador"),
      status: "draft",
      field_values: { "parte.nombre": "Persona" },
      rendered_content: "Comparece Persona.",
    });
    const final = await createTestDocument(registry, template.id, {
      title: uniqueName("workspace-dock", "final"),
      status: "final",
      field_values: { "parte.nombre": "Persona" },
      rendered_content: "Comparece Persona.",
    });
    targets.push(
      { name: "Escritura borrador (Completar)", url: `/documents/${draft.id}` },
      { name: "Escritura finalizada (Índice)", url: `/documents/${final.id}?section=notarial` },
      { name: "Machote (Índice)", url: `/templates/${template.id}?section=notarial` },
    );
  });

  test("B: at the end of the scroll no control is hidden behind the dock", async ({ page }) => {
    for (const target of targets) {
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        await page.goto(target.url);
        await page.waitForLoadState("networkidle");
        await expect(page.locator("[data-workspace-action-dock]")).toBeVisible();
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await expect
          .poll(() => controlsUnderDock(page), {
            message: `${target.name} @ ${viewport.width}x${viewport.height}`,
          })
          .toEqual([]);
      }
    }
  });

  test("C: bringing the Índice primary action into view never leaves it under the dock", async ({
    page,
  }) => {
    const target = targets.find((t) => t.name.startsWith("Escritura finalizada"))!;
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.goto(target.url);
      await page.waitForLoadState("networkidle");
      const save = page
        .getByRole("region", { name: "Datos para índice" })
        .getByRole("button", { name: "Guardar datos del índice" });
      await save.evaluate((el) => el.scrollIntoView({ block: "end" }));
      const [button, dock] = await Promise.all([
        save.boundingBox(),
        page.locator("[data-workspace-action-dock]").boundingBox(),
      ]);
      expect(button!.y + button!.height).toBeLessThanOrEqual(dock!.y);
    }
  });
});
