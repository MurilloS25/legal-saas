import { describe, expect, it } from "vitest";
import {
  centimetersToTwip,
  DOCX_DEFAULT_FORMATTING,
  LEGAL_PAGE_SIZE_TWIPS,
  lineSpacingToDocx,
  pointsToHalfPoints,
  resolveDocumentFormatting,
} from "./formatting";

describe("centimetersToTwip", () => {
  it("converts centimeters to twips (1 cm = 566.929... twips)", () => {
    expect(centimetersToTwip(1)).toBe(566);
    expect(centimetersToTwip(2.54)).toBe(1440); // 1 inch
  });

  it("handles 0", () => {
    expect(centimetersToTwip(0)).toBe(0);
  });

  it("handles decimal values (the product's own default margins)", () => {
    expect(centimetersToTwip(4.7)).toBe(2664);
    expect(centimetersToTwip(3.2)).toBe(1814);
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

describe("lineSpacingToDocx", () => {
  it("maps common line spacing values to docx's twentieths-of-a-point scale", () => {
    expect(lineSpacingToDocx(1.0).line).toBe(240);
    expect(lineSpacingToDocx(1.15).line).toBe(276);
    expect(lineSpacingToDocx(1.5).line).toBe(360);
    expect(lineSpacingToDocx(2.0).line).toBe(480);
  });

  it("always sets lineRule to auto so it scales with the font", () => {
    expect(lineSpacingToDocx(1.5).lineRule).toBe("auto");
  });

  it("rejects 0 and negative values", () => {
    expect(() => lineSpacingToDocx(0)).toThrow(RangeError);
    expect(() => lineSpacingToDocx(-1.5)).toThrow(RangeError);
  });

  it("rejects NaN", () => {
    expect(() => lineSpacingToDocx(NaN)).toThrow(RangeError);
  });
});

describe("LEGAL_PAGE_SIZE_TWIPS", () => {
  it("is 8.5 x 14 inches in twips", () => {
    expect(LEGAL_PAGE_SIZE_TWIPS.width).toBe(12240);
    expect(LEGAL_PAGE_SIZE_TWIPS.height).toBe(20160);
  });
});

describe("resolveDocumentFormatting", () => {
  it("returns the product defaults when there is no saved row", () => {
    expect(resolveDocumentFormatting(null)).toEqual(DOCX_DEFAULT_FORMATTING);
    expect(resolveDocumentFormatting(undefined)).toEqual(
      DOCX_DEFAULT_FORMATTING,
    );
  });

  it("uses every saved preference when all are valid", () => {
    const resolved = resolveDocumentFormatting({
      font_family: "Arial",
      font_size: 11,
      line_spacing: 2,
      margin_top_cm: 2,
      margin_bottom_cm: 2.5,
      margin_left_cm: 3,
      margin_right_cm: 3.5,
    });
    expect(resolved).toEqual({
      fontFamily: "Arial",
      fontSizePt: 11,
      lineSpacing: 2,
      marginsCm: { top: 2, bottom: 2.5, left: 3, right: 3.5 },
    });
  });

  it("never swaps top/bottom or left/right", () => {
    const resolved = resolveDocumentFormatting({
      margin_top_cm: 1,
      margin_bottom_cm: 2,
      margin_left_cm: 3,
      margin_right_cm: 4,
    });
    expect(resolved.marginsCm).toEqual({ top: 1, bottom: 2, left: 3, right: 4 });
  });

  it("falls back to defaults for a font family not in the allowed list", () => {
    const resolved = resolveDocumentFormatting({ font_family: "Comic Sans" });
    expect(resolved.fontFamily).toBe(DOCX_DEFAULT_FORMATTING.fontFamily);
  });

  it("falls back to defaults for invalid numeric fields independently", () => {
    const resolved = resolveDocumentFormatting({
      font_size: NaN,
      line_spacing: -1,
      margin_top_cm: -0.1,
      // margin_bottom_cm/left/right valid — must be preserved.
      margin_bottom_cm: 1,
      margin_left_cm: 1,
      margin_right_cm: 1,
    });
    expect(resolved.fontSizePt).toBe(DOCX_DEFAULT_FORMATTING.fontSizePt);
    expect(resolved.lineSpacing).toBe(DOCX_DEFAULT_FORMATTING.lineSpacing);
    expect(resolved.marginsCm.top).toBe(DOCX_DEFAULT_FORMATTING.marginsCm.top);
    expect(resolved.marginsCm.bottom).toBe(1);
    expect(resolved.marginsCm.left).toBe(1);
    expect(resolved.marginsCm.right).toBe(1);
  });

  it("accepts a margin of exactly 0", () => {
    const resolved = resolveDocumentFormatting({
      margin_top_cm: 0,
      margin_bottom_cm: 0,
      margin_left_cm: 0,
      margin_right_cm: 0,
    });
    expect(resolved.marginsCm).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it("treats missing fields as absent, not invalid, and still falls back to defaults", () => {
    const resolved = resolveDocumentFormatting({});
    expect(resolved).toEqual(DOCX_DEFAULT_FORMATTING);
  });
});
