"use client";

type MobileViewOption<Value extends string> = {
  value: Value;
  label: string;
};

type Props<Value extends string> = {
  value: Value;
  options: readonly [MobileViewOption<Value>, MobileViewOption<Value>];
  onChange: (value: Value) => void;
};

function optionClass(active: boolean) {
  return `flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent-500 ${
    active
      ? "bg-slate-900 text-white"
      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
  }`;
}

export function MobileViewToggle<Value extends string>({
  value,
  options,
  onChange,
}: Props<Value>) {
  return (
    <div className="mb-6 flex gap-2 xl:hidden" role="group" aria-label="Vista">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={optionClass(value === option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
