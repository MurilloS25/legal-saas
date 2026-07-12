import { PageContainer } from "@/components/layout/PageContainer";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getClientById } from "../queries";
import { ClientForm } from "../_components/ClientForm";

export const metadata = {
  title: "Cliente — LexCR",
};

// ------------------------------------------------------------------ avatar helpers

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

  const initials = getInitials(client.full_name);
  const avatarColor = getAvatarColor(client.full_name);

  return (
    <PageContainer width="form">
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

      {/* Edit form (delete icon lives in the card header) */}
      <ClientForm mode="edit" client={client} />
    </PageContainer>
  );
}
