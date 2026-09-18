import { describe, expect, it } from "vitest";
import {
  centimetersToTwip,
  DOCX_DEFAULT_FORMATTING,
  FIXED_BODY_ALIGNMENT,
  FIXED_BODY_LINE_SPACING,
  LEGAL_PAGE_SIZE_TWIPS,
  FIXED_BODY_PARAGRAPH,
  pointsToHalfPoints,
  resolveDocumentFormatting,
} from "./formatting";
import { DEFAULT_MARGINS_CM, parseMarginProfile } from "./margin-profile";

describe("centimetersToTwip", () => {
  it("converts centimeters to twips (1 cm = 566.929... twips)", () => {
    expect(centimetersToTwip(1)).toBe(566);
    expect(centimetersToTwip(2.54)).toBe(1440); // 1 inch
  });

  it("handles 0", () => {
    expect(centimetersToTwip(0)).toBe(0);
  });

  it("reproduces the Word reference margins exactly (1.44\", 2.22\", 0.98\")", () => {
    const twipsOf = (inches: number) => Math.round(inches * 1440);
    expect(centimetersToTwip(DEFAULT_MARGINS_CM.front.top)).toBe(twipsOf(1.44));
    expect(centimetersToTwip(DEFAULT_MARGINS_CM.front.bottom)).toBe(twipsOf(2.22));
    expect(centimetersToTwip(DEFAULT_MARGINS_CM.front.left)).toBe(twipsOf(0.98));
    expect(centimetersToTwip(DEFAULT_MARGINS_CM.front.right)).toBe(twipsOf(0.98));
    expect(twipsOf(1.44)).toBe(2074);
    expect(twipsOf(2.22)).toBe(3197);
    expect(twipsOf(0.98)).toBe(1411);
  });

  it("rejects negative values", () => {
    expect(() => centimetersToTwip(-1)).toThrow(RangeError);
  });

  it("rejects NaN", () => {
    expect(() => centimetersToTwip(NaN)).toThrow(RangeError);
  });
});

describe("pointsToHalfPoints", () => {
  it("converts points to half-points", () => {
    expect(pointsToHalfPoints(12)).toBe(24);
    expect(pointsToHalfPoints(11)).toBe(22);
  });

  it("rounds fractional points", () => {
    expect(pointsToHalfPoints(11.3)).toBe(23);
  });

  it("rejects 0 and negative values", () => {
    expect(() => pointsToHalfPoints(0)).toThrow(RangeError);
    expect(() => pointsToHalfPoints(-12)).toThrow(RangeError);
  });

  it("rejects NaN", () => {
    expect(() => pointsToHalfPoints(NaN)).toThrow(RangeError);
  });
});

describe("LEGAL_PAGE_SIZE_TWIPS", () => {
  it("is 8.5 x 14 inches in twips", () => {
    expect(LEGAL_PAGE_SIZE_TWIPS.width).toBe(12240);
    expect(LEGAL_PAGE_SIZE_TWIPS.height).toBe(20160);
  });
});

describe("FIXED_BODY_LINE_SPACING", () => {
  it("is exactly 24pt (480 twentieths of a point)", () => {
    expect(FIXED_BODY_LINE_SPACING.line).toBe(480);
  });

  it("uses the exactly rule, not auto or atLeast", () => {
    expect(FIXED_BODY_LINE_SPACING.lineRule).toBe("exactly");
  });
});

describe("FIXED_BODY_ALIGNMENT", () => {
  it("is justified", () => {
    expect(FIXED_BODY_ALIGNMENT).toBe("both");
  });
});

describe("FIXED_BODY_PARAGRAPH", () => {
  it("is justified, no indents, 0pt before/after, exactly 24pt", () => {
    expect(FIXED_BODY_PARAGRAPH).toEqual({
      alignment: "both",
      indent: { left: 0, right: 0 },
      spacing: { before: 0, after: 0, line: 480, lineRule: "exactly" },
    });
  });
});

describe("parseMarginProfile", () => {
  it("accepts only front and back", () => {
    expect(parseMarginProfile("front")).toBe("front");
    expect(parseMarginProfile("back")).toBe("back");
    expect(parseMarginProfile("Frente")).toBeNull();
    expect(parseMarginProfile("")).toBeNull();
    expect(parseMarginProfile(undefined)).toBeNull();
  });
});

