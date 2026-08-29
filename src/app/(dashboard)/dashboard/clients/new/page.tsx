import { redirect } from "next/navigation";
import {
  ClientsWorkspace,
  parseClientsQuery,
  clientsQueryToParams,
  CLIENTS_PAGE_SIZE,
} from "@/features/clients";
import { listClientsPage } from "@/features/clients/server";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";

export const metadata = {
  title: "Nuevo cliente — LexCR",
};

// Deep link al formulario de creación: la lista aparece al lado con un
// formulario en blanco ya abierto en el panel de detalle, en vez de una
// página de creación separada — mismo componente que sirve el listado y el
// detalle (ver ClientsWorkspace).
export default async function NewClientPage() {
  const { role } = await requireWorkspace();
  if (!hasPermission(role, "clients.write")) {
    redirect("/dashboard/clients");
  }

  const listPage = await listClientsPage(parseClientsQuery({}));

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
      canWrite
      role={role}
      initialSelection={{ kind: "create" }}
    />
  );
}
