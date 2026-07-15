"use client";

export type TemplateMobileView = "edit" | "preview";

type Props = {
  value: TemplateMobileView;
  onChange: (value: TemplateMobileView) => void;
};

export function TemplateMobileViewToggle({ value, onChange }: Props) {
  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 ${
      active
        ? "bg-slate-900 text-white"
        : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
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
