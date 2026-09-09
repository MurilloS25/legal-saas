"use client";

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
 * Incluye un spacer invisible en el flujo normal que reserva el espacio que
 * el dock (fixed) ya no ocupa por sí solo, para que nunca tape el contenido
 * final de la página.
 *
 * ADVERTENCIA — no agregar `backdrop-blur`/`filter`/`transform` al panel del
 * dock (el div con `bg-white ... shadow-md`): cualquiera de esas
 * propiedades convierte a ese div en el "containing block" de sus
 * descendientes `position: fixed`, así que cualquier diálogo (`ConfirmDialog`,
 * `fixed inset-0`) abierto desde dentro de este dock dejaría de centrarse en
 * el viewport y quedaría atrapado dentro del propio dock.
 */
export function WorkspaceActionDock({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div aria-hidden="true" className="h-36" />
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30">
        <div className="pointer-events-none mx-auto flex w-full max-w-screen-2xl justify-end px-4 sm:px-6 lg:px-10">
          <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-md">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
