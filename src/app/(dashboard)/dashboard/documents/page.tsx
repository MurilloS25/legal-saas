import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { listDocuments } from "./queries";
import { DeleteDocumentButton } from "./_components/DeleteDocumentButton";

export const metadata = {
  title: "Escrituras — LexCR",
};

// ------------------------------------------------------------------ helpers

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const newDocumentButtonClass =
  "inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors";

// ------------------------------------------------------------------ page

export default async function DocumentsPage() {
  const documents = await listDocuments();

  return (
    <PageContainer>
      {/* ---- header ---- */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Escrituras</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tus borradores de escrituras. Continúa donde quedaste o crea una
            nueva a partir de un machote.
          </p>
        </div>
        <Link href="/dashboard/documents/new" className={newDocumentButtonClass}>
          Nueva escritura
        </Link>
      </div>

      {/* ---- empty state ---- */}
      {documents.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-900 mb-1">
            Aún no tienes borradores de escrituras
          </p>
          <p className="text-xs text-slate-500 mb-6">
            Crea tu primera escritura seleccionando un machote y llenando sus
            datos. El borrador quedará guardado para continuar después.
          </p>
          <Link
            href="/dashboard/documents/new"
            className={newDocumentButtonClass}
          >
            Crear primera escritura
          </Link>
        </div>
      ) : (
        /* ---- drafts list ---- */
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="hidden sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_minmax(0,1fr)_auto] gap-3 px-6 py-3 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Escritura
            </span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Machote
            </span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Estado
            </span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Actualizada
            </span>
            <span className="w-24" />
          </div>

          <ul role="list" className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-col gap-2 px-6 py-4 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_minmax(0,1fr)_auto] sm:items-center sm:gap-3 hover:bg-slate-50 transition-colors"
              >
                <p className="text-sm font-medium text-slate-900 truncate">
                  {doc.title}
                </p>

                <p className="text-sm text-slate-500 truncate">
                  {doc.templates?.name ?? "—"}
                </p>

                <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  Borrador
                </span>

                <p className="text-sm text-slate-500">
                  {formatDate(doc.updated_at)}
                </p>

                <div className="flex items-center gap-1">
                  <Link
                    href={`/dashboard/documents/${doc.id}`}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
                  >
                    Continuar
                  </Link>
                  <DeleteDocumentButton
                    documentId={doc.id}
                    documentTitle={doc.title}
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="border-t border-slate-100 bg-slate-50 px-6 py-3">
            <p className="text-xs text-slate-500">
              {documents.length === 1
                ? "1 borrador guardado"
                : `${documents.length} borradores guardados`}
            </p>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
