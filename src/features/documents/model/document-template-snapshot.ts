import { z } from "zod";
import {
  buildFillableFields,
  type ConfiguredTemplateField,
  type FillableTemplateField,
} from "@/features/templates/model/fillable-fields";
import { VARIABLE_AUTOFILL_SOURCES } from "@/features/templates/model/variable-autofill";
import { serializeDocumentToTemplateText } from "@/lib/editor/convert";
import { VARIABLE_OUTPUT_TRANSFORMS } from "@/lib/editor/text-transforms";
import type { TemplateDocument } from "@/lib/editor/types";
import { validateTemplateDocument } from "@/lib/editor/validate";
import { FIELD_KEY_PATTERN } from "@/lib/editor/variable-key";

const SNAPSHOT_VERSION = 1 as const;
const MAX_FIELDS = 200;

const SnapshotFieldSchema = z
  .object({
    field_key: z.string().max(120).regex(FIELD_KEY_PATTERN),
    label: z.string().trim().min(1).max(200),
    required: z.boolean(),
    field_type: z.enum([
      "text",
      "number",
      "date",
      "time",
      "money",
      "client",
      "select",
      "boolean",
      "textarea",
    ]),
    autofill_source: z.enum(VARIABLE_AUTOFILL_SOURCES),
    output_transform: z.enum(VARIABLE_OUTPUT_TRANSFORMS),
  })
  .strict();

const SnapshotEnvelopeSchema = z
  .object({
    version: z.literal(SNAPSHOT_VERSION),
    document: z.unknown(),
    fields: z.array(SnapshotFieldSchema).max(MAX_FIELDS),
  })
  .strict();

const FillableSnapshotInputSchema = SnapshotFieldSchema.extend({
  derived: z.boolean(),
}).strict();

export type DocumentTemplateSnapshot = {
  version: typeof SNAPSHOT_VERSION;
  document: TemplateDocument;
  /** Solo configuración explícita; variables derivadas se reconstruyen desde document. */
  fields: ConfiguredTemplateField[];
};

export type ResolvedDocumentTemplateSnapshot = {
  document: TemplateDocument;
  fields: FillableTemplateField[];
  /** true para filas anteriores a la migration, cuya única fuente histórica es rendered_content. */
  legacy: boolean;
};

function savedRenderedTextToDocument(text: string): TemplateDocument {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      ...(line === "" ? {} : { content: [{ type: "text" as const, text: line }] }),
    })),
  };
}

export function createDocumentTemplateSnapshot(
  document: TemplateDocument,
  fields: FillableTemplateField[],
): DocumentTemplateSnapshot {
  const documentResult = validateTemplateDocument(document);
  const fieldsResult = z
    .array(FillableSnapshotInputSchema)
    .max(MAX_FIELDS)
    .safeParse(fields);
  if (!documentResult.ok || !fieldsResult.success) {
    throw new Error("No fue posible crear el snapshot del machote.");
  }

  return {
    version: SNAPSHOT_VERSION,
    document: documentResult.document,
    fields: fieldsResult.data
      .filter((field) => !field.derived)
      .map((field) => ({
        field_key: field.field_key,
        label: field.label,
        required: field.required,
        field_type: field.field_type,
        autofill_source: field.autofill_source,
        output_transform: field.output_transform,
      })),
  };
}

/**
 * Resuelve siempre desde datos propios de la Escritura. Un registro anterior
 * a la migration no se reconstruye con el Machote actual: usa su texto
 * renderizado persistido como documento plano, que es la única historia fiel
 * disponible para ese registro.
 */
export function resolveDocumentTemplateSnapshot(
  snapshot: unknown,
  renderedContent: string,
): ResolvedDocumentTemplateSnapshot {
  if (snapshot === null || snapshot === undefined) {
    return {
      document: savedRenderedTextToDocument(renderedContent),
      fields: [],
      legacy: true,
    };
  }

  const envelope = SnapshotEnvelopeSchema.safeParse(snapshot);
  if (!envelope.success) {
    throw new Error("El snapshot del machote no es válido.");
  }
  const document = validateTemplateDocument(envelope.data.document);
  if (!document.ok) {
    throw new Error("El snapshot del machote no es válido.");
  }

  return {
    document: document.document,
    fields: buildFillableFields(
      envelope.data.fields,
      serializeDocumentToTemplateText(document.document),
    ),
    legacy: false,
  };
}
