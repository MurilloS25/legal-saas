"use client";

export type TemplateMobileView = "edit" | "preview";

type Props = {
  value: TemplateMobileView;
  onChange: (value: TemplateMobileView) => void;
};

export function TemplateMobileViewToggle({ value, onChange }: Props) {
  const tabClass = (active: boolean) =>
    `press-feedback flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
      active
        ? "bg-ink-900 text-white"
        : "bg-white text-ink-700 border border-ink-200 hover:bg-ink-100/60"
    }`;

  return (
    <div className="mb-6 flex gap-2 xl:hidden" role="group" aria-label="Vista">
      <button
        type="button"
        onClick={() => onChange("edit")}
        aria-pressed={value === "edit"}
        className={tabClass(value === "edit")}
      >
        Editar
      </button>
      <button
        type="button"
        onClick={() => onChange("preview")}
        aria-pressed={value === "preview"}
        className={tabClass(value === "preview")}
      >
        Vista previa
      </button>
    </div>
  );
}
