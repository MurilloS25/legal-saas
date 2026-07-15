"use server";

import {
  listDocumentActivity,
  type DocumentActivityPage,
} from "./activity-queries";

/**
 * Carga incremental ("Cargar más") de la actividad de una Escritura. Delega en
 * `listDocumentActivity`, que aplica auth y RLS; el cliente solo envía el
 * `documentId` y el `offset`.
 */
export async function loadDocumentActivityAction(
  documentId: string,
  offset: number,
): Promise<DocumentActivityPage> {
  return listDocumentActivity(documentId, offset);
}
