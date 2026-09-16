import { describe, expect, it } from "vitest";
import type { FillableTemplateField } from "@/features/templates/domain";
import type { TemplateDocument } from "@/lib/editor/types";
import {
  createDocumentTemplateSnapshot,
  resolveDocumentTemplateSnapshot,
} from "./document-template-snapshot";

const document: TemplateDocument = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Comparece " },
        { type: "templateVariable", attrs: { key: "persona.nombre" } },
        {
          type: "optionBlock",
          attrs: {
            blockId: "comparecencia",
            name: "Comparecencia",
            defaultVariantId: "personal",
            variants: [
              { id: "personal", label: "Personal", content: [{ type: "text", text: " personalmente" }] },
              { id: "apoderado", label: "Por poder", content: [{ type: "text", text: " por poder" }] },
            ],
          },
        },
      ],
    },
  ],
};

const fields: FillableTemplateField[] = [
  {
    field_key: "persona.nombre",
    label: "Nombre de la persona",
    required: true,
    field_type: "text",
    derived: false,
    autofill_source: "client_full_name",
    output_transform: "none",
  },
];

describe("document template snapshots", () => {
  it("captures the structured document and effective field catalog", () => {
    const snapshot = createDocumentTemplateSnapshot(document, fields);

    expect(snapshot).toEqual({
      version: 1,
      document,
      fields: [{
        field_key: "persona.nombre",
        label: "Nombre de la persona",
        required: true,
        field_type: "text",
        autofill_source: "client_full_name",
        output_transform: "none",
      }],
    });
    expect(resolveDocumentTemplateSnapshot(snapshot, "ignored")).toEqual({
      document,
      fields,
      legacy: false,
    });
  });

  it("resolves pre-migration documents from their saved rendered text only", () => {
    const resolved = resolveDocumentTemplateSnapshot(
      null,
      "Versión histórica v1 con {{campo_irrecuperable}}",
    );

    expect(resolved.legacy).toBe(true);
    expect(resolved.fields).toEqual([]);
    expect(resolved.document).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{
            type: "text",
            text: "Versión histórica v1 con {{campo_irrecuperable}}",
          }],
        },
      ],
    });
  });

  it("does not fall back to the current template when a stored snapshot is invalid", () => {
    expect(() =>
      resolveDocumentTemplateSnapshot({ version: 1, document: {}, fields: [] }, "Guardado"),
    ).toThrow(/snapshot/i);
  });
});
