/**
 * Sección "Actividad" del detalle de una Escritura: línea de tiempo de solo
 * lectura, más reciente primero. La primera página se renderiza en el
 * servidor (hidratación mínima); "Cargar más" es una isla cliente ligera.
 */

import type { ActivityListItem } from "../server/activity-queries";
import { ActivityRow } from "./ActivityRow";
import { LoadMoreActivity } from "./LoadMoreActivity";

type Props = {
  documentId: string;
  initialItems: ActivityListItem[];
  initialHasMore: boolean;
  initialNextOffset: number;
};

export function DocumentActivity({
  documentId,
  initialItems,
  initialHasMore,
  initialNextOffset,
}: Props) {
  return (
    <section
      aria-labelledby="document-activity-heading"
      className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
        <h2
          id="document-activity-heading"
          className="text-sm font-semibold text-slate-900"
        >
          Actividad
        </h2>
        <p className="text-xs text-slate-500">
          Historial de las acciones principales de esta escritura.
        </p>
      </div>

      {initialItems.length === 0 ? (
        <p className="px-6 py-8 text-sm text-slate-500">
          Todavía no hay actividad registrada para esta escritura.
        </p>
      ) : (
        <ol role="list" className="divide-y divide-slate-100">
          {initialItems.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </ol>
      )}

      <LoadMoreActivity
        documentId={documentId}
        initialHasMore={initialHasMore}
        initialNextOffset={initialNextOffset}
      />
    </section>
  );
}
