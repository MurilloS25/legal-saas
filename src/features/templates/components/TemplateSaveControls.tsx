"use client";

type Props = {
  dirty: boolean;
  pending: boolean;
  saved: boolean;
  isEdit: boolean;
  /** templates.write — sin este permiso no se muestra el botón de guardar. */
  canWrite?: boolean;
  /** false en el último paso del flujo (Publicar) — no hay a dónde continuar. */
  hasNextStep?: boolean;
  /** Marca la intención de "avanzar de paso" antes del submit nativo. */
  onSaveClick?: () => void;
};

export function TemplateSaveControls({
  dirty,
  pending,
  saved,
  isEdit,
  canWrite = true,
  hasNextStep = true,
  onSaveClick,
}: Props) {
  const statusText = pending
    ? "Guardando…"
    : dirty
      ? "Cambios sin guardar"
      : saved || isEdit
        ? "Guardado"
        : "Sin guardar";

  const label = pending
    ? "Guardando…"
    : !isEdit
      ? "Crear machote"
      : hasNextStep
        ? "Guardar y continuar"
        : "Guardar cambios";

  return (
    <div className="mt-8 flex flex-wrap items-center justify-end gap-4 border-t border-slate-200 pt-6">
      <p
        role="status"
        className={`text-sm ${
          dirty && !pending ? "text-amber-700 font-medium" : "text-slate-500"
        }`}
      >
        {canWrite
          ? statusText
          : "Tu rol no permite editar machotes. Lo ves en modo lectura."}
      </p>
      {canWrite && (
        <button
          type="submit"
          disabled={pending}
          onClick={onSaveClick}
          className="rounded-lg bg-accent-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {label}
        </button>
      )}
    </div>
  );
}
