import { describe, expect, it } from "vitest";
import { TemplateIndexConfigurationSchema } from "./template-index-configuration";

const fieldA = "11111111-1111-1111-1111-111111111111";
const fieldB = "22222222-2222-2222-2222-222222222222";

describe("TemplateIndexConfigurationSchema", () => {
  it("accepts an ordered field selection", () => {
    expect(
      TemplateIndexConfigurationSchema.parse({
        party_separator: " Y ",
        fixed_suffix: "  en calidad personal ",
        allow_empty: false,
        template_field_ids: [fieldA, fieldB],
      }),
    ).toEqual({
      party_separator: " Y ",
      fixed_suffix: "en calidad personal",
      allow_empty: false,
      template_field_ids: [fieldA, fieldB],
    });
  });

  it("requires explicit acceptance for an empty selection", () => {
    expect(
      TemplateIndexConfigurationSchema.safeParse({
        party_separator: " Y ",
        fixed_suffix: "",
        allow_empty: false,
        template_field_ids: [],
      }).success,
    ).toBe(false);
    expect(
      TemplateIndexConfigurationSchema.safeParse({
        party_separator: " Y ",
        fixed_suffix: "",
        allow_empty: true,
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
        template_field_ids: [fieldA, fieldA],
      }).success,
    ).toBe(false);
    expect(
      TemplateIndexConfigurationSchema.safeParse({
        party_separator: " Y ",
        fixed_suffix: null,
        allow_empty: false,
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
        template_field_ids: [],
      }).success,
    ).toBe(false);
    expect(
      TemplateIndexConfigurationSchema.safeParse({
        party_separator: " Y ",
        fixed_suffix: "x".repeat(201),
        allow_empty: true,
        template_field_ids: [],
      }).success,
    ).toBe(false);
  });
});
