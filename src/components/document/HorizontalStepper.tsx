"use client";

/**
 * Stepper horizontal compacto, compartido por el workspace de machotes y el
 * compositor de escrituras.
 *
 * Puramente presentacional: no posee la sección activa ni la URL. El
 * llamador sigue siendo dueño de ese estado (igual que antes, cuando cada
 * workspace tenía su propio `role="tablist"`), y solo le pasa a este
 * componente la lista de pasos ya resuelta (label, estado, si está
 * bloqueado). Generaliza el patrón de pestañas accesibles que ya existía en
 * `TemplateWorkspaceHeader` (roving tabIndex, flechas, `aria-controls`) para
 * que Machotes y Escrituras compartan exactamente el mismo comportamiento de
 * teclado y foco.
 *
 * `idPrefix` deja que cada llamador conserve los ids de DOM que ya usaba
 * (`template-tab-*`, `document-step-*`) para no romper `aria-controls` ni
 * selectores de pruebas existentes.
 */

import { hasNavigableStep, nextNavigableStepId } from "./stepper-navigation";

export type StepStatus = "complete" | "current" | "upcoming" | "locked";

export type StepperStep<Id extends string> = {
  id: Id;
  label: string;
  /** Solo se muestra para el paso activo, debajo del stepper. */
  description?: string;
  status: StepStatus;
  /** Tooltip/title cuando `status === "locked"`. Nunca comunicar el bloqueo solo con color. */
  disabledReason?: string;
};

type Props<Id extends string> = {
  steps: StepperStep<Id>[];
  currentId: Id;
  onStepChange: (id: Id) => void;
  /** aria-label de la navegación, ej. "Pasos del machote". */
  navigationLabel: string;
  /** Prefijo de ids de DOM, ej. "template" o "document". */
  idPrefix: string;
};

function stepIndex<Id extends string>(steps: StepperStep<Id>[], id: Id): number {
  return steps.findIndex((step) => step.id === id);
}

export function HorizontalStepper<Id extends string>({
  steps,
  currentId,
  onStepChange,
  navigationLabel,
  idPrefix,
}: Props<Id>) {
  const currentIndex = stepIndex(steps, currentId);
  const currentStep = steps[currentIndex];

  function focusStep(id: Id) {
    document.getElementById(`${idPrefix}-step-${id}`)?.focus();
  }

  function moveFocus(fromId: Id, delta: 1 | -1) {
    const targetId = nextNavigableStepId(steps, fromId, delta, true);
    if (targetId !== null) focusStep(targetId);
  }

  return (
    <div>
      <nav aria-label={navigationLabel} className="overflow-x-auto pb-0.5">
        <div role="tablist" className="flex items-center gap-0">
          {steps.map((step, index) => {
            const locked = step.status === "locked";
            const active = step.id === currentId;
            return (
              <div key={step.id} className="flex items-center">
                {index > 0 && (
                  <div
                    aria-hidden="true"
                    className={`mx-1.5 h-0.5 w-6 shrink-0 rounded-full sm:w-8 ${
                      steps[index - 1]?.status === "complete"
                        ? "bg-emerald-200"
                        : "bg-slate-200"
                    }`}
                  />
                )}
                <button
                  type="button"
                  role="tab"
                  id={`${idPrefix}-step-${step.id}`}
                  aria-selected={active}
                  aria-controls={`${idPrefix}-panel-${step.id}`}
                  aria-disabled={locked || undefined}
                  disabled={locked}
                  title={locked ? step.disabledReason : undefined}
                  tabIndex={active ? 0 : -1}
                  onClick={() => {
                    if (locked) return;
                    onStepChange(step.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
                      return;
                    }
                    event.preventDefault();
                    moveFocus(step.id, event.key === "ArrowRight" ? 1 : -1);
                  }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent-500 ${
                    locked
                      ? "cursor-not-allowed text-slate-300"
                      : active
                        ? "text-slate-900"
                        : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                      step.status === "complete"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : active
                          ? "border-accent-600 bg-accent-600 text-white"
                          : locked
                            ? "border-slate-200 bg-slate-50 text-slate-300"
                            : "border-slate-300 bg-white text-slate-500"
                    }`}
                  >
                    {step.status === "complete" ? "✓" : index + 1}
                  </span>
                  <span className="whitespace-nowrap">{step.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </nav>
      {currentStep?.description && (
        <p className="mt-2 border-b border-slate-200 pb-3 text-sm text-slate-500">
          {currentStep.description}
        </p>
      )}
      <StepperMobileFallback
        steps={steps}
        currentId={currentId}
        onStepChange={onStepChange}
      />
    </div>
  );
}

function StepperMobileFallback<Id extends string>({
  steps,
  currentId,
  onStepChange,
}: Pick<Props<Id>, "steps" | "currentId" | "onStepChange">) {
  const currentIndex = stepIndex(steps, currentId);
  const currentStep = steps[currentIndex];
  const total = steps.length;

  function goRelative(delta: 1 | -1) {
    const targetId = nextNavigableStepId(steps, currentId, delta, false);
    if (targetId !== null) onStepChange(targetId);
  }

  if (!currentStep) return null;

  const canGoPrev = hasNavigableStep(steps, currentId, -1);
  const canGoNext = hasNavigableStep(steps, currentId, 1);

  return (
    <div className="sm:hidden">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Paso {currentIndex + 1} de {total}
      </p>
      <p className="mt-1 text-base font-semibold text-slate-900">
        {currentStep.label}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-accent-600 transition-all"
          style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
        />
      </div>
      <div className="mt-3 flex justify-between gap-2">
        <button
          type="button"
          onClick={() => goRelative(-1)}
          disabled={!canGoPrev}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
        >
          ← Anterior
        </button>
        <button
          type="button"
          onClick={() => goRelative(1)}
          disabled={!canGoNext}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
