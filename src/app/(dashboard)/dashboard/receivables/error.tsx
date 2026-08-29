"use client";

import { useEffect } from "react";
import { AlertIcon } from "@/app/(dashboard)/_components/icons";

export default function ReceivablesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[receivables] route render failed", error.digest ?? "unknown");
  }, [error]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="animate-fade-in rounded-xl border border-red-200 bg-white px-6 py-10 text-center shadow-ink-sm">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertIcon className="size-5" />
        </div>
        <h1 className="text-lg font-semibold text-ink-900">
          No fue posible cargar las cuentas por cobrar
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Intenta nuevamente. Si el problema continúa, vuelve más tarde.
        </p>
        <button
          type="button"
          onClick={reset}
          className="press-feedback mt-6 rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800 focus:outline-none focus:ring-2 focus:ring-accent-600 focus:ring-offset-2 transition-colors"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
