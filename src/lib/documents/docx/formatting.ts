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
  DEFAULT_MARGINS_CM,
  type MarginProfile,
  type MarginsCm,
} from "./margin-profile";
import {
  ALLOWED_FONT_FAMILIES,
  type AllowedFontFamily,
} from "@/lib/validations/settings";

export type DocumentFormattingPreferences = {
  fontFamily: AllowedFontFamily;
  fontSizePt: number;
  marginsCm: Record<MarginProfile, MarginsCm>;
};

/** Alineados con `DOCUMENT_SETTINGS_DEFAULTS` en la UI de Configuración. */
export const DOCX_DEFAULT_FORMATTING: DocumentFormattingPreferences = {
  fontFamily: "Times New Roman",
  fontSizePt: 12,
  marginsCm: {
    front: { ...DEFAULT_MARGINS_CM.front },
    back: { ...DEFAULT_MARGINS_CM.back },
  },
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

/**
 * Formato fijo de párrafo del cuerpo (mismo que el Word de referencia):
 * justificado, sangrías izquierda/derecha 0 y sin sangría especial, espacio
 * antes/después 0 pt, interlineado exacto 24 pt. Única definición — la usa
 * `config.ts` para los `docDefaults` del documento.
 */
export const FIXED_BODY_PARAGRAPH = {
  alignment: FIXED_BODY_ALIGNMENT,
  indent: { left: 0, right: 0 },
  spacing: {
    before: 0,
    after: 0,
    ...FIXED_BODY_LINE_SPACING,
  },
} as const;

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
  back_margin_top_cm?: number | null;
  back_margin_bottom_cm?: number | null;
  back_margin_left_cm?: number | null;
  back_margin_right_cm?: number | null;
} | null | undefined;

/**
 * Resuelve los cuatro márgenes de un perfil: cada uno cae de forma
 * independiente a `fallback` si falta o es inválido.
 */
function resolveMargins(
  raw: Record<keyof MarginsCm, unknown>,
  fallback: MarginsCm,
): MarginsCm {
  const pick = (v: unknown, fb: number) => (isFiniteNonNegative(v) ? v : fb);
  return {
    top: pick(raw.top, fallback.top),
    bottom: pick(raw.bottom, fallback.bottom),
    left: pick(raw.left, fallback.left),
    right: pick(raw.right, fallback.right),
  };
}

/**
 * Fila cruda de `document_settings` → preferencias completas y válidas.
 * Cada campo ausente o inválido cae a su default de forma independiente: una
 * sola preferencia corrupta nunca bloquea la generación del documento
 * completo. Sin fila guardada (usuario nuevo), devuelve los defaults.
 *
 * Compatibilidad: una fila anterior a Frente/Vuelto (columnas `back_*` NULL)
 * usa sus márgenes guardados también para Vuelto.
 */
export function resolveDocumentFormatting(
  raw: RawDocumentFormattingSettings,
): DocumentFormattingPreferences {
  const defaults = DOCX_DEFAULT_FORMATTING;
  if (!raw) return defaults;

  const front = resolveMargins(
    {
      top: raw.margin_top_cm,
      bottom: raw.margin_bottom_cm,
      left: raw.margin_left_cm,
      right: raw.margin_right_cm,
    },
    defaults.marginsCm.front,
  );
  const back = resolveMargins(
    {
      top: raw.back_margin_top_cm,
      bottom: raw.back_margin_bottom_cm,
      left: raw.back_margin_left_cm,
      right: raw.back_margin_right_cm,
    },
    front,
  );

  return {
    fontFamily: isAllowedFontFamily(raw.font_family)
      ? raw.font_family
      : defaults.fontFamily,
    fontSizePt: isFinitePositive(raw.font_size)
      ? raw.font_size
      : defaults.fontSizePt,
    marginsCm: { front, back },
  };
}
