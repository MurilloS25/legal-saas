"use client";

/**
 * Popover compacto con las variantes de un Bloque de opciones, anclado
 * cerca del bloque en la hoja documental. `role="radiogroup"`: elegir una
 * variante es una selección única entre alternativas predefinidas.
 */

import { useEffect, useId, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";

type Props = {
  blockName: string;
  variants: { id: string; label: string }[];
  selectedVariantId: string;
  onSelect: (variantId: string) => void;
  onClose: () => void;
};

export function OptionBlockPopover({
  blockName,
  variants,
  selectedVariantId,
  onSelect,
  onClose,
}: Props) {
  // `<span>`, no `<div>`: la hoja documental renderiza los bloques dentro de
  // un `<p>` (el párrafo), y un `<div>` ahí sería HTML inválido (rompe la
  // hidratación y desplaza el DOM real, haciendo el popover no interactivo).
  const popoverRef = useRef<HTMLSpanElement | null>(null);
  const groupName = useId();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [onClose]);

  return (
    <motion.span
      ref={popoverRef}
      role="radiogroup"
      aria-label={`Variantes de ${blockName}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
      className="absolute left-0 top-full z-20 mt-1 block w-64 rounded-lg border border-ink-200 bg-white p-1.5 shadow-ink-md"
    >
      {variants.map((variant) => {
        const inputId = `${groupName}-${variant.id}`;
        return (
          <label
            key={variant.id}
            htmlFor={inputId}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-700 transition-colors hover:bg-ink-100/60"
          >
            <input
              id={inputId}
              type="radio"
              name={groupName}
              checked={variant.id === selectedVariantId}
              onChange={() => onSelect(variant.id)}
              className="h-4 w-4 border-ink-300 text-accent-600 focus:ring-accent-500"
              autoFocus={variant.id === selectedVariantId}
            />
            {variant.label}
          </label>
        );
      })}
    </motion.span>
  );
}
