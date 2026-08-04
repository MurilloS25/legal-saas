"use client";

import { useActionState } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signupAction, type SignupState } from "./actions";
import { PasswordRequirementsHint } from "@/components/forms/PasswordRequirementsHint";

const initialState: SignupState = {};

// Registro público deshabilitado para el piloto privado: los usuarios se
// crean de forma controlada desde el dashboard de Supabase. La ruta y el
// formulario se conservan sin usar por si el producto vuelve a habilitar
// el registro público más adelante.
const PUBLIC_SIGNUP_ENABLED = false;

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(
    signupAction,
    initialState,
  );

  if (!PUBLIC_SIGNUP_ENABLED) {
    redirect("/login");
  }

  if (state.requiresConfirmation) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-slate-200 px-8 py-10 shadow-sm text-center">
          <div className="mb-5 flex justify-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-50 text-accent-600 text-2xl"
              aria-hidden="true"
            >
              ✉
            </span>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Revisa tu correo
          </h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            {state.message}
          </p>
          <p className="mt-6 text-sm text-slate-500">
            ¿Ya confirmaste?{" "}
            <Link
              href="/login"
              className="font-medium text-accent-600 hover:text-accent-700 focus:outline-none focus:underline"
            >
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl border border-slate-200 px-8 py-10 shadow-sm">
        <div className="mb-7">
          <h1 className="text-xl font-semibold text-slate-900">Crear cuenta</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configura tu espacio de trabajo legal.
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
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50"
              placeholder="abogado@ejemplo.com"
              aria-describedby={
                state.errors?.email ? "email-error" : undefined
              }
              aria-invalid={!!state.errors?.email}
            />
            {state.errors?.email && (
              <p
                id="email-error"
                role="alert"
                className="mt-1.5 text-xs text-red-700"
              >
                {state.errors.email}
              </p>
            )}
          </div>

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
            {state.errors?.password && (
              <p
                id="password-error"
                role="alert"
                className="mt-1.5 text-xs text-red-700"
              >
                {state.errors.password}
              </p>
            )}
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
            {state.errors?.confirmPassword && (
              <p
                id="confirmPassword-error"
                role="alert"
                className="mt-1.5 text-xs text-red-700"
              >
                {state.errors.confirmPassword}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-accent-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? "Creando cuenta…" : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-medium text-accent-600 hover:text-accent-700 focus:outline-none focus:underline"
          >
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
