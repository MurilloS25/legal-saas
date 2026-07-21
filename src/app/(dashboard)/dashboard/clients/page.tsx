import { ClientsWorkspace } from "@/features/clients";
import { listClients } from "@/features/clients/server";

export const metadata = {
  title: "Clientes — LexCR",
};

export default async function ClientsPage() {
  const clients = await listClients();
  return <ClientsWorkspace clients={clients} />;
}
