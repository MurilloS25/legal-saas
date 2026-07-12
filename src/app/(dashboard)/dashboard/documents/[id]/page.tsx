import { notFound } from "next/navigation";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { getDocumentById } from "../queries";
import {
  extractContent,
  getTemplateById,
  listTemplateFields,
} from "../../templates/queries";
import { DocumentDraftForm } from "../_components/DocumentDraftForm";

export const metadata = {
  title: "Escritura — LexCR",
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
};

export default async function DocumentDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { saved } = await searchParams;

  // getDocumentById devuelve null tanto para documentos inexistentes como
  // ajenos: el 404 no revela cuál de los dos casos ocurrió.
  const document = await getDocumentById(id);
  if (!document) notFound();

  const template = await getTemplateById(document.template_id);
  const fields = template ? await listTemplateFields(template.id) : [];

  return (
    <PageContainer>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/dashboard/documents"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 focus:outline-none focus:underline"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Escrituras
        </Link>
      </nav>

      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold text-slate-900">
          {document.title}
        </h1>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          Borrador
        </span>
      </div>
      {template && (
        <p className="-mt-4 mb-6 text-sm text-slate-500">
          Machote: {template.name}
        </p>
      )}

      {!template ? (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm px-6 py-8">
          <p className="text-sm text-slate-700 mb-2 font-medium">
            El machote de esta escritura ya no está disponible.
          </p>
          <p className="text-sm text-slate-600 mb-4">
            Se conserva la última vista previa guardada, pero el borrador no
            puede editarse sin su machote.
          </p>
          <pre className="mx-auto max-w-prose rounded-lg border border-slate-200 bg-slate-50 px-6 py-5 text-sm text-slate-900 whitespace-pre-wrap break-words font-sans leading-relaxed">
            {document.rendered_content}
          </pre>
        </div>
      ) : (
        <DocumentDraftForm
          mode="edit"
          document={document}
          savedJustNow={saved === "1"}
          fields={fields}
          content={extractContent(template)}
        />
      )}
    </PageContainer>
  );
}
