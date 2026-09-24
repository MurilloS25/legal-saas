import { test, expect, type Page } from "@playwright/test";
import {
  CleanupRegistry,
  createTestTemplate,
  createTestTemplateField,
  registerCreatedViaUi,
  runCleanup,
  uniqueName,
} from "./support/factories";
import { restRpc, restSelect } from "./support/supabase-api";

/**
 * "Duplicar machote": crea un Machote nuevo en borrador con el mismo
 * documento, variables (incl. autollenado/transformación), Bloques de
 * opciones (con IDs nuevos) y configuración del Índice, sin tocar el
 * original.
 */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const registry = new CleanupRegistry();
const sourceName = uniqueName("template-duplication", "Compraventa");
let sourceId = "";

const doc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Comparece " },
        { type: "templateVariable", attrs: { key: "vendedor.nombre" } },
        { type: "text", text: " a las " },
        {
          type: "optionBlock",
          attrs: {
            blockId: "e2e-hora",
            name: "Hora",
            defaultVariantId: "horas",
            variants: [
              {
                id: "horas",
                label: "Horas",
                content: [
                  { type: "templateVariable", attrs: { key: "hora" } },
                  { type: "text", text: " horas" },
                ],
              },
            ],
            structuredOutput: {
              type: "time",
              variants: [{ variantId: "horas", hourFieldKey: "hora", minuteFieldKey: null }],
            },
          },
        },
      ],
    },
  ],
};

type FieldRow = {
  id: string;
  field_key: string;
  label: string;
  required: boolean;
  autofill_source: string;
  output_transform: string;
};

async function fieldsOf(templateId: string): Promise<FieldRow[]> {
  return restSelect<FieldRow>(
    `template_fields?select=id,field_key,label,required,autofill_source,output_transform&template_id=eq.${templateId}&order=sort_order.asc`,
  );
}

async function duplicateFromList(page: Page, name: string) {
  await page.goto("/templates");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: `Duplicar machote ${name}`, exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: `¿Duplicar ${name}?` });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Duplicar", exact: true }).click();
  await expect(page).toHaveURL(/\/templates\/[0-9a-f-]{36}/, { timeout: 20_000 });
  return page.url().match(/\/templates\/([0-9a-f-]{36})/)![1];
}

test.describe("duplicar machote", () => {
  test.afterAll(async () => {
    await runCleanup(registry, "template-duplication");
  });

  test("A: an active template is duplicated as an independent draft copy with the same content, variables, blocks and Índice", async ({
    page,
  }) => {
    const source = await createTestTemplate(registry, {
      name: sourceName,
      content: "Comparece {{vendedor.nombre}} a las {{hora}} horas",
      doc,
      status: "active",
      includeInNotarialIndexByDefault: false,
    });
    sourceId = source.id;
    await createTestTemplateField(registry, sourceId, {
      field_key: "vendedor.nombre",
      label: "Vendedor",
      required: true,
      autofill_source: "client_full_name",
    });
    await createTestTemplateField(registry, sourceId, {
      field_key: "hora",
      label: "Hora",
      sort_order: 1,
      output_transform: "number_to_words",
    });
    const [vendedor] = await fieldsOf(sourceId);
    await restRpc("save_template_index_mapping_with_block_source", {
      p_template_id: sourceId,
      p_simple_fields: {
        instrument_number: null,
        authorized_date: null,
        authorized_time: null,
        protocol_book: null,
        initial_folio: null,
        final_folio: null,
      },
      p_authorized_time_option_block_id: "e2e-hora",
      p_party_separator: " Y ",
      p_fixed_suffix: null,
      p_allow_empty: false,
      p_party_fields: [{ template_field_id: vendedor.id, sort_order: 0 }],
    });

    const copyId = await duplicateFromList(page, sourceName);
    await registerCreatedViaUi(registry, "templates", "name", `${sourceName} - Copia`);
    expect(copyId).not.toBe(sourceId);
    await expect(page.getByText("Machote duplicado. La copia está en borrador.")).toBeVisible();

    const [copy] = await restSelect<{
      name: string;
      status: string;
      content_json: { doc: typeof doc };
      include_in_notarial_index_by_default: boolean;
    }>(`templates?select=name,status,content_json,include_in_notarial_index_by_default&id=eq.${copyId}`);
    expect(copy.name).toBe(`${sourceName} - Copia`);
    expect(copy.status).toBe("draft");
    expect(copy.include_in_notarial_index_by_default).toBe(false);

    const copyBlock = copy.content_json.doc.content[0].content[3] as {
      attrs: { blockId: string; name: string; variants: unknown };
    };
    expect(copyBlock.attrs.blockId).not.toBe("e2e-hora");
    expect(copyBlock.attrs.name).toBe("Hora");
    expect(copyBlock.attrs.variants).toEqual(doc.content[0].content[3].attrs!.variants);

    const [sourceFields, copyFields] = [await fieldsOf(sourceId), await fieldsOf(copyId)];
    const strip = (rows: FieldRow[]) => rows.map(({ id: _id, ...rest }) => rest);
    expect(strip(copyFields)).toEqual(strip(sourceFields));
    expect(copyFields.map((f) => f.id)).not.toEqual(
      expect.arrayContaining(sourceFields.map((f) => f.id)),
    );

    const [configuration] = await restSelect<{
      id: string;
      authorized_time_option_block_id: string | null;
      party_separator: string;
    }>(
      `template_index_configurations?select=id,authorized_time_option_block_id,party_separator&template_id=eq.${copyId}`,
    );
    expect(configuration.authorized_time_option_block_id).toBe(copyBlock.attrs.blockId);
    expect(configuration.party_separator).toBe(" Y ");
    const parties = await restSelect<{ template_field_id: string }>(
      `template_index_configuration_fields?select=template_field_id&configuration_id=eq.${configuration.id}`,
    );
    expect(parties).toEqual([
      { template_field_id: copyFields.find((f) => f.field_key === "vendedor.nombre")!.id },
    ]);

    // El original no cambió.
    const [original] = await restSelect<{ status: string; name: string }>(
      `templates?select=status,name&id=eq.${sourceId}`,
    );
    expect(original).toEqual({ status: "active", name: sourceName });
  });

  test("B: duplicating again yields ' - Copia 2'", async ({ page }) => {
    const copyId = await duplicateFromList(page, sourceName);
    await registerCreatedViaUi(registry, "templates", "name", `${sourceName} - Copia 2`);
    const [copy] = await restSelect<{ name: string; status: string }>(
      `templates?select=name,status&id=eq.${copyId}`,
    );
    expect(copy).toEqual({ name: `${sourceName} - Copia 2`, status: "draft" });
  });
});
