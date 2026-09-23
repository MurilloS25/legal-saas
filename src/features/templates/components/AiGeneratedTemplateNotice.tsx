/**
 * Advertencia persistente en un Machote generado con IA. Visible pero no
 * invasiva; sin porcentajes de confianza (no hay calibración real que los
 * respalde). Si el modelo marcó datos para revisión, se listan sus claves.
 */

type Props = {
  reviewKeys: string[];
  isDraft: boolean;
};

export function AiGeneratedTemplateNotice({ reviewKeys, isDraft }: Props) {
  return (
    <section
      aria-labelledby="ai-generated-notice-title"
      className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    >
      <h2 id="ai-generated-notice-title" className="font-semibold">
        Generado con asistencia de IA
      </h2>
      <p className="mt-1">
        Este Machote fue generado con asistencia de inteligencia artificial y puede
        contener errores u omisiones. Revise cuidadosamente el contenido, las
        variables y la configuración notarial antes de utilizarlo o publicarlo.
      </p>
      {isDraft && reviewKeys.length > 0 && (
        <p className="mt-2">
          <span className="font-medium">Requieren revisión:</span>{" "}
          {reviewKeys.map((key, index) => (
            <span key={key}>
              {index > 0 && ", "}
              <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">{key}</code>
            </span>
          ))}
        </p>
      )}
      {isDraft && (
        <p className="mt-2 text-xs">
          El folio final del Índice Notarial nunca se completa automáticamente.
        </p>
      )}
    </section>
  );
}
