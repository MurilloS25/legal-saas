"use client";

import { useActionState } from "react";
import { confirmResetAction, type ConfirmResetState } from "./confirm-actions";

const initialState: ConfirmResetState = {};

type ConfirmResetFormProps = {
  tokenHash: string;
  email: string;
};

export function ConfirmResetForm({ tokenHash, email }: ConfirmResetFormProps) {
  const [state, formAction, pending] = useActionState(
    confirmResetAction,
    initialState,
  );

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl border border-slate-200 px-8 py-10 shadow-sm">
        <div className="mb-7">
          <h1 className="text-xl font-semibold text-slate-900">
            Restablecer tu contraseña
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Confirma que quieres crear una contraseña nueva para{" "}
            <span className="font-medium">{email}</span>.
          </p>
        </div>

        {state.message && (
          <div
            role="alert"
            className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            {state.message}
          </div>
        )}

        <form action={formAction}>
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="email" value={email} />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-accent-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? "Confirmando…" : "Continuar"}
          </button>
        </form>
      </div>
    </div>
  );
}
