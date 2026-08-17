"use client";

/**
 * Dispara el toast de confirmación correspondiente a crear/actualizar un
 * Cliente cuando se llega al listado vía redirect del Server Action
 * (`?event=...`). `createClientAction`/`updateClientAction` redirigen
 * server-side antes de que `state.success` pudiera resolverse en cliente —
 * un `useEffect` sobre el estado del formulario nunca se ejecutaría, ya que
 * el componente se desmonta con la navegación. Mismo patrón puente que
 * `DocumentLifecycleToast` en Escrituras.
 */

import { useEffect, useRef } from "react";
import { useToast } from "@/components/feedback/Toast";
import { stripSearchParams } from "@/lib/navigation/strip-search-params";

export type ClientLifecycleEvent = "created" | "updated";

const MESSAGES: Record<ClientLifecycleEvent, string> = {
  created: "Cliente creado.",
  updated: "Cliente actualizado.",
};

type Props = {
  event: ClientLifecycleEvent | undefined;
};

export function ClientLifecycleToast({ event }: Props) {
  const { showToast } = useToast();
  // Evita un toast duplicado bajo React Strict Mode (dev), que invoca cada
  // efecto de montaje dos veces sobre la misma instancia.
  const fired = useRef(false);

  useEffect(() => {
    if (!event || fired.current) return;
    fired.current = true;
    showToast(MESSAGES[event]);
    const next = stripSearchParams(
      window.location.pathname,
      window.location.search,
      ["event"],
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
