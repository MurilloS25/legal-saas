import { notFound } from "next/navigation";
import Link from "next/link";
import { getClientById } from "../queries";
import { ClientForm } from "../_components/ClientForm";
import { deleteClientAction } from "../actions";

export const metadata = {
  title: "Cliente — LexCR",
};

// ------------------------------------------------------------------ avatar helpers (duplicated from list page for SSR independence)

const AVATAR_COLORS = [
  "bg-teal-600",
  "bg-indigo-500",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-600",
  "bg-sky-600",
  "bg-slate-600",
] as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name: string): string {
  const code = name
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

// ------------------------------------------------------------------ page

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  const client = await getClientById(id);

  if (!client) notFound();

  const boundDelete = deleteClientAction.bind(null, client.id);
  const initials = getInitials(client.full_name);
  const avatarColor = getAvatarColor(client.full_name);

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/dashboard/clients"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 focus:outline-none focus:underline"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Clientes
        </Link>
      </nav>

      {/* Client header with avatar */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className={`${avatarColor} flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white select-none`}
          aria-hidden="true"
        >
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {client.full_name}
          </h1>
          <p className="text-sm text-slate-500">{client.identification_number}</p>
        </div>
      </div>

      {/* Edit form */}
      <ClientForm mode="edit" client={client} />

      {/* Danger zone */}
      <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-6 py-5">
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
