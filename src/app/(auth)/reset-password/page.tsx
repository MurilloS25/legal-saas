import Link from "next/link";
import { ConfirmResetForm } from "./ConfirmResetForm";

type Props = {
  searchParams: Promise<{ token_hash?: string; email?: string }>;
};

// Página intermedia del enlace de recuperación (GET, sin sesión). Mismo
// patrón que /accept-invite (ver ese archivo y
// src/app/auth/confirm/route.ts): el GET nunca ejecuta verifyOtp — a
// diferencia de una invitación, no existe una tabla propia contra la cual
// previsualizar el estado del token (workspace_members no aplica aquí),
// así que la vista es genérica; cualquier estado real (usado, expirado,
// inválido) solo se conoce al intentar el POST.
export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token_hash, email } = await searchParams;

  if (!token_hash || !email) {
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

  return <ConfirmResetForm tokenHash={token_hash} email={email} />;
}
