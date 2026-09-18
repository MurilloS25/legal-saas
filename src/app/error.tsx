"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertIcon } from "@/components/icons";
import {
  ErrorPageShell,
  errorPagePrimaryActionClassName,
  errorPageSecondaryActionClassName,
} from "@/components/feedback/ErrorPageShell";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[app] route render failed", error.digest ?? "unknown");
  }, [error]);

  return (
    <ErrorPageShell
      headingId="unexpected-error-title"
      eyebrow="No fue posible continuar"
      title="Algo salió mal"
      description="No pudimos cargar esta página. Intenta nuevamente o vuelve al panel."
      visualIcon={<AlertIcon className="size-6 text-white/75" />}
      visualBadge="Error temporal"
      visualMark="!"
      visualCaption="Carga interrumpida"
      visualFooter="Puedes intentar nuevamente"
    >
      <button
        type="button"
        onClick={() => unstable_retry()}
        className={errorPagePrimaryActionClassName}
      >
        Intentar de nuevo
      </button>
      <Link href="/dashboard" className={errorPageSecondaryActionClassName}>
        Volver al panel
      </Link>
    </ErrorPageShell>
  );
}
