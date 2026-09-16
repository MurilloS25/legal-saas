import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDisposableUser, deleteUser, restDelete, restInsert, restSelect } from "./support/supabase-admin";

test.setTimeout(180_000);
const password = "Segura!DePrueba9";

async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test("release A: assistant saves owner document; owner finalizes assistant document; admin preserves settings creator", async ({ page }) => {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid");
  expect(["localhost", "127.0.0.1"]).toContain(url.hostname);
  const users: string[] = [];
  const ownerEmail = `release-owner-${randomUUID()}@example.com`;
  const assistantEmail = `release-assistant-${randomUUID()}@example.com`;
  const adminEmail = `release-admin-${randomUUID()}@example.com`;
  try {
    const owner = await createDisposableUser(ownerEmail, password); users.push(owner);
    const assistant = await createDisposableUser(assistantEmail, password); users.push(assistant);
    const admin = await createDisposableUser(adminEmail, password); users.push(admin);
    for (const [user, role] of [[assistant, "asistente"], [admin, "administrador"]]) {
      await restInsert("workspace_members", { workspace_id: owner, user_id: user, role, status: "active" });
    }
    const template = await restInsert("templates", {
      owner_id: owner, workspace_id: owner, name: "Machote release A", status: "active",
      content_json: { text: "Contenido de prueba." }, text_preview: "Contenido de prueba.",
    });
    const ownDoc = await restInsert("documents", {
      owner_id: owner, workspace_id: owner, template_id: template.id,
      title: "Original propietario", rendered_content: "Contenido de prueba.",
    });
    const assistantDoc = await restInsert("documents", {
      owner_id: assistant, workspace_id: owner, template_id: template.id,
      title: "Original asistente", rendered_content: "Contenido de prueba.",
    });
    await restInsert("lawyer_profiles", { owner_id: owner, workspace_id: owner, full_name: "Despacho original" });

    await login(page, assistantEmail);
    await page.goto(`/dashboard/documents/${ownDoc.id}`);
    await page.getByLabel("Título de la escritura").fill("Guardada por asistente");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect.poll(async () => (await restSelect<{ title: string }>("documents", `id=eq.${ownDoc.id}&select=title`))[0]?.title).toBe("Guardada por asistente");
    await page.reload();
    await expect(page.getByLabel("Título de la escritura")).toHaveValue("Guardada por asistente");

    await login(page, ownerEmail);
    await page.goto(`/dashboard/documents/${assistantDoc.id}`);
    await page.getByRole("button", { name: "Finalizar escritura", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Finalizar escritura", exact: true }).click();
    await expect.poll(async () => (await restSelect<{ status: string }>("documents", `id=eq.${assistantDoc.id}&select=status`))[0]?.status).toBe("final");
    await page.reload();
    await expect(page.getByRole("button", { name: "Reabrir escritura", exact: true })).toBeVisible();
    expect((await restSelect<{ owner_id: string }>("documents", `id=eq.${assistantDoc.id}&select=owner_id`))[0]?.owner_id).toBe(assistant);

    await login(page, adminEmail);
    await page.goto("/dashboard/settings?tab=workspace");
    await page.getByLabel("Nombre completo").fill("Despacho editado por administrador");
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect.poll(async () => (await restSelect<{ full_name: string }>("lawyer_profiles", `workspace_id=eq.${owner}&select=full_name`))[0]?.full_name).toBe("Despacho editado por administrador");
    expect((await restSelect<{ owner_id: string }>("lawyer_profiles", `workspace_id=eq.${owner}&select=owner_id`))[0]?.owner_id).toBe(owner);
  } finally {
    // Remove the disposable workspace first: shared activity references actors
    // through restrictive FKs, so deleting a member first can fail cleanup.
    if (users[0]) await restDelete("workspaces", `id=eq.${users[0]}`);
    for (const user of users.reverse()) await deleteUser(user);
  }
});
