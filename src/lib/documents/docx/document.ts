import "server-only";

/**
 * Composición de alto nivel: de los datos persistidos de una escritura al
 * archivo `.docx` listo para descargar. Reutiliza la capa compartida de
 * conversión y render (sin duplicar la sustitución de variables):
 *
 *   snapshot document + field_values  --buildDocumentModel-->  modelo neutral
 *   modelo  --generateDocumentDocx-->  Buffer
 *
 * La capa de acceso resuelve tanto snapshots estructurados como Escrituras
 * legacy antes de llamar esta función. Preview y Word consumen así el mismo
 * `TemplateDocument` propio de la Escritura.
 */

import {
  buildDocumentModel,
  type OptionSelectionsMap,
  type VariableTransformsMap,
} from "@/lib/editor/render";
import { findUnresolvedDocumentVariables } from "@/lib/editor/variables";
import type { TemplateDocument } from "@/lib/editor/types";
import { buildDocxFilename } from "./filename";
import {
  DOCX_DEFAULT_FORMATTING,
  type DocumentFormattingPreferences,
  type MarginProfile,
} from "./formatting";
import { generateDocumentDocx } from "./generate";

export type EscrituraDocxInput = {
  /** Documento estructurado del snapshot propio de la Escritura. */
  document: TemplateDocument;
  /** `documents.field_values` persistidos. */
  fieldValues: Record<string, string>;
  /** Título persistido de la escritura (fuente del nombre de archivo). */
  title: string;
  /** Transformación de salida configurada por variable (`field_key -> transform`). */
  transforms?: VariableTransformsMap;
  /** `documents.option_selections` persistidos (`blockId -> variantId`). */
  optionSelections?: OptionSelectionsMap;
  /** Preferencias de formato del dueño (ver `formatting.ts`); defaults si se omite. */
  formatting?: DocumentFormattingPreferences;
  /** Perfil de márgenes a aplicar: Frente (default) o Vuelto. */
  marginProfile?: MarginProfile;
};

export type EscrituraDocxResult = {
  buffer: Buffer;
  filename: string;
  /** Claves de variables sin valor, en orden de aparición. */
  pendingVariables: string[];
};

export async function buildEscrituraDocx(
  input: EscrituraDocxInput,
): Promise<EscrituraDocxResult> {
  const model = buildDocumentModel(
    input.document,
    input.fieldValues,
    input.transforms,
    input.optionSelections,
  );
  const buffer = await generateDocumentDocx(
    model,
    input.formatting ?? DOCX_DEFAULT_FORMATTING,
    input.marginProfile,
  );

  return {
    buffer,
    filename: buildDocxFilename(input.title),
    pendingVariables: findUnresolvedDocumentVariables(
      input.document,
      input.fieldValues,
      input.optionSelections,
    ),
  };
}
