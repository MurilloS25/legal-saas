"use client";

type Props = {
  dirty: boolean;
  pending: boolean;
  saved: boolean;
  isEdit: boolean;
  /** templates.write — sin este permiso no se muestra el botón de guardar. */
  canWrite?: boolean;
  /** Mensaje de error del guardado más reciente — se muestra en vez del
   * estado normal, sin descartar `dirty` (el usuario nunca pierde sus
   * cambios locales por un guardado fallido). */
  errorMessage?: string;
  onSaveClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

export function TemplateSaveControls({
  dirty,
  pending,
  saved,
  isEdit,
  canWrite = true,
  errorMessage,
  onSaveClick,
}: Props) {
  const statusText = pending
    ? "Guardando…"
    : errorMessage
      ? "Error al guardar"
      : dirty
        ? "Cambios sin guardar"
        : saved || isEdit
          ? "Guardado"
          : "Sin guardar";

  const label = pending ? "Guardando…" : !isEdit ? "Crear machote" : "Guardar";

  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200/80 bg-slate-50/95 px-4 py-2 shadow-[0_-1px_4px_rgba(15,23,42,0.04)] backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      <div className="text-right leading-tight">
        <p
          role="status"
          className={`text-xs ${
            errorMessage
              ? "text-red-700 font-medium"
              : dirty && !pending
                ? "text-amber-700 font-medium"
                : "text-slate-500"
          }`}
        >
          {canWrite
            ? statusText
            : "Tu rol no permite editar machotes. Lo ves en modo lectura."}
        </p>
        {errorMessage && (
          <p role="alert" className="text-xs text-red-700">
            {errorMessage}
          </p>
        )}
      </div>
      {canWrite && (
        <button
          type="submit"
          disabled={pending || (isEdit && !dirty)}
          onClick={onSaveClick}
          className="rounded-md bg-accent-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {label}
        </button>
      )}
    </div>
  );
}
