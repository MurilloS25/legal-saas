import type { ClientDocumentRow } from "../server/detail-queries";
import { ClientDocumentsTable } from "./ClientDocumentsTable";
import Link from "next/link";

type Props = {
  documents: ClientDocumentRow[];
  /** Total real de Escrituras del cliente (`documents` solo trae las recientes). */
  total: number;
  clientId: string;
};

export function ClientDocumentsSection({ documents, total, clientId }: Props) {
  return (
    <section aria-labelledby="client-documents-heading" >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 id="client-documents-heading" className="text-sm font-semibold text-slate-900">
            Escrituras
          </h2>
          <p className="text-xs text-slate-500">
            {total === 1 ? "1 en total" : `${total} en total`}
          </p>
        </div>
        <Link href={`/documents?client=${clientId}`} className="text-sm font-medium text-accent-700 hover:underline">
          Ver todas
        </Link>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">
            Este cliente todavía no tiene escrituras asociadas.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <ClientDocumentsTable rows={documents} />
        </div>
      )}
    </section>
  );
}
