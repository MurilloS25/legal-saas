/**
 * Entrada pura (sin React ni Server Actions) del modelo de Clientes, para
 * que otros features —p. ej. el autollenado de Escrituras— reutilicen las
 * reglas de tipo de identificación sin importar componentes.
 */
export {
  IDENTIFICATION_TYPES,
  IDENTIFICATION_TYPE_LABELS,
  isLegalEntityType,
  type IdentificationType,
} from "./model/client-schema";
