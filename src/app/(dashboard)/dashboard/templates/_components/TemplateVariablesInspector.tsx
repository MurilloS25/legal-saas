// Server component: solo presenta el resultado del inspector de variables.

type Props = {
  variables: string[];
  missingFields: string[];
  unusedFields: string[];
};

function VariableChip({
  variable,
  tone,
}: {
  variable: string;
  tone: "neutral" | "warning" | "muted";
}) {
  const toneClass =
    tone === "warning"
      ? "bg-amber-50 text-amber-800 border border-amber-200"
      : tone === "muted"
        ? "bg-slate-100 text-slate-500"
        : "bg-slate-100 text-slate-700";

  return (
    <code
      className={`rounded px-1.5 py-0.5 font-mono text-xs ${toneClass}`}
    >{`{{${variable}}}`}</code>
  );
}

export function TemplateVariablesInspector({
  variables,
  missingFields,
  unusedFields,
}: Props) {
  return (
    <section
      aria-labelledby="template-variables-heading"
      className="mt-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
        <h2
          id="template-variables-heading"
          className="text-sm font-semibold text-slate-900"
        >
          Variables detectadas
        </h2>
        <p className="text-xs text-slate-500">
          Variables encontradas en el contenido del machote, comparadas con los
          campos definidos.
        </p>
      </div>

      <div className="px-6 py-5 space-y-5">
        <div>
          <h3 className="text-xs font-medium text-slate-700 mb-2">
            En el contenido
          </h3>
          {variables.length === 0 ? (
            <p className="text-sm text-slate-500">
              No se detectaron variables en el contenido.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {variables.map((variable) => (
                <VariableChip key={variable} variable={variable} tone="neutral" />
              ))}
            </div>
          )}
        </div>

        {missingFields.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-amber-800 mb-2">
              Campos faltantes
            </h3>
            <p className="text-xs text-slate-500 mb-2">
              Se usan en el contenido pero no están definidas como campo del
              machote.
            </p>
            <div className="flex flex-wrap gap-2">
              {missingFields.map((variable) => (
                <VariableChip key={variable} variable={variable} tone="warning" />
              ))}
            </div>
          </div>
        )}

        {unusedFields.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-slate-600 mb-2">
              Campos no usados
            </h3>
            <p className="text-xs text-slate-500 mb-2">
              Están definidos como campo pero no aparecen en el contenido.
            </p>
            <div className="flex flex-wrap gap-2">
              {unusedFields.map((variable) => (
                <VariableChip key={variable} variable={variable} tone="muted" />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
