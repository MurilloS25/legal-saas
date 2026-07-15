import { PageContainer } from "@/components/layout/PageContainer";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTemplateById, listTemplateFields } from "../queries";
import { TemplateWorkspace } from "../_components/TemplateWorkspace";
import { resolveTemplateContent } from "@/lib/editor/content";
import { applyVariableLabels } from "@/lib/editor/variables";

export const metadata = {
  title: "Machote — LexCR",
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

export default async function TemplateDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { created } = await searchParams;
  const template = await getTemplateById(id);

  if (!template) notFound();

  const fields = await listTemplateFields(template.id);
  // Contenido estructurado si existe; machotes legacy se convierten al
  // cargar (sin tocar el registro hasta que el usuario guarde). Las
  // etiquetas configuradas se aplican a las variables convertidas para que
  // las fichas del editor muestren nombres amigables.
  const { document } = resolveTemplateContent(template.content_json);
  const labeledDocument = applyVariableLabels(
    document,
    Object.fromEntries(fields.map((field) => [field.field_key, field.label])),
  );

  return (
    <PageContainer>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/dashboard/templates"
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
          Machotes
        </Link>
      </nav>

      {/* Encabezado */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {template.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Edita el contenido, las variables y la configuración del machote.
          </p>
        </div>

        {/* Acceso rápido secundario: el flujo principal vive en Escrituras. */}
        <Link
          href={`/dashboard/documents/new/${template.id}`}
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors shrink-0"
        >
          Crear escritura
        </Link>
      </div>

      <TemplateWorkspace
        mode="edit"
        template={{
          id: template.id,
          name: template.name,
          description: template.description,
          status: template.status,
          updated_at: template.updated_at,
        }}
        createdJustNow={created === "1"}
        initialDocument={labeledDocument}
        initialVariables={fields.map((field) => ({
          field_key: field.field_key,
          label: field.label,
          required: field.required,
        }))}
      />
    </PageContainer>
  );
}
