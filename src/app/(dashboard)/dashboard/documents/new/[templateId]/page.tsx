import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";
import { getTemplateById, listTemplateFields } from "@/features/templates/server";
import { listClients } from "@/features/clients/server";
import {
  buildFillableFields,
  templateStatusLabel,
  toVariableAutofillSource,
  toVariableOutputTransform,
} from "@/features/templates/domain";
import { resolveTemplateContent } from "@/lib/editor/content";
import { applyVariableLabels } from "@/lib/editor/variables";
import { DocumentComposer } from "@/features/documents";
import { isResourceId } from "@/lib/validation/resource-id";

export const metadata = {
  title: "Crear escritura — LexCR",
};

type Props = {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ client?: string }>;
};

export default async function NewDocumentPage({ params, searchParams }: Props) {
  const { role } = await requireWorkspace();
  if (!hasPermission(role, "documents.create")) {
    redirect("/dashboard/documents");
  }
  const { templateId } = await params;
  if (!isResourceId(templateId)) notFound();

  const { client: clientParam } = await searchParams;
  const template = await getTemplateById(templateId);

  if (!template) notFound();

  if (template.status !== "active") {
    return (
      <PageContainer>
        <nav aria-label="Breadcrumb" className="mb-6">
          <Link
            href="/dashboard/documents/new"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 focus:outline-none focus:underline"
          >
            Nueva escritura
          </Link>
        </nav>
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-900 mb-1">
            Este machote no está activo
          </p>
          <p className="text-xs text-slate-500 mb-6">
            Su estado actual es &ldquo;{templateStatusLabel(template.status)}&rdquo;. Solo
            se pueden crear escrituras a partir de machotes activos.
          </p>
          <Link
            href="/dashboard/documents/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
          >
            Elegir otro machote
          </Link>
        </div>
      </PageContainer>
    );
  }

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
        templateIncludeInNotarialIndexByDefault={
          template.include_in_notarial_index_by_default
        }
        document={labeledDocument}
        fields={fields}
        clients={clientOptions}
        initialClientId={initialClientId}
        canFinalize={hasPermission(role, "documents.finalize")}
      />
    </PageContainer>
  );
}
