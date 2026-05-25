import Link from "next/link";
import { ClientForm } from "../_components/ClientForm";

export const metadata = {
  title: "Nuevo cliente — LexCR",
};

export default function NewClientPage() {
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
          Nuevo cliente
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Completa los datos de la persona física.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-6">
        <ClientForm mode="create" />
      </div>
    </div>
  );
}
