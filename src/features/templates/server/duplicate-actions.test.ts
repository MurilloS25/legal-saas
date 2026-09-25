import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const db = vi.hoisted(() => ({
  role: "propietario" as string,
  workspaceId: "ws-a",
  templates: [] as Row[],
  fields: [] as Row[],
  indexConfiguration: null as unknown,
  touchedTables: new Set<string>(),
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  failMapping: false,
  deleted: [] as string[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));
vi.mock("@/features/notarial-index/server", () => ({
  queryTemplateIndexConfiguration: async () => db.indexConfiguration,
}));
vi.mock("@/lib/server/auth", () => ({
  requireWorkspace: async () => ({
    role: db.role,
    workspaceId: db.workspaceId,
    supabase: {
      from(table: string) {
        db.touchedTables.add(table);
        const filters: Array<(row: Row) => boolean> = [];
        let deleting = false;
        const rows = () =>
          (table === "templates" ? db.templates : table === "template_fields" ? db.fields : []).filter(
            (row) => filters.every((filter) => filter(row)),
          );
        const query = {
          select: () => query,
          order: () => query,
          eq: (key: string, value: unknown) => {
            filters.push((row) => row[key] === value);
            return query;
          },
          ilike: (key: string, pattern: string) => {
            const prefix = pattern.replace(/%$/, "").replace(/\\(.)/g, "$1").toLowerCase();
            filters.push((row) => String(row[key]).toLowerCase().startsWith(prefix));
            return query;
          },
          delete: () => {
            deleting = true;
            return query;
          },
          maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
          then: (resolve: (value: unknown) => void) => {
            if (deleting) {
              for (const row of rows()) db.deleted.push(String(row.id));
              return resolve({ data: null, error: null });
            }
            return resolve({ data: rows(), error: null });
          },
        };
        return query;
      },
      rpc(name: string, args: Record<string, unknown>) {
        db.rpcCalls.push({ name, args });
        let result: { data: unknown; error: unknown } = { data: null, error: null };
        if (name === "save_template_workspace") {
          const id = "copy-template";
          db.templates.push({
            id,
            workspace_id: db.workspaceId,
            name: args.p_name,
            status: args.p_status,
          });
          (args.p_fields as Row[]).forEach((field, index) =>
            db.fields.push({ ...field, id: `copy-field-${index}`, template_id: id, workspace_id: db.workspaceId }),
          );
          result = { data: { template_id: id }, error: null };
        }
        if (name === "save_template_index_mapping_with_block_source" && db.failMapping) {
          result = { data: null, error: { message: "boom" } };
        }
        return Object.assign(Promise.resolve(result), { single: async () => result });
      },
    },
  }),
}));

import { duplicateTemplateAction } from "./duplicate-actions";

const SOURCE_ID = "00000000-0000-4000-8000-000000000001";

const content = {
  doc: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Comparece " },
          { type: "templateVariable", attrs: { key: "comprador.nombre" } },
          {
            type: "optionBlock",
            attrs: {
              blockId: "src-block",
              name: "Hora",
              defaultVariantId: "v1",
              variants: [
                { id: "v1", label: "Con hora", content: [{ type: "templateVariable", attrs: { key: "hora" } }] },
              ],
            },
          },
        ],
      },
    ],
  },
  text: "",
};

async function duplicate(id = SOURCE_ID): Promise<{ url?: string; message?: string }> {
  try {
    const state = await duplicateTemplateAction(id, {}, new FormData());
    return { message: state.message };
  } catch (error) {
    return { url: (error as { url?: string }).url };
  }
}

function savedWorkspaceArgs() {
  return db.rpcCalls.find((call) => call.name === "save_template_workspace")?.args;
}

beforeEach(() => {
  db.role = "propietario";
  db.workspaceId = "ws-a";
  db.failMapping = false;
  db.deleted = [];
  db.rpcCalls = [];
  db.touchedTables = new Set();
  db.templates = [
    {
      id: SOURCE_ID,
      workspace_id: "ws-a",
      name: "Compraventa vehículo",
      description: "Descripción",
      status: "active",
      content_json: content,
      include_in_notarial_index_by_default: true,
    },
  ];
  db.fields = [
    { id: "src-f1", template_id: SOURCE_ID, workspace_id: "ws-a", field_key: "comprador.nombre", label: "Comprador", required: true, autofill_source: "client_full_name", output_transform: "none" },
    { id: "src-f2", template_id: SOURCE_ID, workspace_id: "ws-a", field_key: "hora", label: "Hora", required: false, autofill_source: "none", output_transform: "number_to_words" },
  ];
  db.indexConfiguration = {
    partySeparator: " Y ",
    fixedSuffix: null,
    allowEmpty: false,
    simpleFields: {
      instrument_number: null,
      authorized_date: null,
      authorized_time: null,
      protocol_book: null,
      initial_folio: null,
      final_folio: null,
    },
    authorizedTimeOptionBlockId: "src-block",
    fields: [{ templateFieldId: "src-f1", order: 0 }],
  };
});

