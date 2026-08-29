import { notFound } from "next/navigation";
import {
  ClientsWorkspace,
  parseClientsQuery,
  clientsQueryToParams,
  CLIENTS_PAGE_SIZE,
} from "@/features/clients";
import { getClientById, listClientsPage } from "@/features/clients/server";
import { listDocumentsByClient } from "@/features/documents/server";
import { listReceivablesByClient } from "@/features/receivables/server";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";

export const metadata = {
  title: "Cliente — LexCR",
};

type Props = {
  params: Promise<{ id: string }>;
};

// Deep link a un cliente específico: list+detail — la lista aterriza en su
// primera página al lado (no conocemos de antemano en qué página cae este
// cliente sin una consulta adicional), y el detalle ya viene resuelto para
// que el panel se abra sin un segundo viaje al servidor.
export default async function ClientDetailPage({ params }: Props) {
  const { role } = await requireWorkspace();
  const { id } = await params;

  const [client, listPage] = await Promise.all([
    getClientById(id),
    listClientsPage(parseClientsQuery({})),
  ]);
  if (!client) notFound();

  const [documents, receivables] = await Promise.all([
    listDocumentsByClient(client.id),
    listReceivablesByClient(client.id),
  ]);

  const pageHref = (targetPage: number) => {
    const params = clientsQueryToParams({ page: targetPage });
    const qs = new URLSearchParams(params).toString();
    return qs ? `/dashboard/clients?${qs}` : "/dashboard/clients";
  };

  return (
    <ClientsWorkspace
      clients={listPage.rows}
      page={1}
      pageCount={listPage.pageCount}
      total={listPage.total}
      pageSize={CLIENTS_PAGE_SIZE}
      pageHref={pageHref}
      canWrite={hasPermission(role, "clients.write")}
      role={role}
      initialSelection={{ kind: "detail", data: { client, documents, receivables } }}
    />
  );
}
