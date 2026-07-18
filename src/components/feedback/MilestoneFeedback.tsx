"use client";

/**
 * Banner de orientación tras un hito importante (primer guardado,
 * finalización, creación) — no un guardado normal. Sigue el mismo estilo
 * ya usado en todo LexCR para confirmaciones (`bg-accent-50
 * border-accent-200 text-accent-800`), pero añade título, descripción y
 * acciones opcionales, y se auto-limpia de la URL para no reaparecer al
 * recargar o volver atrás.
 *
 * No es un diálogo: no atrapa el foco ni usa `Escape` — es contenido del
 * workspace, no bloquea al usuario.
 */

import { useEffect } from "react";
import Link from "next/link";
import { stripSearchParams } from "@/lib/navigation/strip-search-params";

type Props = {
  title: string;
  description: string;
  actions?: React.ReactNode;
  onDismiss: () => void;
  /**
   * Query params a quitar de la URL (vía `history.replaceState`) apenas se
   * monta el banner, para que una recarga o un "atrás" del navegador no lo
   * vuelvan a mostrar. P. ej. `["created"]` para `?created=1`.
   */
  clearParams?: string[];
};

export function MilestoneFeedback({
  title,
  description,
  actions,
  onDismiss,
  clearParams,
}: Props) {
  useEffect(() => {
    if (!clearParams?.length) return;
    const next = stripSearchParams(
      window.location.pathname,
      window.location.search,
      clearParams,
    );
    const current = window.location.pathname + window.location.search;
    if (next !== current) {
      window.history.replaceState(null, "", next);
    }
    // Solo debe ejecutarse una vez, al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="status"
      className="mb-6 rounded-xl border border-accent-200 bg-accent-50 px-5 py-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent-700"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-accent-900">{title}</p>
          <p className="mt-0.5 text-sm text-accent-800">{description}</p>
          {actions && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar"
          className="shrink-0 rounded-md p-1 text-accent-600 hover:bg-accent-100 hover:text-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ action helper

type ActionProps = { label: string } & (
  | { onClick: () => void; href?: undefined }
  | { href: string; onClick?: undefined }
);

const actionClassName =
  "rounded-lg border border-accent-300 bg-white px-3 py-1.5 text-xs font-semibold text-accent-800 hover:bg-accent-100 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors";

/** Botón/enlace secundario para usar dentro de `actions`, con estilo consistente. */
export function MilestoneFeedbackAction(props: ActionProps) {
  if (props.href) {
    return (
      <Link href={props.href} className={actionClassName}>
        {props.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={props.onClick} className={actionClassName}>
      {props.label}
    </button>
  );
}
