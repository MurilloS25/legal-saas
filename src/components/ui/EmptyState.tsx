/**
 * Estado vacío compartido. Antes cada feature componía su propio bloque
 * inline (~10 implementaciones distintas); este es el patrón único.
 */
type Props = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center animate-fade-in",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon && (
        <div className="flex size-11 items-center justify-center rounded-full bg-accent-50 text-accent-600">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
