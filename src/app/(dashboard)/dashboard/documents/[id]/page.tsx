import { notFound } from "next/navigation";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  getDocumentById,
  getNotarialMetadata,
  listDocumentActivity,
} from "@/features/documents/server";
import { getTemplateById, listTemplateFields } from "../../templates/queries";
import { listClients } from "../../clients/queries";
import { buildFillableFields } from "@/lib/templates/fillable-fields";
import { resolveTemplateContent } from "@/lib/editor/content";
import { applyVariableLabels } from "@/lib/editor/variables";
import {
  documentStatusBadgeClass,
  documentStatusLabel,
} from "@/features/documents";
import { listReceivablesByDocument } from "@/features/receivables/server";
import {
  DocumentActivity,
  DocumentComposer,
  NotarialMetadataSection,
} from "@/features/documents";
import { ReceivableMiniList } from "@/features/receivables";

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
  const activity = await listDocumentActivity(document.id);
  const notarialMetadata = await getNotarialMetadata(document.id);
  const receivables = await listReceivablesByDocument(document.id);

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
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${documentStatusBadgeClass(document.status)}`}
        >
          {documentStatusLabel(document.status)}
        </span>
      </div>
      <p className="-mt-4 mb-6 text-sm text-slate-500">
        Cliente: {document.clients?.full_name ?? "Sin cliente"}
      </p>

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
        <DocumentComposerLoader
          templateId={template.id}
          templateName={template.name}
          contentJson={template.content_json}
          document={document}
          savedJustNow={saved === "1"}
        />
      )}

      <NotarialMetadataSection
        documentId={document.id}
        metadata={notarialMetadata}
        readOnly={document.status === "final"}
      />

      {/* Cuentas por cobrar vinculadas a esta escritura */}
      <section aria-label="Cuentas por cobrar de la escritura" className="mt-8">
        <ReceivableMiniList
          receivables={receivables}
          newHref={`/dashboard/receivables/new?client=${document.client_id ?? ""}&document=${document.id}`}
          emptyText="Esta escritura todavía no tiene cuentas por cobrar."
        />
      </section>

      {/* key = updated_at: al cambiar la escritura (guardar, cambio de estado)
          la sección se remonta con la actividad recién revalidada. */}
      <DocumentActivity
        key={document.updated_at}
        documentId={document.id}
        initialItems={activity.items}
        initialHasMore={activity.hasMore}
        initialNextOffset={activity.nextOffset}
      />
    </PageContainer>
  );
}

// Carga de campos, clientes y documento etiquetado para el compositor.
async function DocumentComposerLoader({
  templateId,
  templateName,
  contentJson,
  document,
  savedJustNow,
}: {
  templateId: string;
  templateName: string;
  contentJson: unknown;
  document: NonNullable<Awaited<ReturnType<typeof getDocumentById>>>;
  savedJustNow: boolean;
}) {
  const { document: templateDocument, templateText } =
    resolveTemplateContent(contentJson);
  const fields = buildFillableFields(
    await listTemplateFields(templateId),
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
