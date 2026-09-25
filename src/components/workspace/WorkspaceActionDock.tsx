"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Dock flotante compartido para la acción principal persistente de un
 * workspace (Escrituras, Machotes) — `position: fixed`, ancho basado en
 * contenido, alineado a la esquina inferior derecha del área de contenido
 * (no del viewport físico). Ver `DocumentSaveControls` (Escrituras) para el
 * refinamiento original que estableció este patrón; este componente extrae
 * solo el contenedor visual, sin ninguna lógica de dominio (dirty, guardado,
 * lifecycle) — cada feature sigue decidiendo su propio contenido y estados.
 *
 * Respeta el ancho de contenido del workspace (`max-w-screen-2xl` +
 * `mx-auto` + el mismo padding lateral que `PageContainer`) en vez de
 * pegarse al borde físico del viewport — en un monitor ultrawide se siente
 * asociado al workspace, no a la pantalla. Se posiciona más arriba que el
 * toast (`ToastProvider`, `bottom-4` / `z-[80]`) para que ambos puedan estar
 * visibles a la vez sin superponerse.
 *
 * Nunca tapa el contenido final de la página: un spacer en el flujo normal
 * reserva exactamente el espacio que ocupa el dock (fixed), medido en vivo
 * con `ResizeObserver` — el dock crece cuando sus acciones pasan a otra
 * línea en pantallas angostas o muestra un error, y un alto fijo dejaba
 * controles inferiores debajo de él. Mientras está montado, además fija
 * `scroll-padding-bottom` en el documento para que el foco por teclado y
 * `scrollIntoView` nunca dejen un control escondido detrás del dock.
 *
 * ADVERTENCIA — no agregar `backdrop-blur`/`filter`/`transform` al panel del
 * dock (el div con `bg-white ... shadow-md`): cualquiera de esas
 * propiedades convierte a ese div en el "containing block" de sus
 * descendientes `position: fixed`, así que cualquier diálogo (`ConfirmDialog`,
 * `fixed inset-0`) abierto desde dentro de este dock dejaría de centrarse en
 * el viewport y quedaría atrapado dentro del propio dock.
 */

/** Distancia del dock al borde inferior del viewport (`bottom-20`). */
const DOCK_BOTTOM_OFFSET_PX = 80;
/** Aire entre el último control de la página y el borde superior del dock. */
const DOCK_CLEARANCE_PX = 16;
/** Reserva inicial (antes de medir): alto típico de una sola línea. */
const DEFAULT_RESERVED_PX = 144;

export function WorkspaceActionDock({ children }: { children: React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [reservedPx, setReservedPx] = useState(DEFAULT_RESERVED_PX);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const update = () =>
      setReservedPx(
        Math.ceil(panel.getBoundingClientRect().height) +
          DOCK_BOTTOM_OFFSET_PX +
          DOCK_CLEARANCE_PX,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollPaddingBottom;
    root.style.scrollPaddingBottom = `${reservedPx}px`;
    return () => {
      root.style.scrollPaddingBottom = previous;
    };
  }, [reservedPx]);

  return (
    <>
      <div aria-hidden="true" style={{ height: reservedPx }} />
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30">
        <div className="pointer-events-none mx-auto flex w-full max-w-screen-2xl justify-end px-4 sm:px-6 lg:px-10">
          <div
            ref={panelRef}
            data-workspace-action-dock=""
            className="pointer-events-auto flex max-w-full flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-md"
          >
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
