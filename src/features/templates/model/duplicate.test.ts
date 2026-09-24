import { describe, expect, it } from "vitest";
import type { TemplateDocument } from "@/lib/editor/types";
import {
  buildDuplicateIndexMapping,
  buildDuplicateTemplateName,
  regenerateOptionBlockIds,
  type DuplicableIndexConfiguration,
} from "./duplicate";

describe("buildDuplicateTemplateName", () => {
  it("appends ' - Copia' when no copy exists yet", () => {
    expect(buildDuplicateTemplateName("Compraventa vehículo", [])).toBe(
      "Compraventa vehículo - Copia",
    );
  });

  it("uses ' - Copia 2', ' - Copia 3'… when the previous names are taken", () => {
    expect(
      buildDuplicateTemplateName("Compraventa vehículo", [
        "Compraventa vehículo",
        "Compraventa vehículo - Copia",
      ]),
    ).toBe("Compraventa vehículo - Copia 2");
    expect(
      buildDuplicateTemplateName("Compraventa vehículo", [
        "Compraventa vehículo - Copia",
        "Compraventa vehículo - Copia 2",
      ]),
    ).toBe("Compraventa vehículo - Copia 3");
  });

  it("fills the first free number deterministically", () => {
    expect(
      buildDuplicateTemplateName("Poder", ["Poder - Copia", "Poder - Copia 3"]),
    ).toBe("Poder - Copia 2");
  });

  it("never chains suffixes when duplicating a copy", () => {
    expect(
      buildDuplicateTemplateName("Poder - Copia", ["Poder", "Poder - Copia"]),
    ).toBe("Poder - Copia 2");
    expect(
      buildDuplicateTemplateName("Poder - Copia 2", [
        "Poder - Copia",
        "Poder - Copia 2",
      ]),
    ).toBe("Poder - Copia 3");
  });

  it("compares existing names ignoring case and surrounding spaces", () => {
    expect(buildDuplicateTemplateName("Poder", ["  poder - copia "])).toBe(
      "Poder - Copia 2",
    );
  });

  it("stays within the maximum name length", () => {
    const long = "A".repeat(200);
    const name = buildDuplicateTemplateName(long, []);
    expect(name.length).toBeLessThanOrEqual(200);
    expect(name.endsWith(" - Copia")).toBe(true);
  });
});

const documentWithBlocks: TemplateDocument = {
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
            blockId: "block-hora",
            name: "Hora",
            defaultVariantId: "v1",
            variants: [
              {
                id: "v1",
                label: "Con minutos",
                content: [{ type: "templateVariable", attrs: { key: "hora" } }],
              },
              { id: "v2", label: "En punto", content: [{ type: "text", text: "en punto" }] },
            ],
            structuredOutput: {
              type: "time",
              variants: [{ variantId: "v1", hourFieldKey: "hora", minuteFieldKey: null }],
            },
          },
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "optionBlock",
          attrs: {
            blockId: "block-vin",
            name: "Chasis, VIN y Serie",
            defaultVariantId: "a",
            variants: [{ id: "a", label: "Todos", content: [{ type: "text", text: "VIN" }] }],
          },
        },
      ],
    },
    { type: "paragraph" },
  ],
};

describe("regenerateOptionBlockIds", () => {
  let counter = 0;
  const newId = () => `new-${++counter}`;

  it("gives every Option Block a new id and returns the old → new map", () => {
    counter = 0;
    const { document, blockIdMap } = regenerateOptionBlockIds(documentWithBlocks, newId);
    expect(blockIdMap).toEqual(
      new Map([
        ["block-hora", "new-1"],
        ["block-vin", "new-2"],
      ]),
    );
    const blocks = document.content.flatMap((p) =>
      (p.content ?? []).filter((n) => n.type === "optionBlock"),
    );
    expect(blocks.map((b) => b.type === "optionBlock" && b.attrs.blockId)).toEqual([
      "new-1",
      "new-2",
    ]);
  });

  it("keeps everything else identical: text, variables, variants, default variant and structured output", () => {
    counter = 0;
    const { document } = regenerateOptionBlockIds(documentWithBlocks, newId);
    const strip = (doc: TemplateDocument) =>
      JSON.parse(JSON.stringify(doc).replace(/"blockId":"[^"]*"/g, '"blockId":"x"'));
    expect(strip(document)).toEqual(strip(documentWithBlocks));
  });

  it("never mutates the source document", () => {
    const before = JSON.stringify(documentWithBlocks);
    regenerateOptionBlockIds(documentWithBlocks, newId);
    expect(JSON.stringify(documentWithBlocks)).toBe(before);
  });
});

describe("buildDuplicateIndexMapping", () => {
  const sourceFieldKeyById = new Map([
    ["src-numero", "numero_escritura"],
    ["src-fecha", "fecha"],
    ["src-folio", "folio_inicial"],
    ["src-vendedor", "vendedor.nombre"],
    ["src-comprador", "comprador.nombre"],
  ]);
  const targetFieldIdByKey = new Map([
    ["numero_escritura", "dst-numero"],
    ["fecha", "dst-fecha"],
    ["folio_inicial", "dst-folio"],
    ["vendedor.nombre", "dst-vendedor"],
    ["comprador.nombre", "dst-comprador"],
  ]);
  const configuration: DuplicableIndexConfiguration = {
    partySeparator: " Y ",
    fixedSuffix: "Sociedad",
    allowEmpty: false,
    simpleFields: {
      instrument_number: "src-numero",
      authorized_date: "src-fecha",
      authorized_time: null,
      protocol_book: null,
      initial_folio: "src-folio",
      final_folio: null,
    },
    authorizedTimeOptionBlockId: "block-hora",
    fields: [
      { templateFieldId: "src-comprador", order: 1 },
      { templateFieldId: "src-vendedor", order: 0 },
    ],
  };

  it("maps every field to the copy's new field ids by field_key and remaps the time block", () => {
    const args = buildDuplicateIndexMapping({
      templateId: "copy",
      configuration,
      sourceFieldKeyById,
      targetFieldIdByKey,
      blockIdMap: new Map([["block-hora", "new-hora"]]),
    });
    expect(args).toEqual({
      p_template_id: "copy",
      p_simple_fields: {
        instrument_number: "dst-numero",
        authorized_date: "dst-fecha",
        authorized_time: null,
        protocol_book: null,
        initial_folio: "dst-folio",
        final_folio: null,
      },
      p_authorized_time_option_block_id: "new-hora",
      p_party_separator: " Y ",
      p_fixed_suffix: "Sociedad",
      p_allow_empty: false,
      p_party_fields: [
        { template_field_id: "dst-vendedor", sort_order: 0 },
        { template_field_id: "dst-comprador", sort_order: 1 },
      ],
    });
  });

  it("never references a source id: unknown mappings become null / are dropped", () => {
    const args = buildDuplicateIndexMapping({
      templateId: "copy",
      configuration: {
        ...configuration,
        simpleFields: { ...configuration.simpleFields, protocol_book: "src-borrado" },
        authorizedTimeOptionBlockId: "block-borrado",
        fields: [...configuration.fields, { templateFieldId: "src-borrado", order: 2 }],
      },
      sourceFieldKeyById,
      targetFieldIdByKey,
      blockIdMap: new Map(),
    });
    expect(args.p_simple_fields.protocol_book).toBeNull();
    expect(args.p_authorized_time_option_block_id).toBeNull();
    expect(JSON.stringify(args)).not.toMatch(/src-|block-/);
    expect(args.p_party_fields).toHaveLength(2);
  });
});
