import type { ClientDocumentRow } from "../server/detail-queries";
import { ClientDocumentsTable } from "./ClientDocumentsTable";

type Props = {
  documents: ClientDocumentRow[];
};

export function ClientDocumentsSection({ documents }: Props) {
  return (
    <section aria-labelledby="client-documents-heading" className="mt-8">
      <h2
        id="client-documents-heading"
        className="text-sm font-semibold text-slate-900 mb-3"
      >
        Escrituras
      </h2>

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
