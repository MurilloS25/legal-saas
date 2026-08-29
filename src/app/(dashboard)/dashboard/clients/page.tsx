import { redirect } from "next/navigation";
import {
  ClientLifecycleToast,
  ClientsWorkspace,
  clientsQueryToParams,
  parseClientsQuery,
  CLIENTS_PAGE_SIZE,
  type ClientLifecycleEvent,
  type RawClientsQuery,
} from "@/features/clients";
import { listClientsPage } from "@/features/clients/server";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";

export const metadata = {
  title: "Clientes — LexCR",
};

type Props = {
  searchParams: Promise<RawClientsQuery & { event?: string }>;
};

export default async function ClientsPage({ searchParams }: Props) {
  const { role } = await requireWorkspace();
  const rawSearchParams = await searchParams;
  const query = parseClientsQuery(rawSearchParams);
  const page = await listClientsPage(query);
  const lifecycleEvent: ClientLifecycleEvent | undefined =
    rawSearchParams.event === "created" || rawSearchParams.event === "updated"
      ? rawSearchParams.event
      : undefined;

  const pageHref = (targetPage: number) => {
    const params = clientsQueryToParams({ page: targetPage });
    const qs = new URLSearchParams(params).toString();
    return qs ? `/dashboard/clients?${qs}` : "/dashboard/clients";
  };

  if (page.total > 0 && query.page > page.pageCount) {
    redirect(pageHref(page.pageCount));
  }

  return (
    <>
      <ClientLifecycleToast event={lifecycleEvent} />
      <ClientsWorkspace
        clients={page.rows}
        page={query.page}
        pageCount={page.pageCount}
        total={page.total}
        pageSize={CLIENTS_PAGE_SIZE}
        pageHref={pageHref}
        canWrite={hasPermission(role, "clients.write")}
        role={role}
        initialSelection={null}
      />
    </>
  );
}
