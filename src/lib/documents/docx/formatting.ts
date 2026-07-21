import "server-only";

/**
 * Preferencias de formato de documentos Word: fuente única de verdad entre
 * `document_settings` (guardado en Configuración) y todos los generadores
 * DOCX (Escrituras, Índice Notarial, futuros exportadores).
 *
 * El tamaño de papel es Legal (8.5 × 14 in) siempre — no es una preferencia
 * configurable, es un default fijo del producto (ver spec de este fix).
 */

import {
  AlignmentType,
  convertInchesToTwip,
  convertMillimetersToTwip,
  LineRuleType,
} from "docx";
import {
  ALLOWED_FONT_FAMILIES,
  type AllowedFontFamily,
} from "@/lib/validations/settings";

export type DocumentFormattingPreferences = {
  fontFamily: AllowedFontFamily;
  fontSizePt: number;
  lineSpacing: number;
  marginsCm: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
};

/** Alineados con `DOCUMENT_SETTINGS_DEFAULTS` en la UI de Configuración. */
export const DOCX_DEFAULT_FORMATTING: DocumentFormattingPreferences = {
  fontFamily: "Times New Roman",
  fontSizePt: 12,
  lineSpacing: 1.5,
  marginsCm: { top: 4.7, bottom: 4.7, left: 3.2, right: 3.2 },
};

/**
 * Papel Legal en vertical, en twips (8.5 × 14 in). Único tamaño de página
 * usado por todo DOCX generado: quien necesite horizontal (Índice Notarial)
 * pasa estas mismas dimensiones con `orientation: LANDSCAPE` — `docx`
 * intercambia ancho/alto internamente, igual que ya hacía con A4.
 */
export const LEGAL_PAGE_SIZE_TWIPS = {
  width: convertInchesToTwip(8.5),
  height: convertInchesToTwip(14),
} as const;

const HALF_POINTS_PER_POINT = 2;
/** Twentieths de punto por unidad de interlineado "sencillo" (100%). */
const LINE_SPACING_UNIT = 240;
/** Twentieths de punto por punto — unidad de `spacing.line` en `docx`. */
const TWENTIETHS_PER_POINT = 20;
/** 24pt exactos, en twentieths de punto. */
const FIXED_BODY_LINE_SPACING_PT = 24;

/** Centímetros (márgenes, tal como los ingresa el usuario) → twips. */
export function centimetersToTwip(valueCm: number): number {
  if (!Number.isFinite(valueCm) || valueCm < 0) {
    throw new RangeError(`invalid centimeter value: ${valueCm}`);
  }
  return convertMillimetersToTwip(valueCm * 10);
}

/** Puntos (tamaño de fuente) → medios puntos, la unidad que espera `docx`. */
export function pointsToHalfPoints(valuePt: number): number {
  if (!Number.isFinite(valuePt) || valuePt <= 0) {
    throw new RangeError(`invalid font size: ${valuePt}`);
  }
  return Math.round(valuePt * HALF_POINTS_PER_POINT);
}

/**
 * Interlineado (1.0, 1.15, 1.5, 2.0, ...) → `spacing.line` de `docx`, con
 * `lineRule: "auto"` explícito para que escale con la fuente en uso en vez
 * de una medida fija (`exact`/`atLeast`), que es el comportamiento esperado
 * al elegir "1.5" o "doble" en un procesador de texto.
 */
export function lineSpacingToDocx(value: number): {
  line: number;
  lineRule: (typeof LineRuleType)[keyof typeof LineRuleType];
} {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`invalid line spacing: ${value}`);
  }
  return {
    line: Math.round(LINE_SPACING_UNIT * value),
    lineRule: LineRuleType.AUTO,
  };
}

/**
 * Interlineado fijo del cuerpo documental: exactamente 24pt con regla
 * "exactly" — una medida absoluta, no un múltiplo de la fuente ("auto").
 * Deliberadamente independiente de `DocumentFormattingPreferences.lineSpacing`
 * (ajuste puntual: el interlineado del DOCX generado ya no varía con lo
 * configurado en Configuración).
 */
export const FIXED_BODY_LINE_SPACING = {
  line: FIXED_BODY_LINE_SPACING_PT * TWENTIETHS_PER_POINT,
  lineRule: LineRuleType.EXACTLY,
} as const;

/** Alineación fija del cuerpo documental: justificada. */
export const FIXED_BODY_ALIGNMENT = AlignmentType.JUSTIFIED;

function isAllowedFontFamily(value: unknown): value is AllowedFontFamily {
  return (
    typeof value === "string" &&
    (ALLOWED_FONT_FAMILIES as readonly string[]).includes(value)
  );
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Forma cruda de una fila de `document_settings` (o ausencia de ella). */
export type RawDocumentFormattingSettings = {
  font_family?: string | null;
  font_size?: number | null;
  margin_top_cm?: number | null;
  margin_bottom_cm?: number | null;
  margin_left_cm?: number | null;
  margin_right_cm?: number | null;
  line_spacing?: number | null;
} | null | undefined;

/**
 * Fila cruda de `document_settings` → preferencias completas y válidas.
 * Cada campo ausente o inválido cae a su default de forma independiente: una
 * sola preferencia corrupta nunca bloquea la generación del documento
 * completo. Sin fila guardada (usuario nuevo), devuelve los defaults.
 */
export function resolveDocumentFormatting(
  raw: RawDocumentFormattingSettings,
): DocumentFormattingPreferences {
  const defaults = DOCX_DEFAULT_FORMATTING;
  if (!raw) return defaults;

  return {
    fontFamily: isAllowedFontFamily(raw.font_family)
      ? raw.font_family
      : defaults.fontFamily,
    fontSizePt: isFinitePositive(raw.font_size)
      ? raw.font_size
      : defaults.fontSizePt,
    lineSpacing: isFinitePositive(raw.line_spacing)
      ? raw.line_spacing
      : defaults.lineSpacing,
    marginsCm: {
      top: isFiniteNonNegative(raw.margin_top_cm)
        ? raw.margin_top_cm
        : defaults.marginsCm.top,
      bottom: isFiniteNonNegative(raw.margin_bottom_cm)
        ? raw.margin_bottom_cm
        : defaults.marginsCm.bottom,
      left: isFiniteNonNegative(raw.margin_left_cm)
        ? raw.margin_left_cm
        : defaults.marginsCm.left,
      right: isFiniteNonNegative(raw.margin_right_cm)
        ? raw.margin_right_cm
        : defaults.marginsCm.right,
    },
  };
}
