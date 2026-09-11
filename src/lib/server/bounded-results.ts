import "server-only";

import { ValidationError } from "./errors";

/** Keeps auxiliary selectors below the local PostgREST max_rows of 1000. */
export const AUXILIARY_QUERY_LIMIT = 500;

export function ensureWithinResultLimit<T>(
  rows: T[],
  limit: number,
  resourceLabel: string,
): T[] {
  if (rows.length > limit) {
    throw new ValidationError(
      `Hay demasiados ${resourceLabel} para cargarlos de forma segura. Refina la selección.`,
    );
  }
  return rows;
}
