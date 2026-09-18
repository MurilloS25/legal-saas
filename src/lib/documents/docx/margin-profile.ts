/**
 * Perfil de márgenes de una exportación: "front" (Frente) o "back" (Vuelto).
 * Módulo sin dependencias de servidor: lo comparten el generador DOCX, la
 * Configuración y el selector de la descarga (componentes cliente).
 */

export const MARGIN_PROFILES = ["front", "back"] as const;
export type MarginProfile = (typeof MARGIN_PROFILES)[number];
export const DEFAULT_MARGIN_PROFILE: MarginProfile = "front";

export const MARGIN_PROFILE_LABELS: Record<MarginProfile, string> = {
  front: "Frente",
  back: "Vuelto",
};

/** Valida un valor externo (query string, formulario) como perfil de margen. */
export function parseMarginProfile(value: unknown): MarginProfile | null {
  return (MARGIN_PROFILES as readonly unknown[]).includes(value)
    ? (value as MarginProfile)
    : null;
}

export type MarginsCm = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

/**
 * ÚNICA fuente de los márgenes por defecto de cada perfil, en centímetros
 * (unidad de `document_settings`). Se usan solo cuando el Workspace no tiene
 * valores guardados (ver `resolveDocumentFormatting`); los valores guardados
 * en Configuración siempre tienen prioridad.
 *
 * Hoy Frente y Vuelto tienen los mismos números — los de referencia de Word
 * (portrait, gutter 0): superior 1.44", inferior 2.22", izquierdo y derecho
 * 0.98" = 3.66 / 5.64 / 2.49 / 2.49 cm, que convierten exactamente a
 * 2074 / 3197 / 1411 / 1411 twips. Para cambiar solo un perfil basta editar
 * su objeto aquí.
 */
export const DEFAULT_MARGINS_CM: Record<MarginProfile, MarginsCm> = {
  front: { top: 3.66, bottom: 5.64, left: 2.49, right: 2.49 },
  back: { top: 3.66, bottom: 5.64, left: 2.49, right: 2.49 },
};
