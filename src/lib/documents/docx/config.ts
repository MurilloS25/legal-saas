/**
 * Configuración documental central del DOCX de escrituras.
 *
 * Un único lugar define página, márgenes, tipografía e interlineado, para no
 * repartir estilos por varias funciones. Formato inicial deliberadamente
 * sencillo y profesional: A4 vertical, serif ampliamente disponible, texto
 * legible. Sin encabezados, pies, numeración ni estilos jurídicos
 * configurables (fuera de alcance de esta iteración).
 */

import { convertMillimetersToTwip } from "docx";

// docx expresa el tamaño de fuente en medios puntos (24 = 12 pt).
const HALF_POINTS_PER_POINT = 2;

export const DOCX_CONFIG = {
  /** A4 vertical en twips. */
  page: {
    width: convertMillimetersToTwip(210),
    height: convertMillimetersToTwip(297),
    margin: {
      top: convertMillimetersToTwip(25.4),
      bottom: convertMillimetersToTwip(25.4),
      left: convertMillimetersToTwip(25.4),
      right: convertMillimetersToTwip(25.4),
    },
  },
  /** Serif disponible en Windows/macOS/Office sin fuentes embebidas. */
  fontFamily: "Times New Roman",
  /** Tamaño base en medios puntos (12 pt). */
  fontHalfPoints: 12 * HALF_POINTS_PER_POINT,
  paragraph: {
    /** Interlineado 1.5 (240 = sencillo). */
    line: 360,
    /** Separación después de cada párrafo, en twips. */
    after: 120,
  },
} as const;
