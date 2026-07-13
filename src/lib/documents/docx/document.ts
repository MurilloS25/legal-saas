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
 * con solo texto (la conversión ocurre en `resolveTemplateContent`).
 */

import { resolveTemplateContent } from "@/lib/editor/content";
import { buildDocumentModel } from "@/lib/editor/render";
import { findUnresolvedDocumentVariables } from "@/lib/editor/variables";
import { buildDocxFilename } from "./filename";
import { generateDocumentDocx } from "./generate";

export type EscrituraDocxInput = {
  /** `templates.content_json` sin procesar. */
  contentJson: unknown;
  /** `documents.field_values` persistidos. */
  fieldValues: Record<string, string>;
  /** Título persistido de la escritura (fuente del nombre de archivo). */
  title: string;
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
  const model = buildDocumentModel(document, input.fieldValues);
  const buffer = await generateDocumentDocx(model);

  return {
    buffer,
    filename: buildDocxFilename(input.title),
    pendingVariables: findUnresolvedDocumentVariables(
      document,
      input.fieldValues,
    ),
  };
}
