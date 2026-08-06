import { PageContainer } from "@/components/layout/PageContainer";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTemplateById, listTemplateFields } from "@/features/templates/server";
import { TemplateWorkspace } from "@/features/templates";
import type { TemplateWorkspaceSection } from "@/features/templates";
import { getTemplateIndexConfiguration } from "@/features/notarial-index/server";
import { resolveTemplateContent } from "@/lib/editor/content";
import { applyVariableLabels } from "@/lib/editor/variables";
import { extractStructuredOutputOptionBlocks } from "@/lib/editor/option-blocks";
import {
  toVariableAutofillSource,
  toVariableOutputTransform,
} from "@/features/templates/model/variable-autofill";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";

export const metadata = {
  title: "Machote — LexCR",
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; section?: string }>;
};

function resolveInitialSection(raw: string | undefined): TemplateWorkspaceSection {
  return raw === "variables" || raw === "notarial" ? raw : "document";
}

export default async function TemplateDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { created, section } = await searchParams;
  const { role } = await requireWorkspace();
  const canWrite = hasPermission(role, "templates.write");
  const canCreateDocuments = hasPermission(role, "documents.create");
  const template = await getTemplateById(id);

  if (!template) notFound();

  const [fields, indexConfiguration] = await Promise.all([
    listTemplateFields(template.id),
    getTemplateIndexConfiguration(template.id),
  ]);
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
        initialSection={resolveInitialSection(section)}
        initialDocument={labeledDocument}
        initialVariables={fields.map((field) => ({
          field_key: field.field_key,
          label: field.label,
          required: field.required,
          autofill_source: toVariableAutofillSource(field.autofill_source),
          output_transform: toVariableOutputTransform(field.output_transform),
        }))}
        indexConfiguration={indexConfiguration}
        indexFields={fields.map((field) => ({
          id: field.id,
          fieldKey: field.field_key,
          label: field.label,
        }))}
        indexOptionBlocks={extractStructuredOutputOptionBlocks(labeledDocument)}
        canWrite={canWrite}
        headerActions={
          !canCreateDocuments ? undefined : template.status === "active" ? (
            <Link
              href={`/dashboard/documents/new/${template.id}`}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors shrink-0"
            >
              Crear escritura
            </Link>
          ) : (
            <span
              className="text-xs text-slate-500 shrink-0 max-w-[220px] text-right"
              title="Activa este machote para poder crear escrituras a partir de él."
            >
              Activa este machote para crear escrituras
            </span>
          )
        }
      />
    </PageContainer>
  );
}
