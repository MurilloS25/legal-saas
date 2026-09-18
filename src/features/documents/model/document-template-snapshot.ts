import { z } from "zod";
import {
  buildFillableFields,
  type ConfiguredTemplateField,
  type FillableTemplateField,
  VARIABLE_AUTOFILL_SOURCES,
} from "@/features/templates/domain";
import { serializeDocumentToTemplateText } from "@/lib/editor/convert";
import { VARIABLE_OUTPUT_TRANSFORMS } from "@/lib/editor/text-transforms";
import type { TemplateDocument } from "@/lib/editor/types";
import { validateTemplateDocument } from "@/lib/editor/validate";
import { FIELD_KEY_PATTERN } from "@/lib/editor/variable-key";
import {
  DocumentNotarialSnapshotSchema,
  type DocumentNotarialSnapshot,
} from "@/lib/documents/notarial-snapshot";

export type { DocumentNotarialSnapshot } from "@/lib/documents/notarial-snapshot";

const SNAPSHOT_VERSION = 2 as const;
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

const SnapshotV1EnvelopeSchema = z
  .object({
    version: z.literal(1),
    document: z.unknown(),
    fields: z.array(SnapshotFieldSchema).max(MAX_FIELDS),
  })
  .strict();

const SnapshotEnvelopeSchema = z
  .object({
    version: z.literal(SNAPSHOT_VERSION),
    document: z.unknown(),
    fields: z.array(SnapshotFieldSchema).max(MAX_FIELDS),
    notarial: DocumentNotarialSnapshotSchema,
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
  notarial: DocumentNotarialSnapshot;
};

export type ResolvedDocumentTemplateSnapshot = {
  document: TemplateDocument;
  fields: FillableTemplateField[];
  /** true para filas anteriores a la migration, cuya única fuente histórica es rendered_content. */
  legacy: boolean;
  /** Null only for documents created before the notarial snapshot existed. */
  notarial: DocumentNotarialSnapshot | null;
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
  notarial: DocumentNotarialSnapshot,
): DocumentTemplateSnapshot {
  const documentResult = validateTemplateDocument(document);
  const fieldsResult = z
    .array(FillableSnapshotInputSchema)
    .max(MAX_FIELDS)
    .safeParse(fields);
  const notarialResult = DocumentNotarialSnapshotSchema.safeParse(notarial);
  if (!documentResult.ok || !fieldsResult.success || !notarialResult.success) {
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
    notarial: notarialResult.data,
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
      notarial: null,
    };
  }

  const currentEnvelope = SnapshotEnvelopeSchema.safeParse(snapshot);
  const legacyEnvelope = currentEnvelope.success
    ? null
    : SnapshotV1EnvelopeSchema.safeParse(snapshot);
  const envelope = currentEnvelope.success
    ? currentEnvelope.data
    : legacyEnvelope?.success
      ? legacyEnvelope.data
      : null;
  if (!envelope) {
    throw new Error("El snapshot del machote no es válido.");
  }
  const document = validateTemplateDocument(envelope.document);
  if (!document.ok) {
    throw new Error("El snapshot del machote no es válido.");
  }

  return {
    document: document.document,
    fields: buildFillableFields(
      envelope.fields,
      serializeDocumentToTemplateText(document.document),
    ),
    legacy: false,
    notarial: "notarial" in envelope ? envelope.notarial : null,
  };
}
