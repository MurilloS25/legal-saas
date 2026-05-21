"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-xl border border-slate-200 px-8 py-10 shadow-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">
            Iniciar sesión
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Accede a tu espacio de trabajo legal.
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
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50"
              placeholder="abogado@ejemplo.com"
              aria-describedby={
                state.errors?.email ? "email-error" : undefined
              }
              aria-invalid={!!state.errors?.email}
            />
            {state.errors?.email && (
              <p id="email-error" role="alert" className="mt-1.5 text-xs text-red-700">
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
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50"
              placeholder="••••••••"
              aria-describedby={
                state.errors?.password ? "password-error" : undefined
              }
              aria-invalid={!!state.errors?.password}
            />
            {state.errors?.password && (
              <p id="password-error" role="alert" className="mt-1.5 text-xs text-red-700">
                {state.errors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          ¿No tienes cuenta?{" "}
          <Link
            href="/signup"
            className="font-medium text-teal-600 hover:text-teal-700 focus:outline-none focus:underline"
          >
            Crear cuenta
          </Link>
        </p>
      </div>
    </div>
  );
}
