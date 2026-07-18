"use client";

type Props = {
  dirty: boolean;
  pending: boolean;
  onDiscard: () => void;
};

export function SettingsActionsBar({ dirty, pending, onDiscard }: Props) {
  const statusText = pending
    ? "Guardando…"
    : dirty
      ? "Cambios sin guardar"
      : "Guardado";

  return (
    <div className="mt-8 flex flex-wrap items-center justify-end gap-4 border-t border-slate-200 pt-6">
      <p
        role="status"
        className={`text-sm ${
          dirty && !pending ? "text-amber-700 font-medium" : "text-slate-500"
        }`}
      >
        {statusText}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDiscard}
          disabled={!dirty || pending}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Descartar
        </button>
        <button
          type="submit"
          disabled={!dirty || pending}
          className="rounded-lg bg-accent-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
