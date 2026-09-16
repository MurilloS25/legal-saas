"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  inviteMemberAction,
  type InviteMemberState,
} from "../server/team-actions";
import { FieldError } from "@/components/forms/FieldError";
import { INVITABLE_ROLES, ROLE_LABELS } from "@/lib/server/permissions";
import { useToast } from "@/components/feedback/Toast";

const initialState: InviteMemberState = {};

export function InviteMemberForm() {
  const [state, formAction, pending] = useActionState(
    inviteMemberAction,
    initialState,
  );
  const { showToast } = useToast();
  const lastSuccessState = useRef<InviteMemberState | null>(null);
  useEffect(() => {
    if (state.success && lastSuccessState.current !== state) {
      lastSuccessState.current = state;
      showToast(state.message ?? "Invitación enviada.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">
        Invitar colaborador
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Le enviaremos un correo para que cree su contraseña y se una al
        Workspace.
      </p>

      {state.message && !state.success && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.message}
        </div>
      )}

      <form
        action={formAction}
        className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end"
        noValidate
      >
        <div className="flex-1">
          <label
            htmlFor="invite-email"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Correo electrónico
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50"
            placeholder="colega@ejemplo.com"
            aria-invalid={!!state.errors?.email}
            aria-describedby="invite-email-error"
          />
          <FieldError id="invite-email-error" message={state.errors?.email} />
        </div>

        <div className="sm:w-48">
          <label
            htmlFor="invite-role"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Rol
          </label>
          <select
            id="invite-role"
            name="role"
            defaultValue="asistente"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50"
            aria-invalid={!!state.errors?.role}
            aria-describedby="invite-role-error"
          >
            {INVITABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <FieldError id="invite-role-error" message={state.errors?.role} />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? "Enviando…" : "Invitar"}
        </button>
      </form>
    </div>
  );
}
