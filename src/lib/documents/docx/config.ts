/**
 * Configuración documental central del DOCX de escrituras.
 *
 * Traduce las preferencias de formato del usuario (`DocumentFormattingPreferences`,
 * ver `formatting.ts`) a las unidades y estructura que espera `docx`: página
 * Legal vertical, márgenes en twips, fuente y tamaño en medios puntos,
 * interlineado con `lineRule` explícito. Único lugar que arma esta
 * traducción para no repartir estilos por varias funciones.
 */

import {
  centimetersToTwip,
  LEGAL_PAGE_SIZE_TWIPS,
  lineSpacingToDocx,
  pointsToHalfPoints,
  type DocumentFormattingPreferences,
} from "./formatting";

/** Separación después de cada párrafo, en twips — fija, no configurable. */
const PARAGRAPH_SPACING_AFTER_TWIPS = 120;

export function buildDocxSectionConfig(prefs: DocumentFormattingPreferences) {
  return {
    page: {
      width: LEGAL_PAGE_SIZE_TWIPS.width,
      height: LEGAL_PAGE_SIZE_TWIPS.height,
      margin: {
        top: centimetersToTwip(prefs.marginsCm.top),
        bottom: centimetersToTwip(prefs.marginsCm.bottom),
        left: centimetersToTwip(prefs.marginsCm.left),
        right: centimetersToTwip(prefs.marginsCm.right),
      },
    },
    fontFamily: prefs.fontFamily,
    fontHalfPoints: pointsToHalfPoints(prefs.fontSizePt),
    paragraph: {
      ...lineSpacingToDocx(prefs.lineSpacing),
      after: PARAGRAPH_SPACING_AFTER_TWIPS,
    },
  } as const;
}
