/**
 * Indicación de que el Machote fue generado con asistencia de IA.
 *
 * Dos presentaciones (ver `model/ai-generation/notice.ts`):
 * - pendiente de revisión: callout neutral y compacto con la advertencia
 *   de revisar contenido, variables y configuración notarial, y las claves
 *   que el modelo marcó para revisión;
 * - revisado: solo metadata histórica discreta, en una línea.
 *
 * Nunca es un banner de error ni muestra porcentajes de confianza. La
 * trazabilidad (proveedor/modelo/fecha) queda disponible como texto
 * secundario, no como alerta.
 */

import type { AiNoticeState } from "../model/ai-generation/notice";

type Props = {
  state: AiNoticeState;
  reviewKeys: string[];
  /** Fecha de generación ya formateada para mostrar. */
  generatedAtLabel: string;
  provider: string;
  model: string;
};

function SparkleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </svg>
  );
}

export function AiGeneratedTemplateNotice({
  state,
  reviewKeys,
  generatedAtLabel,
  provider,
  model,
}: Props) {
  const metadata = `${generatedAtLabel} · ${provider} · ${model}`;

  if (state === "reviewed") {
    return (
      <p
        role="note"
        aria-label="Generado con asistencia de inteligencia artificial"
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-slate-500"
        title={metadata}
      >
        <SparkleIcon />
        <span>Creado originalmente con asistencia de inteligencia artificial.</span>
      </p>
    );
  }

  return (
    <section
      aria-labelledby="ai-generated-notice-title"
      className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
    >
      <p id="ai-generated-notice-title" className="flex items-center gap-1.5 font-medium text-slate-800">
        <span className="text-accent-700">
          <SparkleIcon />
        </span>
        Generado con asistencia de inteligencia artificial. Puede contener errores u omisiones.
      </p>
      <p className="mt-0.5 text-xs text-slate-600">
        Revise el contenido, las variables y la configuración notarial antes de utilizarlo o
        publicarlo. El folio final del Índice nunca se completa automáticamente.
      </p>
      {reviewKeys.length > 0 && (
        <p className="mt-1 text-xs text-slate-600">
          <span className="font-medium">Marcadas para revisión:</span>{" "}
          {reviewKeys.map((key, index) => (
            <span key={key}>
              {index > 0 && ", "}
              <code className="rounded bg-white px-1 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200">
                {key}
              </code>
            </span>
          ))}
        </p>
      )}
      <p className="mt-1 text-[11px] text-slate-400">{metadata}</p>
    </section>
  );
}
