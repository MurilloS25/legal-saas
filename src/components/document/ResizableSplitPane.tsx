"use client";

/**
 * Grilla de dos columnas redimensionable/ocultable para el par
 * editor+vista-previa (Machotes en redacción, Escrituras al completar).
 *
 * Solo resuelve el layout de la división en sí — no decide nada sobre
 * mobile. La visibilidad en pantallas pequeñas sigue siendo responsabilidad
 * exclusiva del llamador (los toggles `TemplateMobileViewToggle`/
 * `DocumentMobileViewToggle` ya existentes), porque ese mecanismo depende
 * de mantener el editor Tiptap montado en todo momento (alternando
 * visibilidad por CSS, nunca desmontando).
 *
 * Importante: `primary`/`secondary` deben ser nodos creados UNA sola vez
 * por el llamador y pasados aquí directamente — nunca duplicados en una
 * rama JSX aparte para mobile, o React montaría dos instancias del editor.
 * Para que el toggle mobile de "Editar"/"Vista previa" siga funcionando
 * sin duplicar nodos, `primaryClassName`/`secondaryClassName` permiten que
 * el llamador agregue sus propias clases de visibilidad (ej.
 * `mobileView === "preview" ? "hidden xl:block" : ""`) a las mismas
 * columnas que este componente ya envuelve, en vez de envolver el nodo por
 * fuera dos veces.
 */

import { useRef, useState } from "react";

type Props = {
  primary: React.ReactNode;
  secondary: React.ReactNode;
  /** Ej. "Vista previa". Usado en el encabezado del panel secundario y en labels accesibles. */
  secondaryTitle: string;
  /** Si se define, muestra un botón de expandir junto al de ocultar. */
  onExpand?: () => void;
  defaultSecondaryPercent?: number;
  minSecondaryPercent?: number;
  maxSecondaryPercent?: number;
  /** Clases adicionales para la columna primaria (ej. visibilidad mobile). */
  primaryClassName?: string;
  /** Clases adicionales para la columna secundaria (ej. visibilidad mobile). */
  secondaryClassName?: string;
};

export function ResizableSplitPane({
  primary,
  secondary,
  secondaryTitle,
  onExpand,
  defaultSecondaryPercent = 40,
  minSecondaryPercent = 25,
  maxSecondaryPercent = 60,
  primaryClassName = "",
  secondaryClassName = "",
}: Props) {
  const [secondaryPercent, setSecondaryPercent] = useState(defaultSecondaryPercent);
  const [hidden, setHidden] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Los listeners de arrastre viven enteramente dentro de `startDragging`
  // (definidos y limpiados en el mismo ciclo mousedown→mouseup) para evitar
  // depender de identidades de función estables entre renders.
  function startDragging(event: React.MouseEvent) {
    event.preventDefault();

    function onMove(moveEvent: MouseEvent) {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const fromRight = rect.right - moveEvent.clientX;
      const percent = (fromRight / rect.width) * 100;
      setSecondaryPercent(
        Math.min(maxSecondaryPercent, Math.max(minSecondaryPercent, percent)),
      );
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const secondaryTitleLower = secondaryTitle.toLowerCase();

  return (
    <div>
      {/*
        `grid-cols-1` es la base (mobile-first, sin media query): por debajo
        de `xl:` el contenedor siempre es de una sola columna, y son
        `primaryClassName`/`secondaryClassName` (no este componente) los que
        deciden cuál de las dos columnas se ve en esa columna única. Recién
        a partir de `xl:` se activa la grilla redimensionable de verdad, vía
        una propiedad custom en lugar de un valor de `style` fijo, para que
        pueda tener un breakpoint (un `style` en línea no puede llevar
        prefijo `xl:`).
      */}
      <div
        ref={containerRef}
        className="grid grid-cols-1 items-start gap-0 xl:[grid-template-columns:var(--rsp-cols)]"
        style={
          {
            "--rsp-cols": hidden
              ? "1fr"
              : `minmax(0,1fr) 14px minmax(0,${secondaryPercent}%)`,
          } as React.CSSProperties
        }
      >
        <div className={`min-w-0 ${primaryClassName}`}>{primary}</div>
        {!hidden && (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={`Redimensionar ${secondaryTitleLower}`}
              tabIndex={0}
              onMouseDown={startDragging}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  setSecondaryPercent((value) =>
                    Math.min(maxSecondaryPercent, value + 2),
                  );
                } else if (event.key === "ArrowRight") {
                  event.preventDefault();
                  setSecondaryPercent((value) =>
                    Math.max(minSecondaryPercent, value - 2),
                  );
                }
              }}
              className="hidden cursor-col-resize items-stretch justify-center focus:outline-none xl:group xl:flex"
            >
              <span className="w-0.5 rounded-full bg-slate-200 group-hover:bg-accent-400 group-focus-visible:bg-accent-500" />
            </div>
            <div className={`sticky top-5 min-w-0 ${secondaryClassName}`}>
              {/* Ocultar/Expandir son un concepto de la vista dividida de
                  escritorio; en mobile ya existe el toggle del llamador —
                  "Ocultar" ahí dejaría la pantalla en blanco (`secondary`
                  desmontado) sin forma de recuperarlo fuera de `xl:`. */}
              <div className="mb-2 hidden items-center justify-between gap-2 xl:flex">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {secondaryTitle}
                </span>
                <div className="flex items-center gap-1.5">
                  {onExpand && (
                    <button
                      type="button"
                      onClick={onExpand}
                      title={`Ver ${secondaryTitleLower} en pantalla completa`}
                      aria-label={`Ver ${secondaryTitleLower} en pantalla completa`}
                      className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
                    >
                      <ExpandIcon />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setHidden(true)}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
                  >
                    Ocultar
                  </button>
                </div>
              </div>
              {secondary}
            </div>
          </>
        )}
      </div>
      {hidden && (
        <div className="mt-2 hidden justify-end xl:flex">
          <button
            type="button"
            onClick={() => setHidden(false)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
          >
            Mostrar {secondaryTitleLower}
          </button>
        </div>
      )}
    </div>
  );
}

function ExpandIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}
