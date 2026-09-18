/**
 * Configuración documental central del DOCX de escrituras.
 *
 * Traduce las preferencias de formato del usuario (`DocumentFormattingPreferences`,
 * ver `formatting.ts`) a las unidades y estructura que espera `docx`: página
 * Legal vertical, márgenes en twips, fuente y tamaño en medios puntos.
 * El formato de párrafo del cuerpo es fijo (justificado, sangrías 0,
 * antes/después 0, interlineado exacto 24pt — ver `FIXED_BODY_PARAGRAPH` en
 * `formatting.ts`). Los márgenes salen del perfil elegido (Frente/Vuelto). Único lugar que
 * arma esta traducción para no repartir estilos por varias funciones.
 */

import {
  centimetersToTwip,
  FIXED_BODY_PARAGRAPH,
  LEGAL_PAGE_SIZE_TWIPS,
  pointsToHalfPoints,
  type DocumentFormattingPreferences,
} from "./formatting";
import { DEFAULT_MARGIN_PROFILE, type MarginProfile } from "./margin-profile";

export function buildDocxSectionConfig(
  prefs: DocumentFormattingPreferences,
  profile: MarginProfile = DEFAULT_MARGIN_PROFILE,
) {
  const margins = prefs.marginsCm[profile];
  return {
    page: {
      width: LEGAL_PAGE_SIZE_TWIPS.width,
      height: LEGAL_PAGE_SIZE_TWIPS.height,
      margin: {
        top: centimetersToTwip(margins.top),
        bottom: centimetersToTwip(margins.bottom),
        left: centimetersToTwip(margins.left),
        right: centimetersToTwip(margins.right),
      },
    },
    fontFamily: prefs.fontFamily,
    fontHalfPoints: pointsToHalfPoints(prefs.fontSizePt),
    paragraph: FIXED_BODY_PARAGRAPH,
  } as const;
}
