import Link from "next/link";
import { listClients } from "./queries";

export const metadata = {
  title: "Clientes — LexCR",
};

export default async function ClientsPage() {
  const clients = await listClients();

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clientes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Datos reutilizables de clientes para tus documentos.
          </p>
        </div>
        <Link
          href="/dashboard/clients/new"
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
        >
          Nuevo cliente
        </Link>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-900 mb-1">
            Aún no tienes clientes registrados
          </p>
          <p className="text-xs text-slate-500 mb-6">
            Agrega tu primer cliente para reutilizar sus datos en los machotes.
          </p>
          <Link
            href="/dashboard/clients/new"
            className="inline-block rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
          >
            Agregar cliente
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <ul role="list" className="divide-y divide-slate-100">
            {clients.map((client) => (
              <li key={client.id}>
                <Link
                  href={`/dashboard/clients/${client.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {client.full_name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {client.identification_number} · {client.occupation}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 ml-4 shrink-0">
                    Ver →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
