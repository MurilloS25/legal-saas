/** Requisitos de contraseña — mismos que valida `passwordSchema` en
 * `src/lib/validations/auth.ts`. Siempre visible para guiar al usuario. */
export function PasswordRequirementsHint({ id }: { id: string }) {
  return (
    <div
      id={id}
      className="mt-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5"
    >
      <p className="text-xs font-medium text-slate-500 mb-1.5">
        La contraseña debe incluir:
      </p>
      <ul className="space-y-1 text-xs text-slate-400">
        <li>· Mínimo 12 caracteres</li>
        <li>· Al menos una mayúscula y una minúscula</li>
        <li>· Al menos un número</li>
        <li>· Al menos un símbolo (p. ej. ! @ # $)</li>
      </ul>
    </div>
  );
}
