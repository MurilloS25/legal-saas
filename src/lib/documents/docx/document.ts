import "server-only";

/**
 * Composición de alto nivel: de los datos persistidos de una escritura al
 * archivo `.docx` listo para descargar. Reutiliza la capa compartida de
 * conversión y render (sin duplicar la sustitución de variables):
 *
 *   content_json  --resolveTemplateContent-->  documento estructurado
 *   documento + field_values  --buildDocumentModel-->  modelo neutral
 *   modelo  --generateDocumentDocx-->  Buffer
 *
 * Funciona igual para machotes con `content_json.doc` y para machotes legacy
 * con solo texto (la conversión ocurre en `resolveTemplateContent`). Si el
 * machote cambió después de guardar el borrador, se usa el snapshot
 * persistido (`rendered_content`) para que el Word represente la última
 * versión guardada.
 */

import { resolveTemplateContent } from "@/lib/editor/content";
import { legacyTextToDocument } from "@/lib/editor/convert";
import {
  buildDocumentModel,
  renderStructuredTemplate,
  type OptionSelectionsMap,
  type VariableTransformsMap,
} from "@/lib/editor/render";
import { findUnresolvedDocumentVariables } from "@/lib/editor/variables";
import { buildDocxFilename } from "./filename";
import { generateDocumentDocx } from "./generate";

export type EscrituraDocxInput = {
  /** `templates.content_json` sin procesar. */
  contentJson: unknown;
  /** `documents.field_values` persistidos. */
  fieldValues: Record<string, string>;
  /**
   * Snapshot server-side persistido en `documents.rendered_content`.
   * Se usa como fallback estable si el machote actual ya no genera el mismo
   * texto que el último borrador guardado.
   */
  renderedContent?: string;
  /** Título persistido de la escritura (fuente del nombre de archivo). */
  title: string;
  /** Transformación de salida configurada por variable (`field_key -> transform`). */
  transforms?: VariableTransformsMap;
  /** `documents.option_selections` persistidos (`blockId -> variantId`). */
  optionSelections?: OptionSelectionsMap;
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
  const { document } = resolveTemplateContent(input.contentJson);
  const currentRendered = renderStructuredTemplate(
    document,
    input.fieldValues,
    input.transforms,
    input.optionSelections,
  );
  const usePersistedSnapshot =
    typeof input.renderedContent === "string" &&
    input.renderedContent !== currentRendered;
  const sourceDocument = usePersistedSnapshot
    ? legacyTextToDocument(input.renderedContent ?? "")
    : document;
  const sourceValues = usePersistedSnapshot ? {} : input.fieldValues;
  const sourceSelections = usePersistedSnapshot ? undefined : input.optionSelections;
  const model = buildDocumentModel(
    sourceDocument,
    sourceValues,
    usePersistedSnapshot ? undefined : input.transforms,
    sourceSelections,
  );
  const buffer = await generateDocumentDocx(model);

  return {
    buffer,
    filename: buildDocxFilename(input.title),
    pendingVariables: findUnresolvedDocumentVariables(
      sourceDocument,
      sourceValues,
      sourceSelections,
    ),
  };
}
