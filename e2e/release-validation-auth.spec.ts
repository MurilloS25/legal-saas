import { expect as baseExpect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  createDisposableUser,
  deleteUser,
  restDelete,
  restInsert,
  restSelect,
} from "./support/supabase-admin";

const expect = baseExpect.configure({ timeout: 15_000 });
test.setTimeout(120_000);

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/dashboard/);
}

async function ownerFixture(page: Page) {
  expect(["localhost", "127.0.0.1"]).toContain(
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
  );
  const email = `release-d-${randomUUID()}@example.com`;
  const password = "Segura!DePrueba9";
  const owner = await createDisposableUser(email, password);
  const cleanup = async () => {
    await restDelete("workspaces", `id=eq.${owner}`);
    await deleteUser(owner);
  };
  try {
    await login(page, email, password);
    return { owner, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

test("document title shows and clears each server validation error without losing edits", async ({ page }) => {
  const data = await ownerFixture(page);
  try {
    const template = await restInsert("templates", {
      owner_id: data.owner,
      workspace_id: data.owner,
      name: "Machote título D",
      status: "active",
      content_json: { text: "Texto fijo." },
      text_preview: "Texto fijo.",
    });
    const document = await restInsert("documents", {
      owner_id: data.owner,
      workspace_id: data.owner,
      template_id: template.id,
      title: "Título persistido",
      rendered_content: "Texto fijo.",
    });
    await page.goto(`/dashboard/documents/${document.id}`);
    const title = page.getByLabel("Título de la escritura");
    for (const [invalid, message] of [
      ["", "El título de la escritura es requerido"],
      ["   ", "El título de la escritura es requerido"],
      ["x".repeat(201), "El título es demasiado largo"],
    ] as const) {
      await title.fill(invalid);
      await page.getByRole("button", { name: "Guardar", exact: true }).click();
      await expect(page.getByText(message, { exact: true })).toBeVisible();
      await expect(title).toHaveAttribute("aria-invalid", "true");
      await expect(title).toHaveAttribute("aria-describedby", "composer-title-error");
      await expect(title).toHaveValue(invalid);
      await expect(page.getByText("Cambios sin guardar", { exact: true }).first()).toBeVisible();
      await title.fill("Título corregido");
      await expect(page.getByText(message, { exact: true })).toHaveCount(0);
    }
    expect(
      (await restSelect<{ title: string }>("documents", `id=eq.${document.id}&select=title`))[0]?.title,
    ).toBe("Título persistido");
  } finally {
    await data.cleanup();
  }
});

test("saving variant A does not require campo_b from inactive variant B", async ({ page }) => {
  const data = await ownerFixture(page);
  try {
    const template = await restInsert("templates", {
      owner_id: data.owner,
      workspace_id: data.owner,
      name: "Machote Option Block D",
      status: "active",
      text_preview: "Variante condicional",
      content_json: {
        text: "Sin campo B{{campo_b}}",
        doc: {
          type: "doc",
          content: [{
            type: "paragraph",
            content: [{
              type: "optionBlock",
              attrs: {
                blockId: "choice",
                name: "Selección",
                defaultVariantId: "a",
                variants: [
                  { id: "a", label: "Variante A", content: [{ type: "text", text: "Sin campo B" }] },
                  { id: "b", label: "Variante B", content: [{ type: "templateVariable", attrs: { key: "campo_b", label: "Campo B" } }] },
                ],
              },
            }],
          }],
        },
      },
    });
    await restInsert("template_fields", {
      owner_id: data.owner,
      workspace_id: data.owner,
      template_id: template.id,
      field_key: "campo_b",
      label: "Campo B",
      field_type: "text",
      required: true,
    });
    await page.goto(`/dashboard/documents/new/${template.id}`);
    await page.getByRole("button", { name: /Cambiar variante de Selección/ }).click();
    const variantA = page.getByRole("radio", { name: "Variante A" });
    await expect(variantA).toBeChecked();
    await variantA.click();
    await page.getByRole("button", { name: "Crear escritura", exact: true }).click({ noWaitAfter: true });
    await expect(page).toHaveURL(/\/dashboard\/documents\/[0-9a-f-]{36}/);
    const created = await restSelect<{
      option_selections: Record<string, string>;
      rendered_content: string;
    }>(
      "documents",
      `workspace_id=eq.${data.owner}&template_id=eq.${template.id}&select=option_selections,rendered_content`,
    );
    expect(created).toHaveLength(1);
    expect(created[0].option_selections).toEqual({});
    expect(created[0].rendered_content).toContain("Sin campo B");
  } finally {
    await data.cleanup();
  }
});
