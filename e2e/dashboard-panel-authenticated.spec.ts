import { test, expect } from "@playwright/test";
import {
  CleanupRegistry,
  createTestClient,
  createTestDocument,
  createTestNotarialMetadata,
  createTestReceivable,
  createTestTemplate,
  runCleanup,
  uniqueName,
} from "./support/factories";

/**
 * Panel principal (dashboard): ausencia de acciones duplicadas, tarjetas
 * totalmente clicables, contenido real del Índice Notarial y de "Necesita
 * tu atención". El shell de navegación (navbar superior) tiene su propia
 * cobertura de navegación/responsive en `navbar-authenticated.spec.ts`.
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();

function todayCostaRicaIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

test.describe("dashboard panel", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "dashboard-panel");
  });

  test("A: only one 'Nueva escritura' action exists (no duplicate header CTA)", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: "Nueva escritura", exact: true }),
    ).toHaveCount(1);
  });

  test("C: seed a client, a final document with incomplete notarial metadata, and an overdue receivable", async () => {
    const client = await createTestClient(registry, {
      full_name: uniqueName("dashboard-panel", "cliente"),
      identification_number: "7-0707-0707",
    });

    const template = await createTestTemplate(registry, {
      name: uniqueName("dashboard-panel", "machote"),
      content: "ESCRITURA de prueba del panel.",
    });

    const document = await createTestDocument(registry, template.id, {
      title: uniqueName("dashboard-panel", "escritura"),
      client_id: client.id,
      status: "final",
      rendered_content: "ESCRITURA de prueba del panel.",
    });

    // Fecha de autorización dentro de la quincena actual, pero sin número
    // de instrumento: has_metadata=true, is_complete=false.
    await createTestNotarialMetadata(document.id, {
      authorized_at: todayCostaRicaIso(),
      act_type: "Compraventa de prueba",
      appearing_parties_summary: "Parte de prueba",
    });

    await createTestReceivable(registry, {
      client_id: client.id,
      concept: uniqueName("dashboard-panel", "vencida"),
      currency: "CRC",
      amount_total: "50000.00",
      issued_at: "2020-01-01",
      due_at: "2020-01-02",
    });
  });

  test("D: the notarial index tile reports a real incomplete count for the current fortnight and navigates", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const notarialCard = page
      .getByRole("main")
      .getByRole("link", { name: "Índice Notarial" });
    await expect(notarialCard).toBeVisible();
    await expect(
      notarialCard.getByText(/registro(s)? incompleto(s)? en la quincena actual/),
    ).toBeVisible();

    await notarialCard.click();
    await expect(page).toHaveURL(/\/dashboard\/notarial-index$/);
  });

  test("E: 'Necesita tu atención' shows the real overdue receivable, not a generic 'urgente' label", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const attention = page.getByRole("region", { name: "Necesita tu atención" });
    await expect(attention).toBeVisible();
    await expect(attention.getByText("Vencida", { exact: true }).first()).toBeVisible();
    await expect(attention.getByText(/urgente/i)).toHaveCount(0);

    await attention.getByRole("link", { name: "Ver cuentas por cobrar" }).click();
    await expect(page).toHaveURL(/\/dashboard\/receivables$/);
  });

  test("F: the Clientes card is fully clickable, not just its link text", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const clientsCard = page
      .getByRole("main")
      .getByRole("link", { name: /^Clientes/ });
    await expect(clientsCard).toBeVisible();
    // Click cerca del icono del encabezado, lejos del texto "Ver clientes".
    const box = await clientsCard.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + 12, box!.y + 12);

    await expect(page).toHaveURL(/\/dashboard\/clients$/);
  });

  test("G: quick actions share the same clickable card treatment and each link works", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const actions: Array<[string, RegExp]> = [
      ["Nuevo cliente", /\/dashboard\/clients\/new$/],
      ["Nuevo machote", /\/dashboard\/templates\/new$/],
      ["Nueva cuenta", /\/dashboard\/receivables\/new$/],
    ];

    for (const [label, urlPattern] of actions) {
      await page.goto("/dashboard");
      await page.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(urlPattern);
    }
  });
});
