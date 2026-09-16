import { notFound } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { ClientDetail } from "@/features/clients";
import { getClientById } from "@/features/clients/server";
import {
  ClientDocumentsSection,
  CreateClientDocumentLink,
} from "@/features/documents";
import { listDocumentsByClient } from "@/features/documents/server";
import { ClientReceivablesSection } from "@/features/receivables";
import { listReceivablesByClient } from "@/features/receivables/server";
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

  const [documents, receivables] = await Promise.all([
    listDocumentsByClient(client.id),
    listReceivablesByClient(client.id),
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
      <ClientDocumentsSection documents={documents} />
      <ClientReceivablesSection
        clientId={client.id}
        receivables={receivables}
        canManage={hasPermission(role, "receivables.manage")}
      />
    </PageContainer>
  );
}
