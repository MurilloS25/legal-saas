import { expect as baseExpect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDisposableUser, deleteUser, restDelete, restInsert, restSelect } from "./support/supabase-admin";

test.setTimeout(180_000);
const expect = baseExpect.configure({ timeout: 15_000 });
const password = "Segura!DePrueba9";

async function fixture(page: Page) {
  expect(["localhost", "127.0.0.1"]).toContain(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname);
  const email = `release-save-${randomUUID()}@example.com`;
  const owner = await createDisposableUser(email, password);
  const template = await restInsert("templates", {
    owner_id: owner, workspace_id: owner, name: "Machote original", status: "active",
    content_json: { text: "Texto fijo." }, text_preview: "Texto fijo.",
  });
  const document = await restInsert("documents", {
    owner_id: owner, workspace_id: owner, template_id: template.id,
    title: "Escritura original", rendered_content: "Texto fijo.",
  });
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/dashboard/);
  return { owner, template, document, async cleanup() {
    await restDelete("workspaces", `id=eq.${owner}`);
    await deleteUser(owner);
  } };
}

async function holdSave(page: Page, requestNumber = 1) {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let held = false;
  let requests = 0;
  await page.route("**/dashboard/**", async route => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"] && ++requests === requestNumber) {
      held = true;
      await gate;
    }
    await route.continue();
  });
  return { release, isHeld: () => held };
}

