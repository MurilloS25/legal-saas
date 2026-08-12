import { notFound } from "next/navigation";
import { ClientDetail } from "@/features/clients";
import { getClientById } from "@/features/clients/server";
import { listDocumentsByClient } from "@/features/documents/server";
import { listReceivablesByClient } from "@/features/receivables/server";
import { requireWorkspace } from "@/lib/server/auth";

export const metadata = {
  title: "Cliente — LexCR",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ClientDetailPage({ params }: Props) {
  const { role } = await requireWorkspace();
  const { id } = await params;
  const client = await getClientById(id);
  if (!client) notFound();

  const [documents, receivables] = await Promise.all([
    listDocumentsByClient(client.id),
    listReceivablesByClient(client.id),
  ]);

  return (
    <ClientDetail
      client={client}
      documents={documents}
      receivables={receivables}
      role={role}
    />
  );
}
