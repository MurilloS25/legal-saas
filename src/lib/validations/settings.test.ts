import { describe, it, expect } from "vitest";
import { ProfileSchema, DocumentSettingsSchema } from "./settings";

// ------------------------------------------------------------------ ProfileSchema

describe("ProfileSchema", () => {
  it("accepts a complete valid profile", () => {
    const result = ProfileSchema.safeParse({
      full_name: "Ana García López",
      professional_code: "NP-1234",
      email: "ana@despacho.com",
      phone: "8888-8888",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a profile with only full_name (other fields empty)", () => {
    const result = ProfileSchema.safeParse({
      full_name: "Ana García",
      professional_code: "",
      email: "",
      phone: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a full_name made of only whitespace", () => {
    const result = ProfileSchema.safeParse({
      full_name: "   ",
      professional_code: "",
      email: "",
      phone: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.full_name).toBeDefined();
    }
  });

  it("rejects when full_name is missing", () => {
    const result = ProfileSchema.safeParse({
      full_name: "",
      professional_code: "",
      email: "",
      phone: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.full_name).toBeDefined();
    }
  });

  it("rejects an invalid email", () => {
    const result = ProfileSchema.safeParse({
      full_name: "Ana García",
      professional_code: "",
      email: "no-es-email",
      phone: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toBeDefined();
    }
  });

  it("accepts empty string as email (field not filled)", () => {
    const result = ProfileSchema.safeParse({
      full_name: "Ana García",
      professional_code: "",
      email: "",
      phone: "",
    });
    expect(result.success).toBe(true);
  });
});

// ------------------------------------------------------------------ DocumentSettingsSchema

const VALID_SETTINGS = {
  font_family: "Times New Roman" as const,
  font_size: 12,
  margin_top_cm: 3.66,
  margin_bottom_cm: 5.64,
  margin_left_cm: 2.49,
  margin_right_cm: 2.49,
  back_margin_top_cm: 3.66,
  back_margin_bottom_cm: 5.64,
  back_margin_left_cm: 2.49,
  back_margin_right_cm: 2.49,
};

describe("DocumentSettingsSchema", () => {
  it("accepts valid default document settings", () => {
    const result = DocumentSettingsSchema.safeParse(VALID_SETTINGS);
    expect(result.success).toBe(true);
  });

  it("rejects a font family that is not in the allowed list", () => {
    const result = DocumentSettingsSchema.safeParse({
      ...VALID_SETTINGS,
      font_family: "Comic Sans",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.font_family).toBeDefined();
    }
  });

  it("rejects font_size of 0", () => {
    const result = DocumentSettingsSchema.safeParse({
      ...VALID_SETTINGS,
      font_size: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.font_size).toBeDefined();
    }
  });

  it("rejects a negative font_size", () => {
    const result = DocumentSettingsSchema.safeParse({
      ...VALID_SETTINGS,
      font_size: -1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.font_size).toBeDefined();
    }
  });

  it("rejects a negative margin", () => {
    const result = DocumentSettingsSchema.safeParse({
      ...VALID_SETTINGS,
      margin_top_cm: -0.1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.margin_top_cm).toBeDefined();
    }
  });

  it("accepts a margin of 0 (borderless)", () => {
    const result = DocumentSettingsSchema.safeParse({
      ...VALID_SETTINGS,
      margin_top_cm: 0,
      margin_bottom_cm: 0,
      margin_left_cm: 0,
      margin_right_cm: 0,
      back_margin_top_cm: 0,
      back_margin_bottom_cm: 0,
      back_margin_left_cm: 0,
      back_margin_right_cm: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative Vuelto margin", () => {
    const result = DocumentSettingsSchema.safeParse({
      ...VALID_SETTINGS,
      back_margin_left_cm: -1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.back_margin_left_cm).toBeDefined();
    }
  });

  it("requires all four Vuelto margins", () => {
    const { back_margin_top_cm: _omitted, ...withoutBackTop } = VALID_SETTINGS;
    void _omitted;
    expect(DocumentSettingsSchema.safeParse(withoutBackTop).success).toBe(false);
  });

  it("does not accept or require line_spacing anymore", () => {
    const parsed = DocumentSettingsSchema.safeParse({ ...VALID_SETTINGS, line_spacing: 1.5 });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).not.toHaveProperty("line_spacing");
  });
});