for (const kind of ["documents", "templates"] as const) {
  test(`${kind}: editing during save stays dirty and the next save persists it`, async ({ page }) => {
    const data = await fixture(page);
    let release: (() => void) | undefined;
    try {
      const row = kind === "documents" ? data.document : data.template;
      const column = kind === "documents" ? "title" : "name";
      await page.goto(`/dashboard/${kind}/${row.id}`);
      const input = page.getByLabel(kind === "documents" ? "Título de la escritura" : "Nombre del machote");
      await expect(async () => {
        await input.fill("Edición A");
        await expect(page.getByRole("heading", { name: "Edición A", exact: true })).toBeVisible();
      }).toPass({ timeout: 30_000 });
      const held = await holdSave(page); release = held.release;
      await page.getByRole("button", { name: "Guardar", exact: true }).click({ noWaitAfter: true });
      await expect.poll(held.isHeld).toBe(true);
      await input.fill("Edición B");
      held.release();
      await expect.poll(async () => (await restSelect<Record<string, string>>(kind, `id=eq.${row.id}&select=${column}`))[0]?.[column]).toBe("Edición A");
      await expect(page.getByRole("button", { name: "Guardar", exact: true })).toBeEnabled();
      await expect(input).toHaveValue("Edición B");
      await expect(page.getByText("Cambios sin guardar", { exact: true }).first()).toBeVisible();
      if (kind === "documents") {
        await expect(page.getByRole("button", { name: "Finalizar escritura", exact: true })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Descargar Word", exact: true })).toBeDisabled();
      }
      await page.getByRole("button", { name: "Guardar", exact: true }).click();
      await expect.poll(async () => (await restSelect<Record<string, string>>(kind, `id=eq.${row.id}&select=${column}`))[0]?.[column]).toBe("Edición B");
      await expect(page.getByText("Cambios sin guardar", { exact: true })).toHaveCount(0);
      if (kind === "documents") {
        await expect(page.getByRole("button", { name: "Descargar Word", exact: true })).toBeEnabled();
        await page.getByRole("button", { name: "Finalizar escritura", exact: true }).click();
        await page.getByRole("alertdialog").getByRole("button", { name: "Finalizar escritura", exact: true }).click();
        await expect.poll(async () => (await restSelect<{ status: string }>(kind, `id=eq.${row.id}&select=status`))[0]?.status).toBe("final");
      }
    } finally { release?.(); await data.cleanup(); }
  });
}

test("documents: stale tab preserves edits and can save after explicit conflict resolution", async ({ page, context }) => {
  const data = await fixture(page);
  const other = await context.newPage();
  try {
    const path = `/dashboard/documents/${data.document.id}`;
    await page.goto(path); await other.goto(path);
    await page.getByLabel("Título de la escritura").fill("Edición A");
    await other.getByLabel("Título de la escritura").fill("Edición B");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect.poll(async () => (await restSelect<{ title: string }>("documents", `id=eq.${data.document.id}&select=title`))[0]?.title).toBe("Edición A");
    await other.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(other.getByRole("alert").filter({ hasText: "cambió" })).toBeVisible();
    await expect(other.getByLabel("Título de la escritura")).toHaveValue("Edición B");
    expect((await restSelect<{ title: string }>("documents", `id=eq.${data.document.id}&select=title`))[0]?.title).toBe("Edición A");
    await other.getByRole("button", { name: "Conservar mis cambios y reintentar", exact: true }).click();
    await expect.poll(async () => (await restSelect<{ title: string }>("documents", `id=eq.${data.document.id}&select=title`))[0]?.title).toBe("Edición B");
    await expect(other.getByText("Cambios sin guardar", { exact: true })).toHaveCount(0);
  } finally { await other.close(); await data.cleanup(); }
});

test("templates: index inclusion edited during its save remains pending", async ({ page }) => {
  const data = await fixture(page);
  let release: (() => void) | undefined;
  try {
    await page.goto(`/dashboard/templates/${data.template.id}?section=notarial`);
    const toggle = page.getByLabel("Incluir en Índice Notarial");
    await toggle.uncheck();
    // The first action loads fresh fields; the second persists the toggle.
    const held = await holdSave(page, 2); release = held.release;
    await page.getByRole("button", { name: "Guardar", exact: true }).click({ noWaitAfter: true });
    await expect.poll(held.isHeld).toBe(true);
    await toggle.check();
    held.release();
    await expect(page.getByRole("button", { name: "Guardar", exact: true })).toBeEnabled();
    await expect(toggle).toBeChecked();
    await expect(page.getByText("Cambios sin guardar", { exact: true }).first()).toBeVisible();
    expect((await restSelect<{ include_in_notarial_index_by_default: boolean }>("templates", `id=eq.${data.template.id}&select=include_in_notarial_index_by_default`))[0]?.include_in_notarial_index_by_default).toBe(false);
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect.poll(async () => (await restSelect<{ include_in_notarial_index_by_default: boolean }>("templates", `id=eq.${data.template.id}&select=include_in_notarial_index_by_default`))[0]?.include_in_notarial_index_by_default).toBe(true);
    await expect(page.getByText("Cambios sin guardar", { exact: true })).toHaveCount(0);
  } finally { release?.(); await data.cleanup(); }
});

test("templates: editor changes during save survive the response", async ({ page }) => {
  const data = await fixture(page);
  let release: (() => void) | undefined;
  try {
    await page.goto(`/dashboard/templates/${data.template.id}?section=document`);
    const editor = page.getByRole("textbox", { name: "Contenido del machote" });
    await editor.fill("Contenido A");
    const held = await holdSave(page); release = held.release;
    await page.getByRole("button", { name: "Guardar", exact: true }).click({ noWaitAfter: true });
    await expect.poll(held.isHeld).toBe(true);
    await editor.fill("Contenido B");
    held.release();
    await expect(page.getByRole("button", { name: "Guardar", exact: true })).toBeEnabled();
    await expect(editor).toHaveText("Contenido B");
    await expect(page.getByText("Cambios sin guardar", { exact: true }).first()).toBeVisible();
    expect((await restSelect<{ text_preview: string }>("templates", `id=eq.${data.template.id}&select=text_preview`))[0]?.text_preview).toBe("Contenido A");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect.poll(async () => (await restSelect<{ text_preview: string }>("templates", `id=eq.${data.template.id}&select=text_preview`))[0]?.text_preview).toBe("Contenido B");
    await expect(page.getByText("Cambios sin guardar", { exact: true })).toHaveCount(0);
  } finally { release?.(); await data.cleanup(); }
});

for (const kind of ["documents", "templates"] as const) {
  test(`${kind}: first save locks the workspace until redirect`, async ({ page }) => {
    const data = await fixture(page);
    let release: (() => void) | undefined;
    try {
      await page.goto(kind === "documents" ? `/dashboard/documents/new/${data.template.id}` : "/dashboard/templates/new");
      const input = page.getByLabel(kind === "documents" ? "Título de la escritura" : "Nombre del machote");
      await input.fill("Creación A");
      if (kind === "templates") {
        await page.getByRole("tab", { name: "Documento", exact: true }).click();
        await page.getByRole("textbox", { name: "Contenido del machote" }).fill("Texto inicial.");
      }
      const held = await holdSave(page); release = held.release;
      await page.getByRole("button", { name: kind === "documents" ? "Crear escritura" : "Crear machote", exact: true }).click({ noWaitAfter: true });
      await expect.poll(held.isHeld).toBe(true);
      await expect(page.getByRole("status").filter({ hasText: "Espera antes de continuar editando" })).toBeVisible();
      expect(await input.evaluate(element => element.closest("[inert]") !== null)).toBe(true);
      await page.keyboard.type("B");
      await expect(input).toHaveValue("Creación A");
      held.release();
      await expect(page).toHaveURL(new RegExp(`/dashboard/${kind}/[0-9a-f-]{36}(?:\\?|$)`));
      await expect(page.getByRole("heading", { name: "Creación A", exact: true })).toBeVisible();
    } finally { release?.(); await data.cleanup(); }
  });
}

test("templates: mapping selections made during save are retained", async ({ page }) => {
  const data = await fixture(page);
  let release: (() => void) | undefined;
  try {
    for (const [key, label] of [["parte_a", "Parte A"], ["parte_b", "Parte B"]]) {
      await restInsert("template_fields", {
        template_id: data.template.id, owner_id: data.owner,
        workspace_id: data.owner, field_key: key, label, field_type: "text", required: false,
      });
    }
    await page.goto(`/dashboard/templates/${data.template.id}?section=notarial`);
    await page.getByRole("button", { name: /^Partes/ }).click();
    await page.getByRole("radio", { name: "Requiere partes", exact: true }).click();
    await page.getByRole("checkbox", { name: /^Parte A/ }).check();
    const held = await holdSave(page, 2); release = held.release;
    await page.getByRole("button", { name: "Guardar", exact: true }).click({ noWaitAfter: true });
    await expect.poll(held.isHeld).toBe(true);
    await page.getByRole("checkbox", { name: /^Parte B/ }).check();
    held.release();
    await expect(page.getByRole("button", { name: "Guardar", exact: true })).toBeEnabled();
    await expect(page.getByRole("checkbox", { name: /^Parte B/ })).toBeChecked();
    await expect(page.getByText("Cambios sin guardar", { exact: true }).first()).toBeVisible();
    expect(await restSelect("template_index_configuration_fields", `template_id=eq.${data.template.id}`)).toHaveLength(1);
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect.poll(async () => (await restSelect("template_index_configuration_fields", `template_id=eq.${data.template.id}`)).length).toBe(2);
    await expect(page.getByText("Cambios sin guardar", { exact: true })).toHaveCount(0);
  } finally { release?.(); await data.cleanup(); }
});
