import { notFound } from "next/navigation";
import Link from "next/link";
import { extractContent, getTemplateById, listTemplateFields } from "../queries";
import { TemplateForm } from "../_components/TemplateForm";
import { TemplateFieldsSection } from "../_components/TemplateFieldsSection";
import { TemplateVariablesInspector } from "../_components/TemplateVariablesInspector";
import {
  extractTemplateVariables,
  findMissingTemplateFields,
  findUnusedTemplateFields,
} from "@/lib/templates/variables";

export const metadata = {
  title: "Machote — LexCR",
};

// ------------------------------------------------------------------ status badge (server-side)

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  active: "Activo",
  archived: "Archivado",
};

// ------------------------------------------------------------------ page

type Props = {
  params: Promise<{ id: string }>;
};

export default async function TemplateDetailPage({ params }: Props) {
  const { id } = await params;
  const template = await getTemplateById(id);

  if (!template) notFound();

  const fields = await listTemplateFields(template.id);

  const variables = extractTemplateVariables(extractContent(template));
  const definedFieldKeys = fields.map((field) => field.field_key);
  const missingFields = findMissingTemplateFields(variables, definedFieldKeys);
  const unusedFields = findUnusedTemplateFields(variables, definedFieldKeys);

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
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

      {/* Template header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold text-slate-900">
            {template.name}
          </h1>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              template.status === "active"
                ? "bg-teal-50 text-teal-700"
                : template.status === "archived"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {STATUS_LABEL[template.status] ?? template.status}
          </span>
        </div>
        {template.description && (
          <p className="mt-1 text-sm text-slate-500">{template.description}</p>
        )}
      </div>

      <TemplateForm mode="edit" template={template} />

      <TemplateFieldsSection templateId={template.id} fields={fields} />

      <TemplateVariablesInspector
        variables={variables}
        missingFields={missingFields}
        unusedFields={unusedFields}
      />
    </div>
  );
}
