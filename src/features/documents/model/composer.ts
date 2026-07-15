export function documentFieldInputId(fieldKey: string): string {
  return `composer-field-${fieldKey.replace(/\./g, "_")}`;
}
