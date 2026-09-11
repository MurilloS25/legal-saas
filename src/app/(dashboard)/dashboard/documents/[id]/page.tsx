import { notFound } from "next/navigation";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  getDocumentById,
  listDocumentActivity,
} from "@/features/documents/server";
import {
  getLatestNotarialConfirmationActorName,
  getNotarialMetadata,
  getNotarialMetadataReviewRequired,
  getNotarialMetadataSuggestions,
  getTemplateIndexConfiguration,
} from "@/features/notarial-index/server";
import { getTemplateById, listTemplateFields } from "@/features/templates/server";
import { listClients } from "@/features/clients/server";
import { resolveDocumentTemplateSnapshot } from "@/features/documents/model/document-template-snapshot";
import { applyVariableLabels } from "@/lib/editor/variables";
import { listReceivablesByDocument } from "@/features/receivables/server";
import {
  appendReturnTo,
  buildDocumentReceivablesReturnTo,
} from "@/lib/navigation/context-return";
import {
  DocumentComposer,
  DocumentLifecycleToast,
  type DocumentLifecycleEvent,
  type DocumentWorkspaceSection,
} from "@/features/documents";
import {
  NotarialMetadataSection,
  generateConfiguredPartiesPreview,
  resolveNotarialMetadataPrefill,
} from "@/features/notarial-index";
import { ReceivableMiniList } from "@/features/receivables";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";

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
  const { role } = await requireWorkspace();
  const canEdit = hasPermission(role, "documents.edit");
  const canFinalize = hasPermission(role, "documents.finalize");
  const canDuplicate = hasPermission(role, "documents.create");
  const canManageReceivables = hasPermission(role, "receivables.manage");
  // Confirmar/corregir datos del Índice es la misma clase de decisión de
  // confianza que ya gobierna exportar el Índice a Word.
  const canConfirmNotarial = hasPermission(role, "notarial_index.generate");

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
  const resolvedTemplateContent = resolveDocumentTemplateSnapshot(
    document.template_snapshot,
    document.rendered_content,
  );
  const notarialPrefill = resolveNotarialMetadataPrefill({
    metadata: notarialMetadata,
    configuration: indexConfiguration,
    availableFields: templateFields.map((field) => ({
      id: field.id,
      fieldKey: field.field_key,
    })),
    fieldValues: document.field_values,
    templateDocument: resolvedTemplateContent.document,
    optionSelections: document.option_selections,
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
  const notarialConfirmedByName = notarialMetadata?.notarial_confirmed_at
    ? await getLatestNotarialConfirmationActorName(document.id)
    : null;
  const notarialUnlocked = document.status === "final";
  const initialSection: DocumentWorkspaceSection =
    requestedSection === "cobro"
      ? requestedSection
      : requestedSection === "notarial" && notarialUnlocked
        ? "notarial"
        // "revisar" y "finalizar" ya no son pasos propios — un enlace
        // viejo con cualquiera de esos valores aterriza en "completar"
        // (ahí vive ahora la revisión del documento y Finalizar).
        : "completar";

  const receivablesNewHref = canManageReceivables
    ? appendReturnTo(
        `/dashboard/receivables/new?client=${document.client_id ?? ""}&document=${document.id}`,
        buildDocumentReceivablesReturnTo(document.id),
      )
    : undefined;

  const lifecycleEvent: DocumentLifecycleEvent | undefined =
    lifecycle === "finalized" || lifecycle === "reopened" || lifecycle === "duplicated"
      ? lifecycle
      : undefined;

  return (
    <PageContainer>
      <DocumentLifecycleToast
        lifecycle={lifecycleEvent}
        includeInNotarialIndex={document.include_in_notarial_index}
      />

      {!template ? (
        // Caso raro: el machote de la Escritura ya no existe. Se conserva
        // el fallback simple de siempre (sin stepper — no hay documento que
        // editar/revisar), pero Cobro e Índice siguen siendo alcanzables
        // como antes, con navegación simple en vez del stepper completo.
        <NoTemplateFallback
          document={document}
          canEdit={canEdit}
          canManageReceivables={canManageReceivables}
          receivables={receivables}
          receivablesNewHref={receivablesNewHref}
          notarialMetadata={notarialMetadata}
          notarialPrefill={notarialPrefill}
          notarialReviewRequired={notarialReviewRequired}
          indexConfiguration={indexConfiguration}
          generatedPartiesPreview={generatedPartiesPreview}
          requestedSection={requestedSection}
          canConfirmNotarial={canConfirmNotarial}
          notarialConfirmedByName={notarialConfirmedByName}
        />
      ) : (
        <DocumentComposerLoader
          templateName={template.name}
          templateSnapshot={resolvedTemplateContent}
          document={document}
          savedJustNow={saved === "1"}
          canEdit={canEdit}
          canFinalize={canFinalize}
          initialSection={initialSection}
          activity={activity}
          canDuplicate={canDuplicate}
          receivables={receivables}
          canManageReceivables={canManageReceivables}
          notarialMetadata={notarialMetadata}
          notarialPrefill={notarialPrefill}
          canResetParties={indexConfiguration?.isComplete === true}
          actNamePreview={template?.name ?? null}
          generatedPartiesPreview={generatedPartiesPreview}
          reviewRequired={notarialReviewRequired}
          canConfirmNotarial={canConfirmNotarial}
          notarialConfirmedByName={notarialConfirmedByName}
        />
      )}
    </PageContainer>
  );
}

// Carga de campos, clientes y documento etiquetado para el compositor.
async function DocumentComposerLoader({
  templateName,
  templateSnapshot,
  document,
  savedJustNow,
  canEdit,
  canFinalize,
  initialSection,
  activity,
  canDuplicate,
  receivables,
  canManageReceivables,
  notarialMetadata,
  notarialPrefill,
  canResetParties,
  actNamePreview,
  generatedPartiesPreview,
  reviewRequired,
  canConfirmNotarial,
  notarialConfirmedByName,
}: {
  templateName: string;
  templateSnapshot: ReturnType<typeof resolveDocumentTemplateSnapshot>;
  document: NonNullable<Awaited<ReturnType<typeof getDocumentById>>>;
  savedJustNow: boolean;
  canEdit: boolean;
  canFinalize: boolean;
  initialSection: DocumentWorkspaceSection;
  activity: Awaited<ReturnType<typeof listDocumentActivity>>;
  canDuplicate: boolean;
  receivables: Awaited<ReturnType<typeof listReceivablesByDocument>>;
  canManageReceivables: boolean;
  notarialMetadata: Awaited<ReturnType<typeof getNotarialMetadata>>;
  notarialPrefill: ReturnType<typeof resolveNotarialMetadataPrefill>;
  canResetParties: boolean;
  actNamePreview: string | null;
  generatedPartiesPreview: string | null;
  reviewRequired: boolean;
  canConfirmNotarial: boolean;
  notarialConfirmedByName: string | null;
}) {
  const { document: templateDocument, fields } = templateSnapshot;
  const labeledDocument = applyVariableLabels(
    templateDocument,
    Object.fromEntries(fields.map((field) => [field.field_key, field.label])),
  );

  const clients = await listClients();
  const clientOptions = clients.map((client) => ({
    id: client.id,
    full_name: client.full_name,
    identification_number: client.identification_number,
    exact_address: client.exact_address,
  }));

  return (
    <DocumentComposer
      mode="edit"
      draft={document}
      savedJustNow={savedJustNow}
      canEdit={canEdit}
      canFinalize={canFinalize}
      templateName={templateName}
      document={labeledDocument}
      fields={fields}
      legacyTemplateSnapshot={templateSnapshot.legacy}
      clients={clientOptions}
      initialClientId={document.client_id}
      initialSection={initialSection}
      activity={activity}
      canDuplicate={canDuplicate}
      receivables={receivables}
      canManageReceivables={canManageReceivables}
      notarialMetadata={notarialMetadata}
      notarialPrefill={notarialPrefill}
      canResetParties={canResetParties}
      actNamePreview={actNamePreview}
      generatedPartiesPreview={generatedPartiesPreview}
      reviewRequired={reviewRequired}
      canConfirmNotarial={canConfirmNotarial}
      notarialConfirmedByName={notarialConfirmedByName}
    />
  );
}

// ------------------------------------------------------------------ fallback sin machote

/**
 * Caso raro: el machote referenciado por la Escritura ya no existe. No hay
 * documento que editar/revisar, así que se mantiene el fallback de texto
 * simple de siempre — pero Cobro e Índice (si está finalizada) siguen
 * siendo alcanzables, con una navegación simple en vez del stepper
 * completo (que depende de tener un documento real que mostrar).
 */
function NoTemplateFallback({
  document,
  canEdit,
  canManageReceivables,
  receivables,
  receivablesNewHref,
  notarialMetadata,
  notarialPrefill,
  notarialReviewRequired,
  indexConfiguration,
  generatedPartiesPreview,
  requestedSection,
  canConfirmNotarial,
  notarialConfirmedByName,
}: {
  document: NonNullable<Awaited<ReturnType<typeof getDocumentById>>>;
  canEdit: boolean;
  canManageReceivables: boolean;
  receivables: Awaited<ReturnType<typeof listReceivablesByDocument>>;
  receivablesNewHref?: string;
  notarialMetadata: Awaited<ReturnType<typeof getNotarialMetadata>>;
  notarialPrefill: ReturnType<typeof resolveNotarialMetadataPrefill>;
  notarialReviewRequired: boolean;
  indexConfiguration: Awaited<ReturnType<typeof getTemplateIndexConfiguration>>;
  generatedPartiesPreview: string | null;
  requestedSection?: string;
  canConfirmNotarial: boolean;
  notarialConfirmedByName: string | null;
}) {
  const notarialUnlocked = document.status === "final";
  const section =
    requestedSection === "cobro"
      ? "cobro"
      : requestedSection === "notarial" && notarialUnlocked
        ? "notarial"
        : "document";
  const base = `/dashboard/documents/${document.id}`;

  return (
    <div>
      <Link
        href="/dashboard/documents"
        className="mb-4 inline-flex text-sm font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus:underline"
      >
        ‹ Volver a Escrituras
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">{document.title}</h1>
      <nav aria-label="Secciones de la escritura" className="mt-6 mb-6 border-b border-slate-200">
        <div className="flex gap-1 overflow-x-auto">
          {(
            [
              { id: "document", label: "Documento" },
              { id: "cobro", label: "Cobro" },
              ...(notarialUnlocked ? [{ id: "notarial", label: "Índice" }] : []),
            ] as const
          ).map((tab) => (
            <Link
              key={tab.id}
              href={tab.id === "document" ? base : `${base}?section=${tab.id}`}
              aria-current={section === tab.id ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-500 ${
                section === tab.id
                  ? "border-accent-700 text-accent-800"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>

      {section === "document" && (
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
      )}

      {section === "cobro" && (
        <section aria-label="Cuentas por cobrar de la escritura">
          <ReceivableMiniList
            receivables={receivables}
            newHref={canManageReceivables ? receivablesNewHref : undefined}
            emptyText="Esta escritura todavía no tiene cuentas por cobrar."
          />
        </section>
      )}

      {section === "notarial" && (
        <NotarialMetadataSection
          documentId={document.id}
          metadata={notarialMetadata}
          prefill={notarialPrefill}
          readOnly
          canEdit={canEdit}
          canResetParties={indexConfiguration?.isComplete === true}
          actNamePreview={null}
          generatedPartiesPreview={generatedPartiesPreview}
          reviewRequired={notarialReviewRequired}
          includeInNotarialIndex={document.include_in_notarial_index}
          canChangeInclusion={canConfirmNotarial}
          canConfirm={canConfirmNotarial}
          confirmedByName={notarialConfirmedByName}
        />
      )}
    </div>
  );
}
