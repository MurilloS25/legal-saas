import "server-only";

/**
 * Generación del archivo `.docx` a partir del modelo documental neutral
 * (`DocumentModel`) que ya usan el preview y el compositor. No hay un segundo
 * renderer de variables: el modelo llega con las variables ya resueltas
 * (`buildDocumentModel` + `field_values`) o marcadas como pendientes.
 *
 * Server-only: importa `docx` (pesado) y nunca debe entrar al bundle cliente.
 * El archivo se genera en memoria y se devuelve como Buffer; no se escribe a
 * disco, Storage ni base de datos, ni se envía a terceros.
 */

import {
  Document,
  PageOrientation,
  Packer,
  Paragraph,
  TextRun,
  UnderlineType,
} from "docx";
import type { DocumentModel, DocumentRun } from "@/lib/editor/render";
import { DOCX_CONFIG } from "./config";
import {
  checkDocumentModelLimits,
  DOCX_LIMITS,
  type DocxLimitCode,
} from "./limits";

export type DocxErrorCode = DocxLimitCode | "generation_failed";

/** Error del generador con un código técnico no sensible (sin contenido). */
export class DocxGenerationError extends Error {
  readonly code: DocxErrorCode;
  constructor(code: DocxErrorCode) {
    super(`docx generation failed: ${code}`);
    this.name = "DocxGenerationError";
    this.code = code;
  }
}

function runToTextRun(run: DocumentRun): TextRun {
  switch (run.kind) {
    case "text":
      return new TextRun({
        text: run.text,
        bold: run.marks.bold || undefined,
        italics: run.marks.italic || undefined,
        underline: run.marks.underline ? { type: UnderlineType.SINGLE } : undefined,
      });
    case "variable":
      // Variable resuelta → su valor; pendiente → `{{key}}` visible.
      return new TextRun({
        text: run.resolved ? run.value : `{{${run.key}}}`,
      });
    case "break":
      // Salto de línea dentro del mismo párrafo (hardBreak).
      return new TextRun({ break: 1 });
  }
}

function paragraphToDocx(runs: DocumentRun[]): Paragraph {
  return new Paragraph({ children: runs.map(runToTextRun) });
}

/**
 * Genera el `.docx` en memoria desde el modelo documental. Lanza
 * `DocxGenerationError` con un código técnico si el documento excede los
 * límites o si el empaquetado falla.
 */
export async function generateDocumentDocx(
  model: DocumentModel,
): Promise<Buffer> {
  const limit = checkDocumentModelLimits(model);
  if (limit) throw new DocxGenerationError(limit);

  const children =
    model.length > 0
      ? model.map((paragraph) => paragraphToDocx(paragraph.runs))
      : [new Paragraph({})];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: DOCX_CONFIG.fontFamily,
            size: DOCX_CONFIG.fontHalfPoints,
          },
          paragraph: {
            spacing: {
              line: DOCX_CONFIG.paragraph.line,
              after: DOCX_CONFIG.paragraph.after,
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: DOCX_CONFIG.page.width,
              height: DOCX_CONFIG.page.height,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: DOCX_CONFIG.page.margin,
          },
        },
        children,
      },
    ],
  });

  let buffer: Buffer;
  try {
    buffer = await Packer.toBuffer(doc);
  } catch {
    // No se registra el error original: podría contener fragmentos del
    // contenido del documento.
    throw new DocxGenerationError("generation_failed");
  }

  if (buffer.byteLength > DOCX_LIMITS.maxBufferBytes) {
    throw new DocxGenerationError("buffer_too_large");
  }

  return buffer;
}
