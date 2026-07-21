import { notFound } from "next/navigation";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { getTemplateById, listTemplateFields } from "@/features/templates/server";
import { listClients } from "@/features/clients/server";
import { buildFillableFields } from "@/features/templates";
import { resolveTemplateContent } from "@/lib/editor/content";
import { applyVariableLabels } from "@/lib/editor/variables";
import { DocumentComposer } from "@/features/documents";
import {
  toVariableAutofillSource,
  toVariableOutputTransform,
} from "@/features/templates/model/variable-autofill";

export const metadata = {
  title: "Crear escritura — LexCR",
};

type Props = {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ client?: string }>;
};

export default async function NewDocumentPage({ params, searchParams }: Props) {
  const { templateId } = await params;
  const { client: clientParam } = await searchParams;
  const template = await getTemplateById(templateId);

  if (!template) notFound();

  const { document, templateText } = resolveTemplateContent(
    template.content_json,
  );
  const templateFields = await listTemplateFields(template.id);
  const fields = buildFillableFields(
    templateFields.map((field) => ({
      ...field,
      autofill_source: toVariableAutofillSource(field.autofill_source),
      output_transform: toVariableOutputTransform(field.output_transform),
    })),
    templateText,
  );
  const labeledDocument = applyVariableLabels(
    document,
    Object.fromEntries(fields.map((field) => [field.field_key, field.label])),
  );

  // Solo clientes propios; un `client` preseleccionado ajeno o inexistente
  // simplemente se ignora (no aparece en la lista → initialClientId null).
  const clients = await listClients();
  const clientOptions = clients.map((client) => ({
    id: client.id,
    full_name: client.full_name,
    identification_number: client.identification_number,
    exact_address: client.exact_address,
  }));
  const initialClientId =
    clientParam && clientOptions.some((c) => c.id === clientParam)
      ? clientParam
      : null;

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
          Completa los datos en el panel; el documento se actualiza al
          instante.
        </p>
      </div>

      {fields.some((field) => field.derived) && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Algunas variables del machote no tienen un campo configurado y se
          muestran con su clave. Puedes llenarlas igual, o{" "}
          <Link
            href={`/dashboard/templates/${template.id}`}
            className="font-medium text-accent-700 underline hover:text-accent-800"
          >
            configurar el machote
          </Link>{" "}
          para darles etiqueta y validación.
        </div>
      )}

      <DocumentComposer
        mode="create"
        templateId={template.id}
        templateName={template.name}
        defaultTitle={`${template.name} — Borrador`}
        document={labeledDocument}
        fields={fields}
        clients={clientOptions}
        initialClientId={initialClientId}
      />
    </PageContainer>
  );
}
