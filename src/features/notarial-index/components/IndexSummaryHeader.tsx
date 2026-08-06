/**
 * Resumen compacto ("X configurados · Y pendientes") + banner de
 * advertencia opcional, compartido por la configuración de Índice del
 * Machote (`TemplateIndexConfigurationSection`) y los metadatos de Índice
 * de la Escritura (`NotarialMetadataSection`). Puramente presentacional —
 * cada llamador sigue calculando sus propios conteos y su propia condición
 * de advertencia (`is_complete`/`invalid_mappings` en el Machote,
 * `reviewRequired`/campos faltantes en la Escritura).
 */

type Props = {
  configuredCount: number;
  pendingCount: number;
  /** Texto breve bajo los conteos, ej. "Esta configuración es opcional...". */
  helperText?: string;
  hasWarning?: boolean;
  warningMessage?: string;
};

export function IndexSummaryHeader({
  configuredCount,
  pendingCount,
  helperText,
  hasWarning,
  warningMessage,
}: Props) {
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xl font-semibold text-slate-900">{configuredCount}</p>
            <p className="text-xs text-slate-500">configurados</p>
          </div>
          <div>
            <p
              className={`text-xl font-semibold ${
                pendingCount > 0 ? "text-amber-700" : "text-slate-900"
              }`}
            >
              {pendingCount}
            </p>
            <p className="text-xs text-slate-500">pendientes</p>
          </div>
        </div>
        {helperText && (
          <p className="max-w-xs text-xs leading-relaxed text-slate-500">
            {helperText}
          </p>
        )}
      </div>
      {hasWarning && warningMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
          <WarningIcon />
          <span>{warningMessage}</span>
        </div>
      )}
    </div>
  );
}

function WarningIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-0.5 flex-shrink-0 text-amber-600"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
