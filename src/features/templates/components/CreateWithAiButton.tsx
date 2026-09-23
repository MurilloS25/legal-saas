"use client";

import { useRef, useState } from "react";
import {
  AiTemplateGenerationDialog,
  type AiTemplateGenerationLimits,
} from "./AiTemplateGenerationDialog";

type Props = {
  limits: AiTemplateGenerationLimits;
  className?: string;
};

const defaultClassName =
  "inline-flex items-center gap-2 rounded-lg border border-accent-200 bg-white px-4 py-2.5 text-sm font-semibold text-accent-800 hover:bg-accent-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors shrink-0";

/**
 * Acción "Crear con IA". Solo se renderiza para quienes tienen
 * `templates.write` (lo decide la página); el servidor vuelve a validar el
 * permiso en cada solicitud.
 */
export function CreateWithAiButton({ limits, className }: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? defaultClassName}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
          <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
        </svg>
        Crear con IA
      </button>
      {open && (
        <AiTemplateGenerationDialog
          limits={limits}
          onClose={() => {
            setOpen(false);
            buttonRef.current?.focus();
          }}
        />
      )}
    </>
  );
}
