"use client";

/**
 * Dock flotante de guardado del workspace de Escrituras — cuarto
 * refinamiento. Antes vivía dentro del panel "Completar" (con `position:
 * sticky`, así que solo era visible ahí y desaparecía al hacer scroll más
 * allá de su propio contenedor). Ahora es `position: fixed` respecto al
 * viewport — visible en todo momento mientras la Escritura sea editable,
 * sin importar el scroll ni el paso activo del stepper (Completar/Cobro/
 * Índice) — un solo montaje, hecho por `DocumentComposer` como hermano de
 * los tres paneles, no dentro de ninguno.
 *
 * El botón "Guardar" sigue enviando el `<form>` de Completar aunque ya no
 * sea su descendiente DOM — se enlaza vía el atributo HTML `form={formId}`
 * (estándar, sin JS adicional), la misma solución que usaría cualquier
 * botón fuera de un `<form>` que deba enviarlo.
 *
 * Respeta el ancho de contenido del workspace (`max-w-screen-2xl` +
 * `mx-auto` + el mismo padding lateral que `PageContainer`) en vez de
 * pegarse al borde físico del viewport — en un monitor ultrawide se
 * siente asociado al workspace, no a la pantalla. Se posiciona más
 * arriba que el toast (`ToastProvider`, también `bottom-4`) para que
 * ambos —dock y "Escritura guardada."— puedan estar visibles a la vez sin
 * superponerse.
 *
 * Un spacer invisible (mismo componente, en el flujo normal) reserva el
 * espacio que el dock fijo ya no reserva por sí solo, para que nunca tape
 * el contenido final de cualquiera de los tres paneles.
 *
 * Estados compactos y de altura estable: "Sin guardar"/"Guardando…"/
 * "Guardado"/"Error al guardar" son todos una sola línea corta — ya no
 * existe la explicación permanente de por qué Finalizar está deshabilitado
 * (eso ahora es un `title` accesible en el propio botón, ver
 * `DocumentStatusControls`), que antes ensanchaba y alargaba el control
 * solo en el estado dirty.
 *
 * `actions` integra Finalizar/Volver a borrador (`DocumentStatusControls`)
 * en este mismo dock cuando la Escritura es editable — ambas son acciones
 * del documento en edición y deben sentirse relacionadas.
 *
 * ADVERTENCIA — no agregar `backdrop-blur`/`filter`/`transform` al panel
 * del dock (el div con `bg-white ... shadow-md`): cualquiera de esas
 * propiedades convierte a ese div en el "containing block" de sus
 * descendientes `position: fixed`, así que el `ConfirmDialog` que abre
 * "Finalizar escritura" (dentro de `actions`) dejaría de centrarse en el
 * viewport y quedaría atrapado dentro del propio dock — ya pasó una vez
 * con `backdrop-blur-sm` (el botón "Cancelar" terminaba fuera de la
 * pantalla, inalcanzable).
 */

import { useId } from "react";

type Props = {
  dirty: boolean;
  pending: boolean;
  saved: boolean;
  isEdit: boolean;
  /** documents.edit / escritura no finalizada — sin esto no se muestra. */
  canWrite: boolean;
  /** Mensaje de error del guardado más reciente — no descarta `dirty`: el
   * usuario nunca pierde sus cambios locales por un guardado fallido.
   * Se expone como `title` (hover) y texto accesible, no como segunda
   * línea visible permanente, para mantener el dock de altura estable. */
  errorMessage?: string;
  onSaveClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Acciones de lifecycle relacionadas (Finalizar/Volver a borrador),
   * mostradas junto a Guardar — omitido en modo creación (sin documentId). */
  actions?: React.ReactNode;
  /** id del `<form>` de Completar a enviar — el botón vive fuera de su
   * árbol DOM (dock fijo, montado una sola vez, fuera de los paneles). */
  formId: string;
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
  formId,
}: Props) {
  const errorDescId = useId();

  if (!canWrite) return null;

  const statusText = pending
    ? "Guardando…"
    : errorMessage
      ? "Error al guardar"
      : dirty
        ? "Sin guardar"
        : saved || isEdit
          ? "Guardado"
          : "Sin guardar";

  const label = pending ? "Guardando…" : !isEdit ? "Crear escritura" : "Guardar";

  return (
    <>
      {/* Reserva en el flujo normal el espacio que el dock (fixed, más
          abajo) ya no ocupa por sí solo — evita que tape el final de
          cualquiera de los tres paneles al hacer scroll hasta el fondo. */}
      <div aria-hidden="true" className="h-36" />
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30">
        <div className="pointer-events-none mx-auto flex w-full max-w-screen-2xl justify-end px-4 sm:px-6 lg:px-10">
          <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-md">
            <p
              role="status"
              title={errorMessage}
              aria-describedby={errorMessage ? errorDescId : undefined}
              className={`text-xs whitespace-nowrap ${
                errorMessage
                  ? "text-red-700 font-medium"
                  : dirty && !pending
                    ? "text-amber-700 font-medium"
                    : "text-slate-500"
              }`}
            >
              {statusText}
            </p>
            {/* Fuera del `<p>` a propósito: su propio textContent debe
                seguir siendo exactamente `statusText` (nada anexado), para
                que un locator/aserción por texto exacto sobre el estado
                corto no se rompa cuando además hay un error detallado. */}
            {errorMessage && (
              <span id={errorDescId} className="sr-only">
                {errorMessage}
              </span>
            )}
            <button
              type="submit"
              form={formId}
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
      </div>
    </>
  );
}
