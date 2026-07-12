import { notFound } from "next/navigation";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  extractContent,
  getTemplateById,
  listTemplateFields,
} from "../../../templates/queries";
import { DocumentFillForm } from "../../../templates/_components/DocumentFillForm";

export const metadata = {
  title: "Crear escritura — LexCR",
};

type Props = {
  params: Promise<{ templateId: string }>;
};

export default async function NewDocumentPage({ params }: Props) {
  const { templateId } = await params;
  const template = await getTemplateById(templateId);

  if (!template) notFound();

  const fields = await listTemplateFields(template.id);

  return (
    <PageContainer width="form">
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

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          Crear escritura
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Machote: {template.name}
        </p>
      </div>

      {fields.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-8 text-center">
          <p className="text-sm text-slate-600 mb-4">
            Este machote no tiene campos definidos. Configura sus campos antes
            de crear una escritura.
          </p>
          <Link
            href={`/dashboard/templates/${template.id}`}
            className="inline-flex items-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
          >
            Configurar machote
          </Link>
        </div>
      ) : (
        <DocumentFillForm
          templateId={template.id}
          fields={fields}
          content={extractContent(template)}
          cancelHref="/dashboard/documents"
        />
      )}
    </PageContainer>
  );
}
