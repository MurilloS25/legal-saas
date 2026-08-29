"use client";

/**
 * Riel de navegación contextual del workspace de machotes —
 * REDISEÑO ESTRUCTURAL (iteración 3): reemplaza el stepper horizontal de
 * pantalla completa. El editor (Documento) ya no es un paso que reemplaza a
 * los demás — es el lienzo persistente del workspace — así que este riel
 * deja de incluirlo como un paso secuencial y en cambio ofrece:
 *
 * - Un ítem "Documento" que NO abre un paso nuevo: en desktop, el lienzo ya
 *   está siempre visible, así que seleccionarlo solo vacía visualmente el
 *   panel lateral (mostrar/ocultar el panel contextual); en mobile, es la
 *   única forma de volver al editor a pantalla completa (ver
 *   `TemplateWorkspace`, `mobileSurface`).
 * - Cuatro ítems de panel contextual (Información, Variables, Índice,
 *   Publicar) que sí controlan qué contenido muestra el panel lateral.
 *
 * Puramente presentacional — no posee `section` ni la URL, igual que el
 * `HorizontalStepper` que reemplaza en este flujo (ese componente sigue
 * viviendo en `src/components/document/` para Escrituras; no se modifica
 * aquí para no interferir con ese módulo).
 */

import { motion, useReducedMotion } from "motion/react";
import type { TemplateWorkspaceSection } from "./TemplateWorkspaceHeader";

type RailItem = {
  id: TemplateWorkspaceSection;
  label: string;
  hint: string;
};

const RAIL_ITEMS: RailItem[] = [
  { id: "information", label: "Información", hint: "Nombre y descripción" },
  { id: "document", label: "Documento", hint: "Enfocar el editor" },
  { id: "variables", label: "Variables", hint: "Campos detectados" },
  { id: "notarial", label: "Índice", hint: "Precarga del Índice Notarial" },
  { id: "publish", label: "Publicar", hint: "Resumen y estado" },
];

type Props = {
  section: TemplateWorkspaceSection;
  onSectionChange: (section: TemplateWorkspaceSection) => void;
  informationComplete: boolean;
  documentComplete: boolean;
  variablesComplete: boolean;
  indexComplete: boolean;
  publishComplete: boolean;
  indexLocked: boolean;
};

export function TemplateSectionRail({
  section,
  onSectionChange,
  informationComplete,
  documentComplete,
  variablesComplete,
  indexComplete,
  publishComplete,
  indexLocked,
}: Props) {
  const completion: Record<TemplateWorkspaceSection, boolean> = {
    information: informationComplete,
    document: documentComplete,
    variables: variablesComplete,
    notarial: indexComplete,
    publish: publishComplete,
  };
  const prefersReducedMotion = useReducedMotion();

  return (
    <nav
      aria-label="Secciones del machote"
      className="rounded-xl border border-ink-100 bg-white p-1.5 shadow-ink-sm"
    >
      <div role="tablist" aria-orientation="vertical" className="flex flex-row gap-1 overflow-x-auto xl:flex-col xl:overflow-visible">
        {RAIL_ITEMS.map((item) => {
          const locked = item.id === "notarial" && indexLocked;
          const active = item.id === section;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`template-tab-${item.id}`}
              aria-selected={active}
              aria-controls={
                item.id === "document" ? undefined : `template-panel-${item.id}`
              }
              aria-disabled={locked || undefined}
              disabled={locked}
              title={locked ? "Disponible después de guardar el machote por primera vez." : item.hint}
              onClick={() => {
                if (locked) return;
                onSectionChange(item.id);
              }}
              className={`relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 xl:w-full ${
                locked
                  ? "cursor-not-allowed text-ink-400/70"
                  : active
                    ? "text-ink-900"
                    : "text-ink-500 hover:bg-ink-100/60 hover:text-ink-900"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="template-rail-active-pill"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-lg bg-accent-50"
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { type: "spring", duration: 0.4, bounce: 0.15 }
                  }
                />
              )}
              <span
                aria-hidden="true"
                className={`relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  item.id !== "document" && completion[item.id]
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : active
                      ? "border-accent-600 bg-accent-600 text-white"
                      : locked
                        ? "border-ink-200 bg-ink-100 text-ink-400/70"
                        : "border-ink-200 bg-white text-ink-400"
                }`}
              >
                {item.id !== "document" && completion[item.id] ? "✓" : "·"}
              </span>
              <span className="relative whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
