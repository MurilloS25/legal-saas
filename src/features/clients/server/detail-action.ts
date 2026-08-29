"use server";

/**
 * Carga del detalle completo de un cliente (datos + escrituras + cuentas
 * por cobrar) invocable directamente desde un componente cliente.
 *
 * Existe para el panel de detalle del módulo Clientes (list+detail,
 * iteración 3): seleccionar una fila ya no navega a una página nueva, así
 * que el detalle se obtiene con esta Server Action en vez de un Server
 * Component completo. Es de solo lectura — no reemplaza ni cambia
 * `createClientAction`/`updateClientAction`/`deleteClientAction` en
 * `./actions.ts`, que conservan su firma y su payload sin cambios.
 * `requireWorkspace()` (dentro de cada consulta) sigue acotando el acceso
 * al mismo Workspace, igual que la carga inicial server-side de la página.
 */

import { getClientById } from "./detail-queries";
import { listDocumentsByClient, type ClientDocumentRow } from "@/features/documents/server";
import { listReceivablesByClient } from "@/features/receivables/server";
import type { ReceivableEntry } from "@/features/receivables";
import type { ClientRow } from "../model/types";

export type ClientDetailPayload = {
  client: ClientRow;
  documents: ClientDocumentRow[];
  receivables: ReceivableEntry[];
};

export async function getClientDetailAction(
  id: string,
): Promise<ClientDetailPayload | null> {
  const client = await getClientById(id);
  if (!client) return null;

  const [documents, receivables] = await Promise.all([
    listDocumentsByClient(client.id),
    listReceivablesByClient(client.id),
  ]);

  return { client, documents, receivables };
}
