import { notFound } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  getDocumentById,
  listDocumentActivity,
} from "@/features/documents/server";
import {
  getNotarialMetadata,
  getNotarialMetadataReviewRequired,
  getNotarialMetadataSuggestions,
  getTemplateIndexConfiguration,
} from "@/features/notarial-index/server";
import { getTemplateById, listTemplateFields } from "@/features/templates/server";
import { listClients } from "@/features/clients/server";
import { buildFillableFields } from "@/features/templates";
import { resolveTemplateContent } from "@/lib/editor/content";
import { applyVariableLabels } from "@/lib/editor/variables";
import { listReceivablesByDocument } from "@/features/receivables/server";
import {
  DocumentComposer,
  DocumentWorkspaceHeader,
  type DocumentWorkspaceSection,
} from "@/features/documents";
import {
  NotarialMetadataSection,
  generateConfiguredPartiesPreview,
  resolveNotarialMetadataPrefill,
} from "@/features/notarial-index";
import { ReceivableMiniList } from "@/features/receivables";

export const metadata = {
  title: "Escritura — LexCR",
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string;
    section?: string;
    lifecycle?: string;
  }>;
};

export default async function DocumentDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { saved, section: requestedSection, lifecycle } = await searchParams;

  // getDocumentById devuelve null tanto para documentos inexistentes como
  // ajenos: el 404 no revela cuál de los dos casos ocurrió.
  const document = await getDocumentById(id);
  if (!document) notFound();

  const [
    template,
    templateFields,
    indexConfiguration,
    activity,
    notarialMetadata,
    notarialSuggestions,
    receivables,
  ] = await Promise.all([
    getTemplateById(document.template_id),
    listTemplateFields(document.template_id),
    getTemplateIndexConfiguration(document.template_id),
    listDocumentActivity(document.id),
    getNotarialMetadata(document.id),
    getNotarialMetadataSuggestions(),
    listReceivablesByDocument(document.id),
  ]);
  const generatedPartiesPreview = generateConfiguredPartiesPreview(
    indexConfiguration,
    templateFields.map((field) => ({
      id: field.id,
      fieldKey: field.field_key,
    })),
    document.field_values,
  );
  const notarialPrefill = resolveNotarialMetadataPrefill({
    metadata: notarialMetadata,
    configuration: indexConfiguration,
    availableFields: templateFields.map((field) => ({
      id: field.id,
      fieldKey: field.field_key,
    })),
    fieldValues: document.field_values,
    templateName: template?.name ?? null,
    generatedParties: generatedPartiesPreview,
    suggestions: notarialSuggestions,
  });
  const notarialReviewRequired = notarialMetadata
    ? await getNotarialMetadataReviewRequired(
        document.id,
        notarialMetadata.updated_at,
      )
    : false;
  const section: DocumentWorkspaceSection =
    requestedSection === "receivables"
      ? "receivables"
      : requestedSection === "notarial" && document.status === "final"
        ? "notarial"
        : "document";

  return (
    <PageContainer>
      <DocumentWorkspaceHeader
        documentId={document.id}
        title={document.title}
        clientName={document.clients?.full_name ?? null}
        status={document.status}
        section={section}
        savedJustNow={saved === "1"}
        activity={activity}
      />

      {(lifecycle === "finalized" || lifecycle === "reopened") && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 text-sm font-medium text-accent-800"
        >
          {lifecycle === "finalized"
            ? "Escritura finalizada correctamente."
            : "Escritura reabierta como borrador."}
        </p>
      )}

      {section === "document" && !template ? (
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
      ) : section === "document" && template ? (
        <DocumentComposerLoader
          templateName={template.name}
          contentJson={template.content_json}
          templateFields={templateFields}
          document={document}
          savedJustNow={saved === "1"}
        />
      ) : null}

      {section === "notarial" && (
        <NotarialMetadataSection
          documentId={document.id}
          metadata={notarialMetadata}
          prefill={notarialPrefill}
          readOnly
          canResetParties={indexConfiguration?.isComplete === true}
          actNamePreview={template?.name ?? null}
          generatedPartiesPreview={generatedPartiesPreview}
          reviewRequired={notarialReviewRequired}
        />
      )}

      {section === "receivables" && (
        <section aria-label="Cuentas por cobrar de la escritura">
        <ReceivableMiniList
          receivables={receivables}
          newHref={`/dashboard/receivables/new?client=${document.client_id ?? ""}&document=${document.id}`}
          emptyText="Esta escritura todavía no tiene cuentas por cobrar."
        />
        </section>
      )}
    </PageContainer>
  );
}

// Carga de campos, clientes y documento etiquetado para el compositor.
async function DocumentComposerLoader({
  templateName,
  contentJson,
  templateFields,
  document,
  savedJustNow,
}: {
  templateName: string;
  contentJson: unknown;
  templateFields: Awaited<ReturnType<typeof listTemplateFields>>;
  document: NonNullable<Awaited<ReturnType<typeof getDocumentById>>>;
  savedJustNow: boolean;
}) {
  const { document: templateDocument, templateText } =
    resolveTemplateContent(contentJson);
  const fields = buildFillableFields(
    templateFields,
    templateText,
  );
  const labeledDocument = applyVariableLabels(
    templateDocument,
    Object.fromEntries(fields.map((field) => [field.field_key, field.label])),
  );

  const clients = await listClients();
  const clientOptions = clients.map((client) => ({
    id: client.id,
    full_name: client.full_name,
  }));

  return (
    <DocumentComposer
      mode="edit"
      draft={document}
      savedJustNow={savedJustNow}
      templateName={templateName}
      document={labeledDocument}
      fields={fields}
      clients={clientOptions}
      initialClientId={document.client_id}
    />
  );
}
