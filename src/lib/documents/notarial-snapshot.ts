import { z } from "zod";
import { FIELD_KEY_PATTERN } from "@/lib/editor/variable-key";

export const DocumentNotarialConfigurationSchema = z
  .object({
    partySeparator: z.string().max(30),
    fixedSuffix: z.string().max(200).nullable(),
    allowEmpty: z.boolean(),
    mappingsValid: z.boolean(),
    simpleFields: z.object({
      instrument_number: z.string().regex(FIELD_KEY_PATTERN).nullable(),
      authorized_date: z.string().regex(FIELD_KEY_PATTERN).nullable(),
      authorized_time: z.string().regex(FIELD_KEY_PATTERN).nullable(),
      protocol_book: z.string().regex(FIELD_KEY_PATTERN).nullable(),
      initial_folio: z.string().regex(FIELD_KEY_PATTERN).nullable(),
      final_folio: z.string().regex(FIELD_KEY_PATTERN).nullable(),
    }),
    authorizedTimeOptionBlockId: z.string().max(120).nullable(),
    invalidMappings: z.array(
      z.enum([
        "instrument_number",
        "authorized_date",
        "authorized_time",
        "protocol_book",
        "initial_folio",
        "final_folio",
        "parties",
      ]),
    ),
    fields: z
      .array(
        z.object({
          fieldKey: z.string().regex(FIELD_KEY_PATTERN),
          order: z.number().int().min(0),
        }),
      )
      .max(50),
  })
  .strict();

export const DocumentNotarialSnapshotSchema = z
  .object({
    templateName: z.string().trim().min(1).max(200),
    configuration: DocumentNotarialConfigurationSchema.nullable(),
  })
  .strict();

export type DocumentNotarialSnapshot = z.infer<
  typeof DocumentNotarialSnapshotSchema
>;

/**
 * Reads only the shared notarial member of the document snapshot envelope.
 * Version 1 and null are supported legacy states. A malformed/current-looking
 * envelope is rejected instead of silently consulting the mutable Machote.
 */
export function readDocumentNotarialSnapshot(
  templateSnapshot: unknown,
): DocumentNotarialSnapshot | null {
  if (templateSnapshot === null || templateSnapshot === undefined) return null;
  if (
    typeof templateSnapshot === "object" &&
    !Array.isArray(templateSnapshot) &&
    "version" in templateSnapshot &&
    templateSnapshot.version === 1
  ) {
    return null;
  }

  const envelope = z
    .object({
      version: z.literal(2),
      notarial: DocumentNotarialSnapshotSchema,
    })
    .passthrough()
    .safeParse(templateSnapshot);
  if (!envelope.success) {
    throw new Error("El snapshot notarial del machote no es válido.");
  }
  return envelope.data.notarial;
}
