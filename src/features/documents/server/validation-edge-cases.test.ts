import { describe, expect, it } from "vitest";
import type { FillableTemplateField } from "@/features/templates/domain";
import type {
  TemplateDocument,
  TemplateInlineNode,
  TemplateVariantContentNode,
} from "@/lib/editor/types";
import { validateDraftInput } from "./document-draft-validation";

const field = (key: string, label = key): FillableTemplateField => ({
  field_key: key,
  label,
  field_type: "text",
  required: true,
  derived: false,
  autofill_source: "none",
  output_transform: "none",
});

const variable = (key: string): TemplateVariantContentNode => ({
  type: "templateVariable",
  attrs: { key },
});

function optionBlock(
  blockId: string,
  first: TemplateVariantContentNode[],
  second: TemplateVariantContentNode[],
): TemplateInlineNode {
  return {
    type: "optionBlock",
    attrs: {
      blockId,
      name: blockId,
      defaultVariantId: "a",
      variants: [
        { id: "a", label: "Variante A", content: first },
        { id: "b", label: "Variante B", content: second },
      ],
    },
  };
}

function document(...content: TemplateInlineNode[]): TemplateDocument {
  return { type: "doc", content: [{ type: "paragraph", content }] };
}

function form(
  selections: Record<string, string>,
  values: Record<string, string> = {},
  title = "Escritura válida",
) {
  const data = new FormData();
  data.set("title", title);
  data.set("option_selections", JSON.stringify(selections));
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("document title server validation", () => {
  it.each([
    ["", "El título de la escritura es requerido"],
    ["   ", "El título de la escritura es requerido"],
    ["x".repeat(201), "El título es demasiado largo"],
  ])("returns titleError for %j", (title, message) => {
    const result = validateDraftInput(form({}, {}, title), [], document());
    expect("state" in result && result.state.titleError).toBe(message);
  });
});

describe("required fields in option blocks", () => {
  const conditional = document(optionBlock("choice", [], [variable("campo_b")]));

  it("keeps the global field catalog but allows required fields from an inactive variant", () => {
    const result = validateDraftInput(form({ choice: "a" }), [field("campo_b", "Campo B")], conditional);
    expect("state" in result).toBe(false);
    if (!("state" in result)) expect(result.values).toEqual({ campo_b: "" });
  });

  it("requires the field when its variant is active", () => {
    const result = validateDraftInput(form({ choice: "b" }), [field("campo_b", "Campo B")], conditional);
    expect("state" in result && result.state.errors).toEqual({ campo_b: "Campo B es requerido" });
  });

  it("accepts the active required field when completed", () => {
    const result = validateDraftInput(form({ choice: "b" }, { campo_b: "Valor" }), [field("campo_b")], conditional);
    expect("state" in result).toBe(false);
  });

  it("validates a required variable shared by active and inactive variants", () => {
    const shared = document(optionBlock("choice", [variable("comun")], [variable("comun"), variable("campo_b")]));
    const result = validateDraftInput(form({ choice: "a" }), [field("comun", "Campo común"), field("campo_b")], shared);
    expect("state" in result && result.state.errors).toEqual({ comun: "Campo común es requerido" });
  });

  it("recalculates required fields when the selection changes", () => {
    expect("state" in validateDraftInput(form({ choice: "a" }), [field("campo_b")], conditional)).toBe(false);
    const selectedB = validateDraftInput(form({ choice: "b" }), [field("campo_b")], conditional);
    expect("state" in selectedB && selectedB.state.errors).toHaveProperty("campo_b");
  });

  it("combines active variables from multiple option blocks", () => {
    const multiple = document(
      optionBlock("first", [], [variable("campo_b")]),
      optionBlock("second", [], [variable("campo_c")]),
    );
    const result = validateDraftInput(
      form({ first: "a", second: "b" }),
      [field("campo_b", "Campo B"), field("campo_c", "Campo C")],
      multiple,
    );
    expect("state" in result && result.state.errors).toEqual({ campo_c: "Campo C es requerido" });
  });
});