describe("resolveDocumentFormatting", () => {
  it("returns the product defaults when there is no saved row", () => {
    expect(resolveDocumentFormatting(null)).toEqual(DOCX_DEFAULT_FORMATTING);
    expect(resolveDocumentFormatting(undefined)).toEqual(
      DOCX_DEFAULT_FORMATTING,
    );
  });

  it("uses every saved preference when all are valid, keeping Frente and Vuelto independent", () => {
    const resolved = resolveDocumentFormatting({
      font_family: "Arial",
      font_size: 11,
      margin_top_cm: 2,
      margin_bottom_cm: 2.5,
      margin_left_cm: 3,
      margin_right_cm: 3.5,
      back_margin_top_cm: 4,
      back_margin_bottom_cm: 4.5,
      back_margin_left_cm: 5,
      back_margin_right_cm: 5.5,
    });
    expect(resolved).toEqual({
      fontFamily: "Arial",
      fontSizePt: 11,
      marginsCm: {
        front: { top: 2, bottom: 2.5, left: 3, right: 3.5 },
        back: { top: 4, bottom: 4.5, left: 5, right: 5.5 },
      },
    });
  });

  it("legacy row (no back margins) uses its saved margins for Vuelto too", () => {
    const resolved = resolveDocumentFormatting({
      font_family: "Times New Roman",
      font_size: 12,
      margin_top_cm: 4.7,
      margin_bottom_cm: 4.7,
      margin_left_cm: 3.2,
      margin_right_cm: 3.2,
      back_margin_top_cm: null,
      back_margin_bottom_cm: null,
      back_margin_left_cm: null,
      back_margin_right_cm: null,
    });
    const legacy = { top: 4.7, bottom: 4.7, left: 3.2, right: 3.2 };
    expect(resolved.marginsCm.front).toEqual(legacy);
    expect(resolved.marginsCm.back).toEqual(legacy);
  });

  it("defaults are the Word reference margins for both Frente and Vuelto", () => {
    expect(DOCX_DEFAULT_FORMATTING.marginsCm.front).toEqual({
      top: 3.66,
      bottom: 5.64,
      left: 2.49,
      right: 2.49,
    });
    expect(DOCX_DEFAULT_FORMATTING.marginsCm.back).toEqual(
      DOCX_DEFAULT_FORMATTING.marginsCm.front,
    );
  });

  it("never swaps top/bottom or left/right", () => {
    const resolved = resolveDocumentFormatting({
      margin_top_cm: 1,
      margin_bottom_cm: 2,
      margin_left_cm: 3,
      margin_right_cm: 4,
    });
    expect(resolved.marginsCm.front).toEqual({ top: 1, bottom: 2, left: 3, right: 4 });
  });

  it("falls back to defaults for a font family not in the allowed list", () => {
    const resolved = resolveDocumentFormatting({ font_family: "Comic Sans" });
    expect(resolved.fontFamily).toBe(DOCX_DEFAULT_FORMATTING.fontFamily);
  });

  it("falls back to defaults for invalid numeric fields independently", () => {
    const resolved = resolveDocumentFormatting({
      font_size: NaN,
      margin_top_cm: -0.1,
      // margin_bottom_cm/left/right valid — must be preserved.
      margin_bottom_cm: 1,
      margin_left_cm: 1,
      margin_right_cm: 1,
    });
    expect(resolved.fontSizePt).toBe(DOCX_DEFAULT_FORMATTING.fontSizePt);
    expect(resolved.marginsCm.front.top).toBe(
      DOCX_DEFAULT_FORMATTING.marginsCm.front.top,
    );
    expect(resolved.marginsCm.front.bottom).toBe(1);
    expect(resolved.marginsCm.front.left).toBe(1);
    expect(resolved.marginsCm.front.right).toBe(1);
  });

  it("accepts a margin of exactly 0", () => {
    const resolved = resolveDocumentFormatting({
      margin_top_cm: 0,
      margin_bottom_cm: 0,
      margin_left_cm: 0,
      margin_right_cm: 0,
    });
    expect(resolved.marginsCm.front).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it("treats missing fields as absent, not invalid, and still falls back to defaults", () => {
    const resolved = resolveDocumentFormatting({});
    expect(resolved).toEqual(DOCX_DEFAULT_FORMATTING);
  });
});
