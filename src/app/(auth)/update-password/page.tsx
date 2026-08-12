import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

// Server Component: verifica la sesión ANTES de mostrar el formulario. No
// vive bajo PRIVATE_ROUTE_PREFIXES en proxy.ts a propósito — un enlace de
// recuperación vencido o ya usado debe mostrar un mensaje claro con opción
// de pedir uno nuevo, no un simple redirect silencioso a /login.
export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-slate-200 px-8 py-10 shadow-sm text-center">
          <h1 className="text-xl font-semibold text-slate-900">
            Enlace no válido o expirado
          </h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Solicita un nuevo enlace para restablecer tu contraseña.
          </p>
          <p className="mt-6 text-sm text-slate-500">
            <Link
              href="/forgot-password"
              className="font-medium text-accent-600 hover:text-accent-700 focus:outline-none focus:underline"
            >
              Solicitar enlace
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return <UpdatePasswordForm />;
}
