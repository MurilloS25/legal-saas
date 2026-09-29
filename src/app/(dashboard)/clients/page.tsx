import { redirect } from "next/navigation";
import {
  ClientLifecycleToast,
  ClientsWorkspace,
  clientsQueryToParams,
  parseClientsQuery,
  type ClientLifecycleEvent,
  type RawClientsQuery,
} from "@/features/clients";
import { listClientsPage } from "@/features/clients/server";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";
import { buildPageSizeOptions, type PageSizeOption } from "@/lib/pagination";

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
    const params = clientsQueryToParams({
      page: targetPage,
      pageSize: query.pageSize,
      q: query.q,
    });
    const qs = new URLSearchParams(params).toString();
    return qs ? `/clients?${qs}` : "/clients";
  };

  const pageSizeOptions = buildPageSizeOptions((pageSize: PageSizeOption) => {
    const params = clientsQueryToParams({ page: 1, pageSize, q: query.q });
    const qs = new URLSearchParams(params).toString();
    return qs ? `/clients?${qs}` : "/clients";
  });

  // Buscar o limpiar siempre reinicia a la página 1 y conserva el tamaño de página.
  const searchHref = (q: string) => {
    const params = clientsQueryToParams({ page: 1, pageSize: query.pageSize, q });
    const qs = new URLSearchParams(params).toString();
    return qs ? `/clients?${qs}` : "/clients";
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
        pageSize={query.pageSize}
        q={query.q}
        searchHref={searchHref}
        pageHref={pageHref}
        pageSizeOptions={pageSizeOptions}
        canWrite={hasPermission(role, "clients.write")}
      />
    </>
  );
}
