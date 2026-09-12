import { describe, expect, it } from "vitest";
import type { SimpleIndexMappingKey } from "../../model/template-index-configuration";
import { serializeTemplateIndexConfiguration } from "./serializeTemplateIndexConfiguration";

const emptyMappings: Record<SimpleIndexMappingKey, string> = {
  instrument_number: "",
  authorized_date: "",
  authorized_time: "",
  protocol_book: "",
  initial_folio: "",
  final_folio: "",
};

describe("serializeTemplateIndexConfiguration", () => {
  it("resolves local party and simple-field ids and preserves their order", () => {
    const result = serializeTemplateIndexConfiguration({
      freshFields: [
        { id: "real-party", fieldKey: "party", label: "Parte" },
        { id: "real-book", fieldKey: "book", label: "Tomo" },
      ],
      selectedIds: ["persisted-party", "local:party"],
      simpleFieldValues: {
        ...emptyMappings,
        protocol_book: "local:book",
      },
      separator: " Y ",
      fixedSuffix: " comparecientes",
      allowEmpty: false,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.resolvedSelectedIds).toEqual([
      "persisted-party",
      "real-party",
    ]);
    expect(result.resolvedSimpleFieldValues.protocol_book).toBe("real-book");
    expect(result.formData.getAll("selected_field")).toEqual([
      "persisted-party",
      "real-party",
    ]);
    expect(result.formData.get("party_separator")).toBe(" Y ");
    expect(result.formData.get("fixed_suffix")).toBe(" comparecientes");
    expect(result.formData.has("allow_empty")).toBe(false);
  });

  it("resolves an authorized-time field and preserves an option block source", () => {
    const fieldResult = serializeTemplateIndexConfiguration({
      freshFields: [{ id: "real-time", fieldKey: "time", label: "Hora" }],
      selectedIds: [],
      simpleFieldValues: {
        ...emptyMappings,
        authorized_time: "field:local:time",
      },
      separator: " Y ",
      fixedSuffix: "",
      allowEmpty: true,
    });
    expect(fieldResult.success).toBe(true);
    if (!fieldResult.success) return;
    expect(fieldResult.formData.get("authorized_time_source")).toBe(
      "field:real-time",
    );
    expect(fieldResult.formData.get("allow_empty")).toBe("on");

    const blockResult = serializeTemplateIndexConfiguration({
      freshFields: [],
      selectedIds: [],
      simpleFieldValues: {
        ...emptyMappings,
        authorized_time: "block:appointment-time",
      },
      separator: " Y ",
      fixedSuffix: "",
      allowEmpty: false,
    });
    expect(blockResult.success).toBe(true);
    if (!blockResult.success) return;
    expect(blockResult.formData.get("authorized_time_source")).toBe(
      "block:appointment-time",
    );
  });

  it.each([
    {
      selectedIds: ["local:missing"],
      mappings: emptyMappings,
      error: "parties_field_not_saved",
    },
    {
      selectedIds: [],
      mappings: {
        ...emptyMappings,
        authorized_time: "field:local:missing",
      },
      error: "authorized_time_field_not_saved",
    },
    {
      selectedIds: [],
      mappings: { ...emptyMappings, protocol_book: "local:missing" },
      error: "simple_field_not_saved",
    },
  ])("returns $error for an unresolved reference", ({ selectedIds, mappings, error }) => {
    const result = serializeTemplateIndexConfiguration({
      freshFields: [],
      selectedIds,
      simpleFieldValues: mappings,
      separator: " Y ",
      fixedSuffix: "",
      allowEmpty: false,
    });

    expect(result).toMatchObject({ success: false, error });
  });
});
