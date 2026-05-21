"use client";

import { useActionState } from "react";
import { saveProfileAction, type ProfileState } from "../actions";

export type LawyerProfileData = {
  full_name: string;
  professional_code: string | null;
  email: string | null;
  phone: string | null;
};

interface Props {
  initialData: LawyerProfileData | null;
}

const initialState: ProfileState = {};

export function ProfileForm({ initialData }: Props) {
  const [state, formAction, pending] = useActionState(
    saveProfileAction,
    initialState,
  );

  return (
    <section aria-labelledby="profile-heading">
      <div className="bg-white rounded-xl border border-slate-200 px-6 py-8 shadow-sm">
        <h2
          id="profile-heading"
          className="text-lg font-semibold text-slate-900 mb-1"
        >
          Perfil del abogado
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Esta información se usará para personalizar los documentos generados.
        </p>

        {state.success && (
          <div
            role="status"
            className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700"
          >
            {state.message}
          </div>
        )}

        {state.message && !state.success && !state.errors && (
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
              htmlFor="full_name"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Nombre completo <span aria-hidden="true" className="text-red-600">*</span>
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              autoComplete="name"
              required
              defaultValue={initialData?.full_name ?? ""}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50"
              placeholder="Lic. Ana García López"
              aria-describedby={
                state.errors?.full_name ? "full_name-error" : undefined
              }
              aria-invalid={!!state.errors?.full_name}
            />
            {state.errors?.full_name && (
              <p
                id="full_name-error"
                role="alert"
                className="mt-1.5 text-xs text-red-700"
              >
                {state.errors.full_name}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="professional_code"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Código profesional
            </label>
            <input
              id="professional_code"
              name="professional_code"
              type="text"
              defaultValue={initialData?.professional_code ?? ""}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50"
              placeholder="NP-1234"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Correo de contacto
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={initialData?.email ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50"
                placeholder="ana@despacho.com"
                aria-describedby={
                  state.errors?.email ? "profile-email-error" : undefined
                }
                aria-invalid={!!state.errors?.email}
              />
              {state.errors?.email && (
                <p
                  id="profile-email-error"
                  role="alert"
                  className="mt-1.5 text-xs text-red-700"
                >
                  {state.errors.email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Teléfono
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                defaultValue={initialData?.phone ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50"
                placeholder="8888-8888"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {pending ? "Guardando…" : "Guardar perfil"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
