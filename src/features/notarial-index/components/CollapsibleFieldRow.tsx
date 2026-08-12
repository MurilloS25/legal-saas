/**
 * Fila de acordeón para la presentación compacta del Índice Notarial:
 * cerrada muestra nombre + fuente/meta + estado; abierta muestra el editor
 * de campo existente sin cambios (pasado como `children`). El estado "una
 * fila abierta a la vez" vive en el componente padre (`open`/`onToggle`),
 * no aquí — cada sección (`TemplateIndexConfigurationSection`,
 * `NotarialMetadataSection`) sigue dueña de su propio `openRowId`.
 *
 * Varias filas se colocan dentro de un contenedor con borde/redondeo a
 * cargo del llamador (ej. `divide-y rounded-xl border`).
 */

type RowStatus = "configured" | "pending" | "optional" | "automatic";

type Props = {
  id: string;
  name: string;
  /** Subtítulo: fuente/sugerencia/estado resumido. */
  meta: string;
  status: RowStatus;
  /** Reemplaza la etiqueta por defecto del estado si se necesita un texto distinto. */
  statusLabel?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

const STATUS_STYLES: Record<RowStatus, string> = {
  configured: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  optional: "border-slate-200 bg-slate-50 text-slate-600",
  automatic: "border-slate-200 bg-slate-50 text-slate-600",
};

const STATUS_LABELS: Record<RowStatus, string> = {
  configured: "Configurado",
  pending: "Pendiente",
  optional: "Opcional",
  automatic: "Automático",
};

export function CollapsibleFieldRow({
  id,
  name,
  meta,
  status,
  statusLabel,
  open,
  onToggle,
  children,
}: Props) {
  const panelId = `${id}-panel`;
  const buttonId = `${id}-trigger`;

  return (
    <div>
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-500"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-slate-900">
            {name}
          </span>
          <span className="block truncate text-xs text-slate-500">{meta}</span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-2">
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[status]}`}
          >
            {statusLabel ?? STATUS_LABELS[status]}
          </span>
          <ChevronIcon open={open} />
        </span>
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={buttonId}
          className="border-t border-slate-100 bg-slate-50/40 px-4 py-4"
        >
          {children}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
