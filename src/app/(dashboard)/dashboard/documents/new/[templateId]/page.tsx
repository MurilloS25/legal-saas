import { notFound } from "next/navigation";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  extractContent,
  getTemplateById,
  listTemplateFields,
} from "../../../templates/queries";
import { buildFillableFields } from "@/lib/templates/fillable-fields";
import { DocumentDraftForm } from "../../_components/DocumentDraftForm";

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

  const content = extractContent(template);
  // Unión de campos configurados y variables del contenido: un machote sin
  // campos configurados ya no bloquea la creación de la escritura.
  const fields = buildFillableFields(await listTemplateFields(template.id), content);

  return (
    <PageContainer>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/dashboard/documents/new"
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
          Nueva escritura
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

      {fields.some((field) => field.derived) && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Algunas variables del machote no tienen un campo configurado y se
          muestran con su clave. Puedes llenarlas igual, o{" "}
          <Link
            href={`/dashboard/templates/${template.id}`}
            className="font-medium text-teal-700 underline hover:text-teal-800"
          >
            configurar el machote
          </Link>{" "}
          para darles etiqueta y validación.
        </div>
      )}

      <DocumentDraftForm
        mode="create"
        templateId={template.id}
        defaultTitle={`${template.name} — Borrador`}
        fields={fields}
        content={content}
      />
    </PageContainer>
  );
}
