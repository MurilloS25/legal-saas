"use client";

/**
 * Dispara el toast de confirmación correspondiente a un cambio de ciclo de
 * vida de la Escritura (finalizar / reabrir / duplicar) cuando se llega a
 * la página vía redirect del Server Action (`?lifecycle=...`). La página
 * que la monta es un Server Component y no puede llamar `useToast()`
 * directamente, así que este puente cliente lee el query param al montar,
 * dispara el toast, y limpia el parámetro de la URL para que no reaparezca
 * al recargar o volver atrás — mismo patrón que el resto de los toasts de
 * "primer guardado" en Machotes/Escrituras.
 *
 * No renderiza nada visible: reemplaza al extinto banner
 * `DocumentFinalizedMilestone` (y los `role="status"` inline de reabrir/
 * duplicar), que ocupaban espacio de layout para un mensaje temporal.
 */

import { useEffect, useRef } from "react";
import { useToast } from "@/components/feedback/Toast";
import { stripSearchParams } from "@/lib/navigation/strip-search-params";

export type DocumentLifecycleEvent = "finalized" | "reopened" | "duplicated";

const MESSAGES: Record<DocumentLifecycleEvent, string> = {
  finalized: "Escritura finalizada.",
  reopened: "Escritura reabierta como borrador.",
  duplicated: "Escritura duplicada como borrador nuevo.",
};

type Props = {
  lifecycle: DocumentLifecycleEvent | undefined;
};

export function DocumentLifecycleToast({ lifecycle }: Props) {
  const { showToast } = useToast();
  // Evita un toast duplicado bajo React Strict Mode (dev), que invoca cada
  // efecto de montaje dos veces sobre la misma instancia.
  const fired = useRef(false);

  useEffect(() => {
    if (!lifecycle || fired.current) return;
    fired.current = true;
    showToast(MESSAGES[lifecycle]);
    const next = stripSearchParams(
      window.location.pathname,
      window.location.search,
      ["lifecycle"],
    );
    const current = window.location.pathname + window.location.search;
    if (next !== current) {
      window.history.replaceState(null, "", next);
    }
    // Solo debe ejecutarse una vez, al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
