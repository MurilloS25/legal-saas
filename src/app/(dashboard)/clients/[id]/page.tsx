import { notFound } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { ClientDetail } from "@/features/clients";
import { getClientById } from "@/features/clients/server";
import {
  ClientDocumentsSection,
  CreateClientDocumentLink,
} from "@/features/documents";
import { listDocumentsByClient } from "@/features/documents/server";
import {
  ClientReceivablesSection,
  parseReceivablesQuery,
} from "@/features/receivables";
import {
  getReceivablesSummary,
  listReceivablesByClient,
} from "@/features/receivables/server";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";
import { isResourceId } from "@/lib/validation/resource-id";

export const metadata = {
  title: "Cliente — LexCR",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ClientDetailPage({ params }: Props) {
  const { role } = await requireWorkspace();
  const { id } = await params;
  if (!isResourceId(id)) notFound();

  const client = await getClientById(id);
  if (!client) notFound();

  const [documents, receivables, receivableTotals] = await Promise.all([
    listDocumentsByClient(client.id),
    listReceivablesByClient(client.id),
    getReceivablesSummary(parseReceivablesQuery({ client: client.id })),
  ]);

  return (
    <PageContainer>
      <ClientDetail
        client={client}
        role={role}
        headerAction={
          hasPermission(role, "documents.create") ? (
            <CreateClientDocumentLink clientId={client.id} />
          ) : undefined
        }
      />
      {/* Dos resúmenes lado a lado en pantallas anchas; apilados en angostas. */}
      <div className="mt-8 grid gap-8 2xl:grid-cols-2">
        <ClientDocumentsSection
          documents={documents.rows}
          total={documents.total}
          clientId={client.id}
        />
        <ClientReceivablesSection
          clientId={client.id}
          receivables={receivables}
          totals={receivableTotals}
          canManage={hasPermission(role, "receivables.manage")}
        />
      </div>
    </PageContainer>
  );
}
