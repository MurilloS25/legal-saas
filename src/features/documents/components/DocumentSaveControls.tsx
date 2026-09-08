"use client";

/**
 * Toolbar contextual de guardado del workspace de Escrituras — visible solo
 * dentro del panel "Completar" (el único paso con el `<form>` de contenido
 * editable). Tercer refinamiento: dejó de ser una franja sticky de ancho
 * completo (se sentía como footer, separada del resto del workspace) — es
 * un bloque compacto, ancho según su contenido, alineado a la derecha, que
 * flota sobre el contenido al hacer scroll sin ocupar todo el ancho. Mismo
 * problema pendiente en Machotes (`TemplateSaveControls`) — deliberadamente
 * no compartido con ese componente todavía (ver comentario de módulo en
 * `DocumentComposer.tsx`), pero con una forma ya reutilizable si más
 * adelante se revisan ambos juntos.
 *
 * `actions` integra Finalizar/Volver a borrador (`DocumentStatusControls`)
 * en esta misma toolbar cuando la Escritura es editable — ambas son
 * acciones del documento en edición y deben sentirse relacionadas, sin
 * repetirse en Cobro/Índice (que no reciben este componente en absoluto).
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
    <div className="mt-4 flex justify-end">
      <div className="sticky bottom-4 z-20 flex max-w-full flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 shadow-md backdrop-blur-sm">
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
    </div>
  );
}
