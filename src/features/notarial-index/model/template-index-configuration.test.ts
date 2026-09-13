import { describe, expect, it } from "vitest";
import {
  getTemplateIndexPartiesState,
  isTemplateIndexConfigurationResolved,
  TemplateIndexConfigurationSchema,
  type TemplateIndexConfiguration,
} from "./template-index-configuration";

const fieldA = "11111111-1111-1111-1111-111111111111";
const fieldB = "22222222-2222-2222-2222-222222222222";
const emptySimpleFields = {
  instrument_number: null,
  authorized_date: null,
  authorized_time: null,
  protocol_book: null,
  initial_folio: null,
  final_folio: null,
};

describe("TemplateIndexConfigurationSchema", () => {
  it("accepts an ordered field selection", () => {
    expect(
      TemplateIndexConfigurationSchema.parse({
        party_separator: " Y ",
        fixed_suffix: "  en calidad personal ",
        allow_empty: false,
        simple_fields: emptySimpleFields,
        template_field_ids: [fieldA, fieldB],
      }),
    ).toEqual({
      party_separator: " Y ",
      fixed_suffix: "en calidad personal",
      allow_empty: false,
      simple_fields: emptySimpleFields,
      authorized_time_option_block_id: null,
      template_field_ids: [fieldA, fieldB],
    });
  });

  it("accepts an empty selection both pending (not confirmed) and explicitly confirmed", () => {
    // "Pendiente de definir": ni seleccionó variables ni confirmó que no
    // hacen falta — ya no es un error, es un estado válido y guardable.
    expect(
      TemplateIndexConfigurationSchema.safeParse({
        party_separator: " Y ",
        fixed_suffix: "",
        allow_empty: false,
        simple_fields: emptySimpleFields,
        template_field_ids: [],
      }).success,
    ).toBe(true);
    // "No requiere partes": confirmación explícita de que el machote no
    // necesita Partes.
    expect(
      TemplateIndexConfigurationSchema.safeParse({
        party_separator: " Y ",
        fixed_suffix: "",
        allow_empty: true,
        simple_fields: emptySimpleFields,
        template_field_ids: [],
      }).success,
    ).toBe(true);
  });

  it("rejects duplicate or malformed field ids", () => {
    expect(
      TemplateIndexConfigurationSchema.safeParse({
        party_separator: " Y ",
        fixed_suffix: null,
        allow_empty: false,
        simple_fields: emptySimpleFields,
        template_field_ids: [fieldA, fieldA],
      }).success,
    ).toBe(false);
    expect(
      TemplateIndexConfigurationSchema.safeParse({
        party_separator: " Y ",
        fixed_suffix: null,
        allow_empty: false,
        simple_fields: emptySimpleFields,
        template_field_ids: ["not-a-uuid"],
      }).success,
    ).toBe(false);
  });

  it("rejects blank or oversized separators and suffixes", () => {
    expect(
      TemplateIndexConfigurationSchema.safeParse({
        party_separator: "   ",
        fixed_suffix: null,
        allow_empty: true,
        simple_fields: emptySimpleFields,
        template_field_ids: [],
      }).success,
    ).toBe(false);
    expect(
      TemplateIndexConfigurationSchema.safeParse({
        party_separator: " Y ",
        fixed_suffix: "x".repeat(201),
        allow_empty: true,
        simple_fields: emptySimpleFields,
        template_field_ids: [],
      }).success,
    ).toBe(false);
  });

  it("allows partial simple mappings and rejects duplicate destinations", () => {
    expect(
      TemplateIndexConfigurationSchema.safeParse({
        party_separator: " Y ",
        fixed_suffix: "",
        allow_empty: true,
        simple_fields: { ...emptySimpleFields, instrument_number: fieldA },
        template_field_ids: [],
      }).success,
    ).toBe(true);
    expect(
      TemplateIndexConfigurationSchema.safeParse({
        party_separator: " Y ",
        fixed_suffix: "",
        allow_empty: true,
        simple_fields: {
          ...emptySimpleFields,
          instrument_number: fieldA,
          protocol_book: fieldA,
        },
        template_field_ids: [],
      }).success,
    ).toBe(false);
  });

  it("accepts a block time source and rejects two time sources", () => {
    expect(
      TemplateIndexConfigurationSchema.safeParse({
        party_separator: " Y ",
        fixed_suffix: "",
        allow_empty: true,
        simple_fields: emptySimpleFields,
        authorized_time_option_block_id: "hora-block",
        template_field_ids: [],
      }).success,
    ).toBe(true);
    expect(
      TemplateIndexConfigurationSchema.safeParse({
        party_separator: " Y ",
        fixed_suffix: "",
        allow_empty: true,
        simple_fields: { ...emptySimpleFields, authorized_time: fieldA },
        authorized_time_option_block_id: "hora-block",
        template_field_ids: [],
      }).success,
    ).toBe(false);
  });
});

describe("template index configuration semantics", () => {
  const configuration: TemplateIndexConfiguration = {
    id: "33333333-3333-3333-3333-333333333333",
    templateId: "44444444-4444-4444-4444-444444444444",
    partySeparator: " Y ",
    fixedSuffix: null,
    allowEmpty: false,
    mappingsValid: true,
    simpleFields: emptySimpleFields,
    authorizedTimeOptionBlockId: null,
    invalidMappings: [],
    fields: [],
  };

  it("keeps pending, required, and not-required Parties states distinct", () => {
    expect(getTemplateIndexPartiesState(configuration)).toBe("pending");
    expect(
      getTemplateIndexPartiesState({
        ...configuration,
        fields: [{ templateFieldId: fieldA, order: 0 }],
      }),
    ).toBe("required");
    expect(
      getTemplateIndexPartiesState({ ...configuration, allowEmpty: true }),
    ).toBe("not_required");
  });

  it("does not confuse mapping validity with a resolved Parties decision", () => {
    expect(isTemplateIndexConfigurationResolved(configuration)).toBe(false);
    expect(
      isTemplateIndexConfigurationResolved({
        ...configuration,
        fields: [{ templateFieldId: fieldA, order: 0 }],
      }),
    ).toBe(true);
    expect(
      isTemplateIndexConfigurationResolved({
        ...configuration,
        allowEmpty: true,
      }),
    ).toBe(true);
    expect(
      isTemplateIndexConfigurationResolved({
        ...configuration,
        allowEmpty: true,
        mappingsValid: false,
      }),
    ).toBe(false);
    expect(isTemplateIndexConfigurationResolved(null)).toBe(false);
  });
});
