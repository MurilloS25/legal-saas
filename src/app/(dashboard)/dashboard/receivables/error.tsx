"use client";

import { useEffect } from "react";

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
      <div className="rounded-xl border border-red-200 bg-white px-6 py-10 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">
          No fue posible cargar las cuentas por cobrar
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Intenta nuevamente. Si el problema continúa, vuelve más tarde.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
