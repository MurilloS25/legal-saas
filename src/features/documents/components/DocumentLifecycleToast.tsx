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
  // Finalizar solo cambia status a "final" — eso es lo que hace que la
  // Escritura pertenezca al universo del Índice Notarial (notarial_index_
  // entries), no que su metadata ya esté completa. El mensaje no debe
  // afirmar "completo"/"listo" — eso lo decide is_complete, que puede seguir
  // siendo false justo después de finalizar.
  finalized:
    "Escritura finalizada. Ya puede aparecer en el Índice Notarial. Revisa el paso Índice para completar o corregir sus datos.",
  reopened: "Escritura reabierta como borrador.",
  duplicated: "Escritura duplicada como borrador nuevo.",
};

type Props = {
  lifecycle: DocumentLifecycleEvent | undefined;
};

export function DocumentLifecycleToast({ lifecycle }: Props) {
  const { showToast } = useToast();
  // Guarda el ÚLTIMO valor ya disparado (no un simple booleano): un
  // redirect() de Server Action hacia la MISMA ruta dinámica ([id]) solo
  // cambia los search params, así que React puede preservar esta misma
  // instancia del componente en vez de desmontarla/remontarla — un efecto
  // con deps `[]` ("solo al montar") nunca volvía a correr para el nuevo
  // `lifecycle`, y el toast de finalizar/reabrir/duplicar simplemente no
  // se disparaba. Depender de `lifecycle` hace que el efecto SÍ reaccione
  // a cada nuevo evento; el ref sigue evitando un duplicado bajo Strict
  // Mode (que invoca el efecto dos veces) o si el mismo valor persistiera
  // en un re-render posterior.
  const lastFired = useRef<DocumentLifecycleEvent | null>(null);

  useEffect(() => {
    if (!lifecycle || lastFired.current === lifecycle) return;
    lastFired.current = lifecycle;
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
  }, [lifecycle, showToast]);

  return null;
}