describe("duplicateTemplateAction", () => {
  it("duplicates a published (active) template as a new draft and opens its editor", async () => {
    const result = await duplicate();
    expect(result.url).toBe("/templates/copy-template?duplicated=1");
    expect(savedWorkspaceArgs()).toMatchObject({
      p_template_id: null,
      p_status: "draft",
      p_name: "Compraventa vehículo - Copia",
      p_description: "Descripción",
    });
  });

  it("duplicates a draft template too, still as draft", async () => {
    db.templates[0].status = "draft";
    await duplicate();
    expect(savedWorkspaceArgs()?.p_status).toBe("draft");
  });

  it("copies variables with label, required, autofill source and transform", async () => {
    await duplicate();
    expect(savedWorkspaceArgs()?.p_fields).toEqual([
      { field_key: "comprador.nombre", label: "Comprador", required: true, autofill_source: "client_full_name", output_transform: "none" },
      { field_key: "hora", label: "Hora", required: false, autofill_source: "none", output_transform: "number_to_words" },
    ]);
  });

  it("copies the content with the same text/variables/variants but a new Option Block id", async () => {
    await duplicate();
    const saved = savedWorkspaceArgs()?.p_content_json as { doc: typeof content.doc };
    const block = saved.doc.content[0].content[2] as { attrs: { blockId: string } };
    expect(block.attrs.blockId).not.toBe("src-block");
    const strip = (value: unknown) =>
      JSON.parse(JSON.stringify(value).replace(/"blockId":"[^"]*"/g, '"blockId":"x"'));
    expect(strip(saved.doc)).toEqual(strip(content.doc));
  });

  it("copies the Índice configuration pointing to the copy's own field and block ids", async () => {
    await duplicate();
    const saved = savedWorkspaceArgs()?.p_content_json as { doc: typeof content.doc };
    const newBlockId = (saved.doc.content[0].content[2] as { attrs: { blockId: string } }).attrs.blockId;
    const mapping = db.rpcCalls.find(
      (call) => call.name === "save_template_index_mapping_with_block_source",
    )?.args;
    expect(mapping).toMatchObject({
      p_template_id: "copy-template",
      p_authorized_time_option_block_id: newBlockId,
      p_party_separator: " Y ",
      p_party_fields: [{ template_field_id: "copy-field-0", sort_order: 0 }],
    });
    expect(JSON.stringify(mapping)).not.toMatch(/src-/);
  });

  it("copies an Índice default of 'not included'", async () => {
    db.templates[0].include_in_notarial_index_by_default = false;
    await duplicate();
    expect(
      db.rpcCalls.find((call) => call.name === "set_template_notarial_index_default")?.args,
    ).toEqual({ p_template_id: "copy-template", p_include_by_default: false });
  });

  it("never touches AI generation metadata, activity or documents of the original", async () => {
    await duplicate();
    expect([...db.touchedTables].sort()).toEqual(["template_fields", "templates"]);
    expect(db.rpcCalls.map((call) => call.name)).not.toContain("finish_ai_template_generation");
  });

  it("names successive copies ' - Copia 2' when ' - Copia' already exists", async () => {
    db.templates.push({ id: "other", workspace_id: "ws-a", name: "Compraventa vehículo - Copia" });
    await duplicate();
    expect(savedWorkspaceArgs()?.p_name).toBe("Compraventa vehículo - Copia 2");
  });

  it("does not see a template from another Workspace", async () => {
    db.workspaceId = "ws-b";
    const result = await duplicate();
    expect(result.message).toBe("No se encontró el machote.");
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("rejects roles without templates.write before reading anything", async () => {
    db.role = "solo_lectura";
    const result = await duplicate();
    expect(result.message).toMatch(/no permite/);
    expect(db.touchedTables.size).toBe(0);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("rejects an invalid id", async () => {
    expect((await duplicate("not-a-uuid")).message).toBe("No se encontró el machote.");
  });

  it("removes the partial copy if copying the Índice configuration fails", async () => {
    db.failMapping = true;
    const result = await duplicate();
    expect(result.message).toMatch(/No fue posible duplicar/);
    expect(db.deleted).toEqual(["copy-template"]);
  });
});
