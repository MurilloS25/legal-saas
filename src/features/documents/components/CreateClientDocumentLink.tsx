import Link from "next/link";

export function CreateClientDocumentLink({ clientId }: { clientId: string }) {
  return (
    <Link
      href={`/documents/new?client=${clientId}`}
      className="inline-flex items-center gap-2 rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors shrink-0"
    >
      Nueva escritura
    </Link>
  );
}
