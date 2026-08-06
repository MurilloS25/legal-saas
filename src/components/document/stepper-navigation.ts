/**
 * Lógica pura de navegación del `HorizontalStepper`, separada del
 * componente para poder probarla sin renderizar DOM (el repo no tiene hoy
 * infraestructura de pruebas de componentes con Testing Library/jsdom — se
 * sigue el mismo patrón que el resto de componentes: la lógica no trivial
 * vive en una función pura testeable, el componente solo la invoca).
 */

export type StepLike<Id extends string> = {
  id: Id;
  status: "complete" | "current" | "upcoming" | "locked";
};

/**
 * Siguiente paso navegable (no bloqueado) a partir de `fromId`, moviéndose
 * `delta` posiciones a la vez y saltando pasos `locked`. Usado tanto por la
 * navegación con flechas del tablist como por los botones Anterior/Siguiente
 * del fallback móvil.
 *
 * `wrap` controla si la búsqueda da la vuelta al llegar al final (flechas de
 * teclado, comportamiento estándar de tablist) o se detiene (Anterior/
 * Siguiente móvil, donde no tiene sentido dar la vuelta).
 */
export function nextNavigableStepId<Id extends string>(
  steps: StepLike<Id>[],
  fromId: Id,
  delta: 1 | -1,
  wrap: boolean,
): Id | null {
  const fromIndex = steps.findIndex((step) => step.id === fromId);
  if (fromIndex === -1) return null;

  for (let i = 1; i <= steps.length; i += 1) {
    const raw = fromIndex + delta * i;
    if (!wrap && (raw < 0 || raw >= steps.length)) return null;
    const index = ((raw % steps.length) + steps.length) % steps.length;
    // Volvimos al punto de partida sin encontrar otro paso navegable.
    if (index === fromIndex) return null;
    const step = steps[index];
    if (step && step.status !== "locked") return step.id;
  }
  return null;
}

export function hasNavigableStep<Id extends string>(
  steps: StepLike<Id>[],
  fromId: Id,
  delta: 1 | -1,
): boolean {
  return nextNavigableStepId(steps, fromId, delta, false) !== null;
}
