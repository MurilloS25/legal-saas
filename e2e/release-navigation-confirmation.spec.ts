import { expect as baseExpect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDisposableUser, deleteUser, restDelete, restInsert, restSelect } from "./support/supabase-admin";
const expect = baseExpect.configure({ timeout: 15_000 });
test.setTimeout(180_000);

async function fixture(page: Page) {
  expect(["localhost", "127.0.0.1"]).toContain(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname);
  const email = `release-c-${randomUUID()}@example.com`, password = "Segura!DePrueba9";
  const owner = await createDisposableUser(email, password);
  const cleanup = async () => { await restDelete("workspaces", `id=eq.${owner}`); await deleteUser(owner); };
  try {
    const template = await restInsert("templates", { owner_id: owner, workspace_id: owner, name: "Machote C", status: "active", content_json: { text: "Texto fijo." }, text_preview: "Texto fijo." });
    const document = await restInsert("documents", { owner_id: owner, workspace_id: owner, template_id: template.id, title: "Escritura C", rendered_content: "Texto fijo." });
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL(/\/dashboard/);
    return { owner, template, document, cleanup };
  } catch (error) { await cleanup(); throw error; }
}

for (const kind of ["documents", "templates"] as const) {
  test(`navigation: ${kind} protects links, menu, logout and reload but allows steps and saved exits`, async ({ page }) => {
    const data = await fixture(page);
    try {
      const row = kind === "documents" ? data.document : data.template;
      const path = `/${kind}/${row.id}`;
      const input = page.getByLabel(kind === "documents" ? "Título de la escritura" : "Nombre del machote");
      await page.goto(path);
      await input.fill("Edición pendiente");
      async function cancel() {
        const dialog = page.getByRole("alertdialog", { name: "¿Salir sin guardar?" });
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
        await expect(input).toHaveValue("Edición pendiente");
      }
      await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Panel", exact: true }).click();
      await cancel();
      await page.getByRole("link", { name: kind === "documents" ? "‹ Volver a Escrituras" : "‹ Machotes", exact: true }).click();
      await cancel();
      for (const name of ["Perfil", "Configuración", "Despacho", "Cerrar sesión"]) {
        await page.getByRole("button", { name: "Menú de usuario" }).click();
        await page.getByRole("button", { name, exact: true }).click();
        await cancel();
      }
      await page.getByRole("tab", { name: kind === "documents" ? "Cobro" : "Documento", exact: true }).click();
      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      await page.getByRole("tab", { name: kind === "documents" ? "Completar" : "Información", exact: true }).click();
      const dialogEvent = page.waitForEvent("dialog", { timeout: 15_000 });
      // Chromium can leave the canceled reload's navigation promise pending.
      const reload = page.reload({ timeout: 2_000 }).catch(() => null);
      const nativeDialog = await dialogEvent;
      expect(nativeDialog.type()).toBe("beforeunload");
      await nativeDialog.dismiss(); await reload;
      await expect(input).toHaveValue("Edición pendiente");
      await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Panel", exact: true }).click();
      await page.getByRole("button", { name: "Salir sin guardar", exact: true }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.goto(path);
      await input.fill("Edición guardada");
      await page.getByRole("button", { name: "Guardar", exact: true }).click();
      await expect(page.locator('p[role="status"]', { hasText: /^Guardado$/ })).toBeVisible();
      await page.getByRole("button", { name: "Menú de usuario" }).click();
      await page.getByRole("button", { name: "Perfil", exact: true }).click();
      await expect(page).toHaveURL(/settings\?tab=profile/);
      await page.goto(path); await input.fill("Salir con cambios");
      await page.getByRole("button", { name: "Menú de usuario" }).click();
      await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
      await page.getByRole("button", { name: "Salir sin guardar", exact: true }).click();
      await expect(page).toHaveURL(/\/login$/);
    } finally { await data.cleanup(); }
  });
  test(`navigation: ${kind} mobile drawer protects links and logout`, async ({ page }) => {
    const data = await fixture(page);
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      const row = kind === "documents" ? data.document : data.template;
      await page.goto(`/${kind}/${row.id}`);
      const input = page.getByLabel(kind === "documents" ? "Título de la escritura" : "Nombre del machote");
      await input.fill("Edición móvil");
      for (const name of ["Panel", "Perfil", "Configuración", "Despacho", "Cerrar sesión"]) {
        await page.getByRole("button", { name: "Abrir navegación" }).click();
        const drawer = page.getByRole("dialog", { name: "Menú de navegación" });
        if (name === "Cerrar sesión") await drawer.getByRole("button", { name }).click();
        else await drawer.getByRole("link", { name, exact: true }).click();
        const dialog = page.getByRole("alertdialog", { name: "¿Salir sin guardar?" });
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
        await expect(input).toHaveValue("Edición móvil");
        if (await drawer.isVisible()) await drawer.getByRole("button", { name: "Cerrar menú de navegación" }).click();
      }
    } finally { await data.cleanup(); }
  });
}

