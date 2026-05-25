import { notFound } from "next/navigation";
import Link from "next/link";
import { getClientById } from "../queries";
import { ClientForm } from "../_components/ClientForm";
import { deleteClientAction } from "../actions";

export const metadata = {
  title: "Cliente — LexCR",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  const client = await getClientById(id);

  if (!client) notFound();

  const boundDelete = deleteClientAction.bind(null, client.id);

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <Link
          href="/dashboard/clients"
          className="text-xs text-slate-500 hover:text-slate-700 focus:outline-none focus:underline"
        >
          ← Clientes
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 mt-2">
          {client.full_name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {client.identification_number}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-6 mb-6">
        <ClientForm mode="edit" client={client} />
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-5">
        <h2 className="text-sm font-semibold text-red-800 mb-1">
          Zona de riesgo
        </h2>
        <p className="text-xs text-red-700 mb-4">
          Eliminar este cliente es irreversible. Los documentos generados no se
          ven afectados.
        </p>
        <form action={boundDelete}>
          <button
            type="submit"
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            Eliminar cliente
          </button>
        </form>
      </div>
    </div>
  );
}
