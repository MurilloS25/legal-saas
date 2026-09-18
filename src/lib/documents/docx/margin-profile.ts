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
 * Márgenes de referencia de Word (Frente y Vuelto, portrait, gutter 0):
 * superior 1.44", inferior 2.22", izquierdo y derecho 0.98". Se guardan en cm
 * con 2 decimales (unidad de `document_settings`): 3.66 / 5.64 / 2.49 cm.
 * Convertidos a twips dan exactamente los de las pulgadas de Word:
 * 2074 / 3197 / 1411 / 1411.
 */
export const REFERENCE_MARGINS_CM: MarginsCm = {
  top: 3.66,
  bottom: 5.64,
  left: 2.49,
  right: 2.49,
};
