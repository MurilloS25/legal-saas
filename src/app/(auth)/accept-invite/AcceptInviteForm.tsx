"use client";

import { useActionState } from "react";
import { acceptInvitationAction, type AcceptInviteState } from "./actions";
import { FieldError } from "@/components/forms/FieldError";
import { PasswordRequirementsHint } from "@/components/forms/PasswordRequirementsHint";
import { ROLE_LABELS, type WorkspaceRole } from "@/lib/server/permissions";

const initialState: AcceptInviteState = {};

type AcceptInviteFormProps = {
  workspaceName: string;
  role: string;
};

export function AcceptInviteForm({ workspaceName, role }: AcceptInviteFormProps) {
  const [state, formAction, pending] = useActionState(
    acceptInvitationAction,
    initialState,
  );
  const roleLabel = ROLE_LABELS[role as WorkspaceRole] ?? role;

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl border border-slate-200 px-8 py-10 shadow-sm">
        <div className="mb-7">
          <h1 className="text-xl font-semibold text-slate-900">
            Te invitaron a {workspaceName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Vas a unirte como <span className="font-medium">{roleLabel}</span>.
            Crea una contraseña para tu cuenta.
          </p>
        </div>

        {state.message && !state.errors && (
          <div
            role="alert"
            className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            {state.message}
          </div>
        )}

        <form action={formAction} className="space-y-5" noValidate>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50"
              placeholder="Crea una contraseña segura"
              aria-describedby="password-requirements password-error"
              aria-invalid={!!state.errors?.password}
            />
            <PasswordRequirementsHint id="password-requirements" />
            <FieldError id="password-error" message={state.errors?.password} />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Confirmar contraseña
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50"
              placeholder="Repite la contraseña"
              aria-describedby={
                state.errors?.confirmPassword
                  ? "confirmPassword-error"
                  : undefined
              }
              aria-invalid={!!state.errors?.confirmPassword}
            />
            <FieldError
              id="confirmPassword-error"
              message={state.errors?.confirmPassword}
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-accent-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? "Uniéndote…" : "Unirme al equipo"}
          </button>
        </form>
      </div>
    </div>
  );
}