test("confirmation: save visible snapshot, reject stale version, correct and reopen", async ({ page, context }) => {
  const data = await fixture(page);
  try {
    await page.goto(`/documents/${data.document.id}`);
    await page.getByRole("button", { name: "Finalizar escritura", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Finalizar escritura", exact: true }).click();
    await expect.poll(async () => (await restSelect<{status: string}>("documents", `id=eq.${data.document.id}`))[0]?.status).toBe("final");
    await page.goto(`/documents/${data.document.id}?section=notarial`);
    const section = page.getByRole("region", { name: "Datos para índice" });
    for (const [row, fields] of [
      ["Número de instrumento", [["Número de instrumento", "101"]]],
      ["Fecha y hora de autorización", [["Fecha de autorización", "2026-09-10"], ["Hora de autorización", "10:00"]]],
      ["Acto o contrato", [["Acto o contrato", "Acto A"]]],
      ["Tomo", [["Tomo", "1"]]],
      ["Folios", [["Folio inicial", "1F"], ["Folio final", "1V"]]],
      ["Partes", [["Partes", "Parte A"]]],
      ["Notas", [["Notas internas", "Nota A"]]],
    ] as const) {
      await section.getByRole("button", { name: new RegExp(`^${row}`) }).click();
      for (const [label, value] of fields) {
        const input = label === "Notas internas" ? section.getByRole("textbox", { name: /Notas internas/ }) : section.getByLabel(label, { exact: true });
        await input.fill(value);
      }
    }
    await section.getByRole("button", { name: "Guardar datos del índice" }).click();
    await expect.poll(async () => (await restSelect<{notes: string}>("document_notarial_metadata", `document_id=eq.${data.document.id}`))[0]?.notes).toBe("Nota A");
    await expect(section.getByRole("button", { name: "Confirmar datos del Índice" })).toBeEnabled();
    await section.getByRole("textbox", { name: /Notas internas/ }).fill("Nota B");
    await expect(section.getByRole("button", { name: "Confirmar datos del Índice" })).toHaveCount(0);
    expect((await restSelect<{ notes: string; notarial_confirmed_at: string | null }>("document_notarial_metadata", `document_id=eq.${data.document.id}`))[0]).toMatchObject({ notes: "Nota A", notarial_confirmed_at: null });
    await section.getByRole("button", { name: "Guardar datos del índice" }).click();
    await expect(section.getByRole("button", { name: "Confirmar datos del Índice" })).toBeEnabled();
    const other = await context.newPage();
    try {
      await other.goto(`/documents/${data.document.id}?section=notarial`);
      await section.getByRole("textbox", { name: /Notas internas/ }).fill("Nota C");
      await section.getByRole("button", { name: "Guardar datos del índice" }).click();
      await expect.poll(async () => (await restSelect<{notes: string}>("document_notarial_metadata", `document_id=eq.${data.document.id}`))[0]?.notes).toBe("Nota C");
      await other.getByRole("button", { name: "Confirmar datos del Índice" }).click();
      await other.getByRole("alertdialog").getByRole("button", { name: "Confirmar datos", exact: true }).click();
      await expect(other.getByRole("alert").filter({ hasText: "cambiaron en otra sesión" })).toBeVisible();
      expect((await restSelect<{notarial_confirmed_at: string | null}>("document_notarial_metadata", `document_id=eq.${data.document.id}`))[0]?.notarial_confirmed_at).toBeNull();
    } finally { await other.close(); }
    async function confirm() {
      await section.getByRole("button", { name: "Confirmar datos del Índice" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar datos", exact: true }).click();
      await expect(section.getByText("Datos del Índice confirmados", { exact: true })).toBeVisible();
    }
    await confirm();
    await expect(section.getByRole("textbox", { name: /Notas internas/ })).toBeDisabled();
    await section.getByRole("button", { name: "Corregir datos", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Corregir datos", exact: true }).click();
    await expect(section.getByRole("textbox", { name: /Notas internas/ })).toBeEnabled();
    await section.getByRole("textbox", { name: /Notas internas/ }).fill("Nota D");
    await expect(section.getByRole("button", { name: "Confirmar datos del Índice" })).toHaveCount(0);
    await section.getByRole("button", { name: "Guardar datos del índice" }).click();
    await confirm();
    await page.getByRole("button", { name: "Reabrir escritura", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Reabrir escritura", exact: true }).click();
    await expect.poll(async () => (await restSelect<{notarial_confirmed_at: string | null}>("document_notarial_metadata", `document_id=eq.${data.document.id}`))[0]?.notarial_confirmed_at).toBeNull();
    expect((await restSelect<{notes: string; notarial_review_required: boolean}>("document_notarial_metadata", `document_id=eq.${data.document.id}`))[0]).toMatchObject({ notes: "Nota D", notarial_review_required: true });
  } finally { await data.cleanup(); }
});
