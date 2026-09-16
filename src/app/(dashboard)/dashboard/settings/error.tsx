"use client";

import { useEffect } from "react";

export default function SettingsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[settings] route render failed", error.digest ?? "unknown");
  }, [error]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="rounded-xl border border-red-200 bg-white px-6 py-10 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">
          No fue posible cargar la configuración
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          No se habilitó ningún formulario con datos incompletos. Intenta
          cargar la información nuevamente.
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-accent-600 focus:ring-offset-2"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
