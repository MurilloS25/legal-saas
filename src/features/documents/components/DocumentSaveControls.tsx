"use client";

/**
 * Barra de guardado del workspace de Escrituras — sticky, compacta, visible
 * solo dentro del panel "Completar" (el único paso con el `<form>` de
 * contenido editable). Mismo patrón conceptual que
 * `TemplateSaveControls` (Machotes): dirty/guardando/guardado/error +
 * protección contra doble submit — implementado aparte a propósito (no
 * importado desde `features/templates`) para mantener esta iteración
 * acotada solo a Escrituras; ver comentario de módulo en
 * `DocumentComposer.tsx` sobre qué se reutiliza conceptualmente y qué no.
 *
 * `actions` integra Finalizar/Volver a borrador (`DocumentStatusControls`)
 * en esta misma barra cuando la Escritura es editable — ambas son acciones
 * del documento en edición y deben sentirse relacionadas, sin repetirse en
 * Cobro/Índice (que no reciben este componente en absoluto).
 */

type Props = {
  dirty: boolean;
  pending: boolean;
  saved: boolean;
  isEdit: boolean;
  /** documents.edit / escritura no finalizada — sin esto no se muestra. */
  canWrite: boolean;
  /** Mensaje de error del guardado más reciente — no descarta `dirty`: el
   * usuario nunca pierde sus cambios locales por un guardado fallido. */
  errorMessage?: string;
  onSaveClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Acciones de lifecycle relacionadas (Finalizar/Volver a borrador),
   * mostradas junto a Guardar — omitido en modo creación (sin documentId). */
  actions?: React.ReactNode;
};

export function DocumentSaveControls({
  dirty,
  pending,
  saved,
  isEdit,
  canWrite,
  errorMessage,
  onSaveClick,
  actions,
}: Props) {
  if (!canWrite) return null;

  const statusText = pending
    ? "Guardando…"
    : errorMessage
      ? "Error al guardar"
      : dirty
        ? "Cambios sin guardar"
        : saved || isEdit
          ? "Guardado"
          : "Sin guardar";

  const label = pending ? "Guardando…" : !isEdit ? "Crear escritura" : "Guardar";

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
          {statusText}
        </p>
        {errorMessage && (
          <p role="alert" className="text-xs text-red-700">
            {errorMessage}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending || (isEdit && !dirty)}
        onClick={onSaveClick}
        className="rounded-md bg-accent-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {label}
      </button>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 border-l border-slate-200/80 pl-3">
          {actions}
        </div>
      )}
    </div>
  );
}
