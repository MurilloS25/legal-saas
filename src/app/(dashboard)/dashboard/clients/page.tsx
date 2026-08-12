import { redirect } from "next/navigation";
import {
  ClientsWorkspace,
  clientsQueryToParams,
  parseClientsQuery,
  CLIENTS_PAGE_SIZE,
  type RawClientsQuery,
} from "@/features/clients";
import { listClientsPage } from "@/features/clients/server";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";

export const metadata = {
  title: "Clientes — LexCR",
};

type Props = {
  searchParams: Promise<RawClientsQuery>;
};

export default async function ClientsPage({ searchParams }: Props) {
  const { role } = await requireWorkspace();
  const query = parseClientsQuery(await searchParams);
  const page = await listClientsPage(query);

  const pageHref = (targetPage: number) => {
    const params = clientsQueryToParams({ page: targetPage });
    const qs = new URLSearchParams(params).toString();
    return qs ? `/dashboard/clients?${qs}` : "/dashboard/clients";
  };

  if (page.total > 0 && query.page > page.pageCount) {
    redirect(pageHref(page.pageCount));
  }

  return (
    <ClientsWorkspace
      clients={page.rows}
      page={query.page}
      pageCount={page.pageCount}
      total={page.total}
      pageSize={CLIENTS_PAGE_SIZE}
      pageHref={pageHref}
      canWrite={hasPermission(role, "clients.write")}
    />
  );
}
