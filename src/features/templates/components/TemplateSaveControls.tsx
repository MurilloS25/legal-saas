"use client";

type Props = {
  dirty: boolean;
  pending: boolean;
  saved: boolean;
  isEdit: boolean;
};

export function TemplateSaveControls({ dirty, pending, saved, isEdit }: Props) {
  const statusText = pending
    ? "Guardando…"
    : dirty
      ? "Cambios sin guardar"
      : saved || isEdit
        ? "Guardado"
        : "Sin guardar";

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
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear machote"}
      </button>
    </div>
  );
}
