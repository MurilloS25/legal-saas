"use client";

/**
 * Pestaña "Perfil" del menú de usuario: identidad de la cuenta autenticada.
 *
 * A diferencia de "Despacho" (información profesional compartida por
 * workspace, en `lawyer_profiles`), aquí no existe ningún dato editable por
 * usuario individual en el modelo actual — solo el correo de autenticación
 * de Supabase (`user.email`, solo lectura: no hay flujo de cambio de email
 * en el producto). Por eso esta sección muestra el correo y reutiliza el
 * flujo real de recuperación de contraseña en vez de inventar campos.
 */

import { useActionState, useEffect, useRef } from "react";
import { forgotPasswordAction, type ForgotPasswordState } from "@/app/(auth)/forgot-password/actions";
import { LockIcon } from "@/app/(dashboard)/_components/icons";
import { useToast } from "@/components/feedback/Toast";

const initialState: ForgotPasswordState = {};

export function ProfileSection({ userEmail }: { userEmail: string | null }) {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    initialState,
  );
  const { showToast } = useToast();
  const lastHandled = useRef<ForgotPasswordState | null>(null);

  useEffect(() => {
    if (state.submitted && lastHandled.current !== state) {
      lastHandled.current = state;
      showToast(state.message ?? "Enlace enviado.", "info");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
          <h2 className="text-sm font-semibold text-slate-900">Cuenta</h2>
          <p className="text-xs text-slate-500">
            Correo con el que inicias sesión.
          </p>
        </div>
        <div className="px-6 py-6">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink-800 text-[15px] font-semibold text-white">
              {(userEmail ?? "?").slice(0, 2).toUpperCase()}
            </span>
            <p className="min-w-0 truncate text-sm text-slate-700">{userEmail}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
          <h2 className="text-sm font-semibold text-slate-900">Seguridad</h2>
          <p className="text-xs text-slate-500">
            El cambio de contraseña se hace por enlace enviado a tu correo.
          </p>
        </div>
        <div className="px-6 py-6">
          <form action={formAction}>
            <input type="hidden" name="email" value={userEmail ?? ""} />
            <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <LockIcon className="size-4 text-slate-400" />
                <span className="text-sm text-slate-700">Contraseña</span>
              </div>
              <button
                type="submit"
                disabled={pending || !userEmail}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {pending ? "Enviando…" : "Enviar enlace de restablecimiento"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
