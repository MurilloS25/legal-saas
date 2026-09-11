import { isoToCostaRicaLocal } from "./datetime";
import { overrideOrFallback, type NotarialMetadata } from "./notarial";

/** Compare the editable values on screen with the persisted version to confirm. */
export function matchesPersistedNotarialSnapshot(
  visible: Partial<NotarialMetadata> & { authorizedDate?: string; authorizedTime?: string },
  persisted: NotarialMetadata | null,
): boolean {
  if (!persisted) return false;
  const text = (value: string | null | undefined) => (value ?? "").trim();
  const local = isoToCostaRicaLocal(persisted.authorized_at);
  return visible.instrument_number === persisted.instrument_number &&
    text(visible.authorized_at) === local &&
    (visible.authorizedDate === undefined || visible.authorizedDate === local.slice(0, 10)) &&
    (visible.authorizedTime === undefined || visible.authorizedTime === local.slice(11)) &&
    (["protocol_book", "initial_folio", "final_folio", "notes"] as const)
      .every(key => text(visible[key]) === text(persisted[key])) &&
    text(overrideOrFallback(visible.act_name_override, visible.act_name_snapshot)) ===
      text(overrideOrFallback(persisted.act_name_override, persisted.act_name_snapshot)) &&
    text(overrideOrFallback(visible.parties_override, visible.generated_parties)) ===
      text(overrideOrFallback(persisted.parties_override, persisted.generated_parties));
}
