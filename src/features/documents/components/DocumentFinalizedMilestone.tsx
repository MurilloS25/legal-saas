"use client";

/**
 * Hito de "Escritura finalizada" — vive en un componente cliente propio
 * (en vez de directamente en la página, que es un Server Component) porque
 * `MilestoneFeedback` necesita un `onDismiss` de función, y las funciones
 * no cruzan el límite server→cliente como prop.
 *
 * "Descargar Word" reutiliza `DownloadDocxButton` tal cual — finalizar ya
 * exige cero variables pendientes server-side, así que justo después de
 * finalizar la descarga siempre está disponible sin condiciones extra.
 */

import { useState } from "react";
import {
  MilestoneFeedback,
  MilestoneFeedbackAction,
} from "@/components/feedback/MilestoneFeedback";
import { DownloadDocxButton } from "./DownloadDocxButton";

type Props = {
  documentId: string;
};

export function DocumentFinalizedMilestone({ documentId }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <MilestoneFeedback
      title="Escritura finalizada"
      description="Ahora puedes completar los datos del Índice Notarial y descargar el documento Word."
      actions={
        <>
          <MilestoneFeedbackAction
            label="Ir al Índice Notarial"
            href={`/dashboard/documents/${documentId}?section=notarial`}
          />
          <DownloadDocxButton
            documentId={documentId}
            disabled={false}
            pendingVariableCount={0}
            variant="compact"
          />
        </>
      }
      onDismiss={() => setDismissed(true)}
      clearParams={["lifecycle"]}
    />
  );
}
