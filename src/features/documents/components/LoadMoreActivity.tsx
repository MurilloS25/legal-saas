"use client";

/**
 * Isla cliente ligera para la carga incremental de actividad. La lista inicial
 * se renderiza en el servidor; aquí solo vive el botón "Cargar más" y las
 * páginas siguientes que el usuario cargue. Mantener esta isla pequeña evita
 * encarecer la hidratación del detalle de la Escritura.
 */

import { useState } from "react";
import { loadDocumentActivityAction } from "../server/activity-actions";
import type { ActivityListItem } from "../server/activity";
import { ActivityRow } from "./ActivityRow";

type Props = {
  documentId: string;
  initialHasMore: boolean;
  initialNextOffset: number;
};

export function LoadMoreActivity({
  documentId,
  initialHasMore,
  initialNextOffset,
}: Props) {
  const [items, setItems] = useState<ActivityListItem[]>([]);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [offset, setOffset] = useState(initialNextOffset);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function loadMore() {
    if (loading) return;
    setLoading(true);
    setError(false);
    try {
      const page = await loadDocumentActivityAction(documentId, offset);
      setItems((current) => [...current, ...page.items]);
      setHasMore(page.hasMore);
      setOffset(page.nextOffset);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {items.length > 0 && (
        <ol role="list" className="divide-y divide-slate-100 border-t border-slate-100">
          {items.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </ol>
      )}

      {(hasMore || error) && (
        <div className="border-t border-slate-100 px-6 py-4">
          {error && (
            <p role="alert" className="mb-2 text-xs text-red-700">
              No fue posible cargar más actividad.
            </p>
          )}
          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Cargando…" : "Cargar más"}
            </button>
          )}
        </div>
      )}
    </>
  );
}
